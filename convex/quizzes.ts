import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { ActionCtx, MutationCtx } from "./_generated/server";
import { action, mutation, query } from "./_generated/server";
import { workflow } from "./lib";
import { vv } from "./schema";
import { assertUserAuthenticated } from "./users";

export const getQuiz = query({
	args: {
		id: vv.id("quizzes"),
	},
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw new Error("User not found");
		}

		const quiz = await ctx.db.get(args.id);
		if (!quiz) {
			throw new Error("Quiz not found");
		}

		return quiz;
	},
});

export const getQuizTaskPublic = query({
	args: { taskId: v.id("quiz_tasks") },
	handler: async (ctx, args): Promise<Doc<"quiz_tasks"> | null> => {
		// Optional: Add authentication/authorization if needed
		// const identity = await ctx.auth.getUserIdentity();
		// if (!identity) {
		//   throw new Error("User not authenticated");
		// }
		// const task = await ctx.db.get(args.taskId);
		// if (task && task.userId !== identity.subject) { // Assuming quiz_tasks has a userId field
		//  throw new Error("User not authorized to view this task");
		// }
		// return task;

		// Call the internal query to get task details.
		// This assumes that internal queries can be called by public queries using ctx.runQuery.
		// If this is not the case, the logic from getQuizTaskDetails would need to be replicated here.
		return await ctx.runQuery(internal.internal_quizzes.getQuizTaskDetails, {
			taskId: args.taskId,
		});
	},
});

// Helper mutation to store quiz in database
export const storeQuiz = mutation({
	args: {
		title: v.string(),
		description: v.string(),
		questions: v.array(
			v.object({
				question: v.string(),
				options: v.array(v.string()),
				difficulty: v.union(
					v.literal("easy"),
					v.literal("medium"),
					v.literal("hard"),
				),
				questionType: v.union(
					v.literal("multiple_choice"),
					v.literal("true_false"),
					v.literal("multiple_selection"),
				),
				correctOptionIndex: v.number(),
				explanation: v.string(),
			}),
		),
		quizContext: v.union(
			v.object({ type: v.literal("pdf"), fileUrl: v.string() }),
			v.object({ type: v.literal("url"), source: v.string() }),
			v.object({ type: v.literal("prompt"), text: v.string() }),
		),
		userId: v.id("users"),
	},
	handler: async (ctx, args) => {
		// TODO: Get Target Audience from user profile or quiz settings
		// Get the user from database to get the proper user ID

		const quizId = await ctx.db.insert("quizzes", {
			title: args.title,
			description: args.description,
			questions: args.questions,
			quizContext: args.quizContext,
			createdBy: args.userId,
		});

		return quizId;
	},
});

// Quiz Attempt Mutations
export const startQuizAttempt = mutation({
	args: {
		quizId: vv.id("quizzes"),
	},
	handler: async (ctx, args) => {
		const user = await assertUserAuthenticated(ctx);

		// Check if quiz exists
		const quiz = await ctx.db.get(args.quizId);
		if (!quiz) {
			throw new Error("Quiz not found");
		}

		// Create a new quiz attempt
		const attemptId = await ctx.db.insert("quiz_attempts", {
			userId: user._id,
			quizId: args.quizId,
			questionAnswers: [],
			totalScore: 0,
			expEarned: 0,
			startedAt: Date.now(),
		});

		return attemptId;
	},
});

export const saveQuizAnswer = mutation({
	args: {
		attemptId: vv.id("quiz_attempts"),
		questionIndex: v.number(),
		selectedIndex: v.number(),
		isCorrect: v.boolean(),
		timeTaken: v.number(), // in milliseconds
	},
	handler: async (ctx: MutationCtx, args) => {
		const user = await assertUserAuthenticated(ctx);

		// Get the attempt
		const attempt = await ctx.db.get(args.attemptId);
		if (!attempt) {
			throw new Error("Quiz attempt not found");
		}

		// Check if the user owns this attempt
		if (attempt.userId !== user._id) {
			throw new Error("Unauthorized: This is not your quiz attempt");
		}

		// Check if the attempt is already finished
		if (attempt.endedAt) {
			throw new Error("Cannot save answer: Quiz attempt is already finished");
		}

		// Create the answer object
		const answer = {
			questionIndex: args.questionIndex,
			selectedIndex: args.selectedIndex,
			isCorrect: args.isCorrect,
			timeTaken: args.timeTaken,
		};

		// Update the attempt with the new answer
		await ctx.db.patch(args.attemptId, {
			questionAnswers: [...(attempt.questionAnswers || []), answer],
		});

		return { success: true };
	},
});

export const getQuizAttempt = query({
	args: {
		attemptId: vv.id("quiz_attempts"),
	},
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw new Error("User not authenticated");
		}

		// Get the current user
		const user = await ctx.db
			.query("users")
			.withIndex("by_user_id", (q) => q.eq("userId", identity.subject))
			.first();

		if (!user) {
			throw new Error("User not found in database");
		}

		// Get the attempt
		const attempt = await ctx.db.get(args.attemptId);
		if (!attempt) {
			throw new Error("Quiz attempt not found");
		}

		// Verify the attempt belongs to the current user
		if (attempt.userId !== user._id) {
			throw new Error("Not authorized to view this attempt");
		}

		return attempt;
	},
});

