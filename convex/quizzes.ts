import { v } from "convex/values";
import { api } from "./_generated/api";
import type { MutationCtx } from "./_generated/server";
import { action, mutation, query } from "./_generated/server";
import { vv } from "./schema";
import { assertUserAuthenticated } from "./users";

export const getQuiz = query({
    args: {
        id: vv.id("quizzes")
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
    }
})

// Helper mutation to store quiz in database
export const storeQuiz = mutation({
    args: {
        title: v.string(),
        description: v.string(),
        questions: v.array(v.object({
            question: v.string(),
            options: v.array(v.string()),
            difficulty: v.union(
                v.literal("easy"),
                v.literal("medium"),
                v.literal("hard")
            ),
            questionType: v.union(
                v.literal("multiple_choice"),
                v.literal("true_false"),
                v.literal("multiple_selection")
            ),
            correctOptionIndex: v.number(),
            explanation: v.string(),
        })),
        quizContext: v.union(
            v.object({ type: v.literal("pdf"), fileUrl: v.string() }),
            v.object({ type: v.literal("url"), source: v.string() }),
            v.object({ type: v.literal("prompt"), text: v.string() })
        )
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("User not found");
        }
        // TODO: Get Target Audience from user profile or quiz settings
        // Get the user from database to get the proper user ID
        const user = await ctx.db
            .query("users")
            .withIndex("by_user_id", (q) => q.eq("userId", identity.subject))
            .first();

        if (!user) {
            throw new Error("User not found in database");
        }

        const quizId = await ctx.db.insert("quizzes", {
            title: args.title,
            description: args.description,
            questions: args.questions,
            quizContext: args.quizContext,
            createdBy: user._id
        });

        return quizId;
    }
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
    }
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
        const correctAnswers = attempt.questionAnswers.filter(a => a.isCorrect).length;
        const totalQuestions = quiz.questions.length;
        const score = Math.round((correctAnswers / totalQuestions) * 100);

        // Calculate XP (base 10 per correct answer, bonus for high scores)
        let expEarned = correctAnswers * 10;
        if (score >= 90) expEarned += 50; // Bonus for A
        else if (score >= 80) expEarned += 30; // Bonus for B
        else if (score >= 70) expEarned += 15; // Bonus for C

        // Update user's total XP
        await ctx.db.patch(user._id, {
            exp: (user.exp || 0) + expEarned
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

export const generateQuizFromContent = action({
    args: {
        contentType: v.union(
            v.literal("file"),
            v.literal("url"),
            v.literal("prompt")
        ),
        content: v.string(), // file URL, website URL, or text content
        quizSettings: v.object({
            difficulty: v.union(
                v.literal("mix"),
                v.literal("easy"),
                v.literal("medium"),
                v.literal("hard")
            ),
            questionCount: v.union(
                v.literal("5"),
                v.literal("10"),
                v.literal("15"),
                v.literal("30")
            )
        }),
        title: v.optional(v.string()) // optional title for text prompts
    },
    handler: async (ctx, args): Promise<{
        quizId: string;
        questionsCount: number;
        title: string;
    }> => {
        try {
            let summary: string;
            // biome-ignore lint/suspicious/noExplicitAny: AI API responses have dynamic structure
            let metadata: any;
            let quizContext: { type: "pdf"; fileUrl: string } | { type: "url"; source: string } | { type: "prompt"; text: string };

            // Step 1: Get summary based on content type
            switch (args.contentType) {
                case "file": {
                    // Call PDF summarizer
                    const result = await ctx.runAction(api.ai.pdfSummarizer, {
                        pdfPath: args.content,
                        targetAudience: "sma", // default
                    });
                    if (!result) {
                        throw new Error("Failed to get PDF summary");
                    }
                    summary = result.summary;
                    metadata = result.metadata;
                    quizContext = {
                        type: "pdf" as const,
                        fileUrl: args.content
                    };
                    break;
                }
                case "url": {
                    // Call website summarizer
                    const result = await ctx.runAction(api.ai.websiteSummarizer, {
                        url: args.content,
                        targetAudience: "sma", // default
                    });
                    if (!result) {
                        throw new Error("Failed to get website summary");
                    }
                    summary = result.summary;
                    metadata = result.metadata;
                    quizContext = {
                        type: "url" as const,
                        source: args.content
                    };
                    break;
                }
                case "prompt": {
                    // Call text summarizer
                    const result = await ctx.runAction(api.ai.textSummarizer, {
                        textContent: args.content,
                        targetAudience: "sma", // default
                        title: args.title || "Text Content"
                    });
                    if (!result) {
                        throw new Error("Failed to get text summary");
                    }
                    summary = result.summary;
                    metadata = result.metadata;
                    quizContext = {
                        type: "prompt" as const,
                        text: args.content
                    };
                    break;
                }
                default:
                    throw new Error("Invalid content type");
            }

            // Step 2: Convert quiz settings
            const numQuestions = Number.parseInt(args.quizSettings.questionCount);
            const difficulty = args.quizSettings.difficulty === "mix" ? "medium" : args.quizSettings.difficulty;

            // Remove metrics from metadata before passing to quizGenerator
            if (metadata?.metrics) {
                // biome-ignore lint/performance/noDelete: <explanation>
                delete metadata.metrics;
            }

            // Step 3: Generate quiz questions
            const quizData = await ctx.runAction(api.ai.quizGenerator, {
                summary,
                metadata,
                quizSettings: {
                    numQuestions,
                    difficulty,
                    targetAudience: "sma"
                }
            });

            if (!quizData) {
                throw new Error("Failed to generate quiz questions");
            }

            // Step 4: Store quiz in database - need to cast the questions to match schema
            const formattedQuestions = quizData.questions.map((q) => ({
                question: q.question,
                options: q.options,
                difficulty: q.difficulty as "easy" | "medium" | "hard",
                questionType: q.questionType as "multiple_choice" | "true_false" | "multiple_selection",
                correctOptionIndex: q.correctOptionIndex,
                explanation: q.explanation,
            }));

            const quizId: string = await ctx.runMutation(api.quizzes.storeQuiz, {
                title: quizData.title || metadata.sourceTitle || args.title || "Generated Quiz",
                description: quizData.description || `Quiz generated from ${args.contentType}`,
                questions: formattedQuestions,
                quizContext
            });

            return {
                quizId,
                questionsCount: formattedQuestions.length,
                title: quizData.title || metadata.sourceTitle || args.title || "Generated Quiz"
            };

        } catch (error) {
            console.error("Error generating quiz:", error);
            if (error instanceof Error) {
                throw new Error(`Failed to generate quiz: ${error.message}`);
            }
            throw new Error("Failed to generate quiz");
        }
    }
});