import { typedV } from "convex-helpers/validators";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Defines the database schema for the application.
 * This includes definitions for 'tasks' and 'users' tables.
 */
const schema = defineSchema({
	// users schema
	users: defineTable({
		username: v.string(),
		email: v.string(),
		userId: v.string(),
		// role: v.union(v.literal("admin"), v.literal("user")),
		profileImage: v.optional(v.string()),
		alreadyOnboarded: v.boolean(),
		exp: v.float64(),
		education_level: v.optional(
			v.union(
				v.literal("sd"),
				v.literal("smp"),
				v.literal("sma"),
				v.literal("kuliah"),
			),
		),
	}).index("by_user_id", ["userId"]),

	// quizzes schema
	quizzes: defineTable({
		createdBy: v.id("users"),
		description: v.string(),
		questions: v.array(
			v.object({
				correctOptionIndex: v.float64(),
				difficulty: v.string(),
				explanation: v.string(),
				options: v.array(v.string()),
				question: v.string(),
				questionType: v.string(),
			}),
		),
		quizContext: v.object({
			fileUrl: v.optional(v.string()),
			source: v.optional(v.string()),
			text: v.optional(v.string()),
			type: v.string(),
		}),
		title: v.string(),
	}).index("by_created_by", ["createdBy"]),

	// upload context schema either from pdf or url
	uploads: defineTable({
		associatedQuizId: v.optional(v.id("quizzes")),
		parsedText: v.optional(v.string()),
		sourceType: v.union(v.literal("pdf"), v.literal("url")),
		sourceUrl: v.string(),
		uploadedAt: v.float64(),
		userId: v.id("users"),
	})
		.index("by_quiz", ["associatedQuizId"])
		.index("by_user", ["userId"]),

	// quiz attempts schema
	quiz_attempts: defineTable({
		endedAt: v.optional(v.float64()),
		expEarned: v.float64(),
		questionAnswers: v.array(
			v.object({
				isCorrect: v.boolean(),
				questionIndex: v.float64(),
				selectedIndex: v.float64(),
				timeTaken: v.float64(),
			}),
		),
		quizId: v.id("quizzes"),
		startedAt: v.float64(),
		totalScore: v.float64(),
		userId: v.id("users"),
		feedback: v.optional(v.string()),
	})
		.index("by_quiz", ["quizId"])
		.index("by_user", ["userId"])
		.index("by_user_quiz", ["userId", "quizId"]),

	quiz_tasks: defineTable({
		userId: v.id("users"),
		status: v.union(
			v.literal("pending"),
			v.literal("summarizing_content"),
			v.literal("summary_completed"),
			v.literal("generating_questions"),
			v.literal("questions_generated"),
			v.literal("storing_quiz"),
			v.literal("completed"),
			v.literal("failed"),
		),
		statusMessage: v.optional(v.string()),
		// Original arguments for the quiz generation
		contentType: v.union(
			v.literal("file"),
			v.literal("url"),
			v.literal("prompt"),
		),
		content: v.string(), // file URL, website URL, or text content
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
		title: v.optional(v.string()), // optional title for text prompts

		// Intermediate results
		summary: v.optional(v.string()),
		metadata: v.optional(v.any()), // From summarization steps
		quizDataFromAI: v.optional(v.any()), // From quizGenerator AI call

		// Final result or error
		quizId: v.optional(v.id("quizzes")),
		error: v.optional(v.string()),

		createdAt: v.number(),
		updatedAt: v.number(),
	}).index("by_user", ["userId"]),

	multiplayer_rooms: defineTable({
		code: v.string(), // room code
		quizId: v.id("quizzes"),
		hostId: v.id("users"),
		status: v.union(
			v.literal("waiting"),
			v.literal("active"),
			v.literal("finished"),
		),
		currentQuestionIndex: v.number(),
		currentQuestionStartedAt: v.optional(v.number()),
	})
		.index("by_code", ["code"])
		.index("by_host", ["hostId"]),

	multiplayer_players: defineTable({
		roomId: v.id("multiplayer_rooms"),
		userId: v.id("users"),
		isHost: v.boolean(),
		joinedAt: v.number(),
		peerId: v.optional(v.string()),
		score: v.number(),
		questionAnswers: v.array(
			v.object({
				questionIndex: v.number(),
				selectedIndex: v.number(),
				isCorrect: v.boolean(),
				timeTaken: v.number(),
				answeredAt: v.number(),
			}),
		),
		hasAnsweredCurrentQuestion: v.boolean(),
	})
		.index("by_room", ["roomId"])
		.index("by_user", ["userId"])
		.index("by_room_user", ["roomId", "userId"]),
});

export default schema;

export const vv = typedV(schema);
