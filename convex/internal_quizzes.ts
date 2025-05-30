import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./_generated/server";
import { vv } from "./schema";

// Called by startGenerateQuizWorkflow action
export const createQuizTask = internalMutation({
	args: {
		userId: vv.id("users"),
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
	handler: async (ctx, args): Promise<Id<"quiz_tasks">> => {
		const taskId = await ctx.db.insert("quiz_tasks", {
			userId: args.userId,
			contentType: args.contentType,
			content: args.content,
			quizSettings: args.quizSettings,
			title: args.title,
			status: "pending",
			statusMessage: "Quiz generation initiated.",
			createdAt: Date.now(),
			updatedAt: Date.now(),
			summary: undefined,
			metadata: undefined,
			quizDataFromAI: undefined,
			quizId: undefined,
			error: undefined,
		});
		return taskId;
	},
});

// Called by the workflow to get task details
export const getQuizTaskDetails = internalQuery({
	args: { taskId: vv.id("quiz_tasks") },
	handler: async (ctx, args): Promise<Doc<"quiz_tasks"> | null> => {
		return await ctx.db.get(args.taskId);
	},
});

// Called by the workflow to update task details
export const updateQuizTask = internalMutation({
	args: {
		taskId: vv.id("quiz_tasks"),
		status: v.optional(
			v.union(
				v.literal("pending"),
				v.literal("summarizing_content"),
				v.literal("summary_completed"),
				v.literal("generating_questions"),
				v.literal("questions_generated"),
				v.literal("storing_quiz"),
				v.literal("completed"),
				v.literal("failed"),
			),
		),
		statusMessage: v.optional(v.string()),
		summary: v.optional(v.string()),
		metadata: v.optional(v.any()),
		quizDataFromAI: v.optional(v.any()),
		quizId: v.optional(vv.id("quizzes")),
		error: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const { taskId, ...patchData } = args;
		await ctx.db.patch(taskId, {
			...patchData,
			updatedAt: Date.now(),
		});
	},
});
