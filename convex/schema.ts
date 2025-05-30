import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Defines the database schema for the application.
 * This includes definitions for 'tasks' and 'users' tables.
 */
export default defineSchema({
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
	})
		.index("by_quiz", ["quizId"])
		.index("by_user", ["userId"])
		.index("by_user_quiz", ["userId", "quizId"]),
});