export const finishQuizAttempt = mutation({
	args: {
		attemptId: vv.id("quiz_attempts"),
	},
	handler: async (ctx: MutationCtx, args) => {
		const user = await assertUserAuthenticated(ctx);

		// Get the attempt
		const attempt = await ctx.db.get(args.attemptId);
		if (!attempt) {
			throw new Error("Quiz attempt not found");
		}

		// Check if the user owns this attempt
		if (attempt.userId !== user._id) {
			throw new Error("Unauthorized: This is not your quiz attempt");
		}

		// Check if the attempt is already finished
		if (attempt.endedAt) {
			throw new Error("Quiz attempt is already finished");
		}

		// Get the quiz to calculate score and XP
		const quiz = await ctx.db.get(attempt.quizId);
		if (!quiz) {
			throw new Error("Quiz not found");
		}

		// Calculate score (percentage of correct answers)
		const correctAnswers = attempt.questionAnswers.filter(
			(a) => a.isCorrect,
		).length;
		const totalQuestions = quiz.questions.length;
		const score = Math.round((correctAnswers / totalQuestions) * 100);

		// Calculate XP (base 10 per correct answer, bonus for high scores)
		let expEarned = correctAnswers * 10;
		if (score >= 90)
			expEarned += 50; // Bonus for A
		else if (score >= 80)
			expEarned += 30; // Bonus for B
		else if (score >= 70) expEarned += 15; // Bonus for C

		// Update user's total XP
		await ctx.db.patch(user._id, {
			exp: (user.exp || 0) + expEarned,
		});

		// Update the quiz attempt
		await ctx.db.patch(args.attemptId, {
			endedAt: Date.now(),
			totalScore: score,
			expEarned,
		});

		return {
			score,
			expEarned,
			correctAnswers,
			totalQuestions,
		};
	},
});

// Action to initiate the quiz generation workflow
export const startGenerateQuizWorkflow = action({
	args: {
		contentType: v.union(
			v.literal("file"),
			v.literal("url"),
			v.literal("prompt"),
		),
		content: v.string(),
		quizSettings: v.object({
			difficulty: v.union(
				v.literal("mix"),
				v.literal("easy"),
				v.literal("medium"),
				v.literal("hard"),
			),
			questionCount: v.union(
				v.literal("5"),
				v.literal("10"),
				v.literal("15"),
				v.literal("30"),
			),
		}),
		title: v.optional(v.string()),
	},
	handler: async (
		ctx: ActionCtx,
		args: {
			contentType: "file" | "url" | "prompt";
			content: string;
			quizSettings: {
				difficulty: "mix" | "easy" | "medium" | "hard";
				questionCount: "5" | "10" | "15" | "30";
			};
			title?: string;
		},
	): Promise<Id<"quiz_tasks">> => {
		const user = await ctx.runQuery(api.users.getCurrentUser);

		if (!user) {
			throw new Error("User not authenticated");
		}

		const taskId: Id<"quiz_tasks"> = await ctx.runMutation(
			internal.internal_quizzes.createQuizTask,
			{
				userId: user._id,
				contentType: args.contentType,
				content: args.content,
				quizSettings: args.quizSettings,
				title: args.title,
			},
		);

		await ctx.runMutation(api.quizzes.kickoffGenerateQuizWorkflow, {
			taskId,
		});

		return taskId;
	},
});

// New helper mutation to start the quiz generation workflow
export const kickoffGenerateQuizWorkflow = mutation({
	args: { taskId: vv.id("quiz_tasks") },
	handler: async (ctx, args) => {
		const user = await assertUserAuthenticated(ctx);

		// Explicitly call the workflow object with the current mutation context
		await workflow.start(
			ctx,
			internal.quizzes.generateQuizFromContentWorkflow,
			{
				taskId: args.taskId,
				userId: user._id,
			},
		); // Use FunctionReference from internal API
	},
});

export const generateQuizFromContentWorkflow = workflow.define({
	args: { taskId: vv.id("quiz_tasks"), userId: vv.id("users") },
	handler: async (ctx, { taskId, userId }) => {
		let task: Doc<"quiz_tasks"> | null;
		try {
			task = await ctx.runQuery(internal.internal_quizzes.getQuizTaskDetails, {
				taskId,
			});
			if (!task) {
				console.error(`Quiz task not found: ${taskId}`);
				// Cannot patch task here as it's null. Workflow will simply exit.
				return; // Exit workflow if task is not found
			}

			// Update status to 'summarizing_content'
			await ctx.runMutation(internal.internal_quizzes.updateQuizTask, {
				taskId,
				status: "summarizing_content",
				statusMessage: `Summarizing ${task.contentType}...`,
			});

			let summary: string;
			// biome-ignore lint/suspicious/noExplicitAny: AI API responses have dynamic structure
			let metadata: any;
			let quizContext:
				| { type: "pdf"; fileUrl: string }
				| { type: "url"; source: string }
				| { type: "prompt"; text: string };

			switch (task.contentType) {
				case "file": {
					const url = await ctx.runQuery(api.app.getFileUrl, {
						storageId: task.content,
					});

					if (!url) {
						throw new Error("Failed to get file URL");
					}

					const user = await ctx.runQuery(api.users.getCurrentUser, {});
					if (!user) {
						throw new Error("User not authenticated");
					}
					const result = await ctx.runAction(api.ai.pdfSummarizer, {
						pdfPath: url,
						targetAudience: user.education_level || "sma", // default, or could be from task.quizSettings or user profile
					});
					if (!result) throw new Error("Failed to get PDF summary");
					summary = result.summary;
					metadata = result.metadata;
					quizContext = { type: "pdf" as const, fileUrl: task.content };
					break;
				}
				case "url": {
					const user = await ctx.runQuery(api.users.getCurrentUser, {});
					if (!user) {
						throw new Error("User not authenticated");
					}
					const result = await ctx.runAction(api.ai.websiteSummarizer, {
						url: task.content,
						targetAudience: user.education_level || "sma",
					});
					if (!result) throw new Error("Failed to get website summary");
					summary = result.summary;
					metadata = result.metadata;
					quizContext = { type: "url" as const, source: task.content };
					break;
				}
				case "prompt": {
					const result = await ctx.runAction(api.ai.textSummarizer, {
						textContent: task.content,
						targetAudience: "sma",
						title: task.title || "Text Content",
					});
					if (!result) throw new Error("Failed to get text summary");
					summary = result.summary;
					metadata = result.metadata;
					quizContext = { type: "prompt" as const, text: task.content };
					break;
				}
				default:
					throw new Error(
						`Invalid content type: ${
							// biome-ignore lint/suspicious/noExplicitAny: <explanation>
							(task as any).contentType
						}`,
					);
			}

			await ctx.runMutation(internal.internal_quizzes.updateQuizTask, {
				taskId,
				status: "summary_completed",
				statusMessage: "Content summarization complete.",
				summary,
				metadata,
			});

			// Step 2: Convert quiz settings & Generate quiz questions
			await ctx.runMutation(internal.internal_quizzes.updateQuizTask, {
				taskId,
				status: "generating_questions",
				statusMessage: "Generating quiz questions...",
			});

			const numQuestions = Number.parseInt(task.quizSettings.questionCount);
			const difficulty =
				task.quizSettings.difficulty === "mix"
					? "medium"
					: task.quizSettings.difficulty;

			if (metadata?.metrics) {
				// biome-ignore lint/performance/noDelete: Standard practice for AI metadata cleaning
				delete metadata.metrics;
			}

			const quizDataFromAI = await ctx.runAction(api.ai.quizGenerator, {
				summary,
				metadata,
				quizSettings: {
					numQuestions,
					difficulty,
					targetAudience: "sma", // default, or could be from task.quizSettings or user profile
				},
			});

			if (!quizDataFromAI) {
				throw new Error("Failed to generate quiz questions from AI");
			}

			await ctx.runMutation(internal.internal_quizzes.updateQuizTask, {
				taskId,
				status: "questions_generated",
				statusMessage: "Quiz questions generated.",
				quizDataFromAI,
			});

			// Step 3: Store quiz in database
			await ctx.runMutation(internal.internal_quizzes.updateQuizTask, {
				taskId,
				status: "storing_quiz",
				statusMessage: "Storing quiz in database...",
			});

			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			const formattedQuestions = quizDataFromAI.questions.map((q: any) => ({
				question: q.question,
				options: q.options,
				difficulty: q.difficulty as "easy" | "medium" | "hard",
				questionType: q.questionType as
					| "multiple_choice"
					| "true_false"
					| "multiple_selection",
				correctOptionIndex: q.correctOptionIndex,
				explanation: q.explanation,
			}));

			const finalTitle =
				quizDataFromAI.title ||
				metadata?.sourceTitle ||
				task.title ||
				"Generated Quiz";
			const description =
				quizDataFromAI.description || `Quiz generated from ${task.contentType}`;

			const quizId: Id<"quizzes"> = await ctx.runMutation(
				api.quizzes.storeQuiz,
				{
					title: finalTitle,
					description,
					questions: formattedQuestions,
					quizContext,
					userId,
				},
			);

			await ctx.runMutation(internal.internal_quizzes.updateQuizTask, {
				taskId,
				status: "completed",
				statusMessage: "Quiz created successfully!",
				quizId,
			});
		} catch (error: unknown) {
			console.error(`Workflow error for task ${taskId}:`, error);
			if (taskId) {
				// ctx.db is not available in workflow, rely on internal mutation
				try {
					await ctx.runMutation(internal.internal_quizzes.updateQuizTask, {
						taskId,
						status: "failed",
						statusMessage:
							error instanceof Error
								? error.message
								: "An unknown error occurred",
						error:
							error instanceof Error
								? error.message
								: "An unknown error occurred",
					});
				} catch (patchError) {
					console.error(
						`Failed to patch error status for task ${taskId}:`,
						patchError,
					);
				}
			}
			// Optionally re-throw or handle further if needed, but workflows typically complete
		}
	},
});
