import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const createRoom = mutation({
	args: { name: v.string() },
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throw new Error("Not authenticated");
		const user = await ctx.db
			.query("users")
			.withIndex("by_user_id", (q) => q.eq("userId", identity.subject))
			.first();
		const userId = user?._id;
		if (!userId) throw new Error("Not authenticated");
		return await ctx.db.insert("rooms", {
			name: args.name,
			createdBy: userId,
		});
	},
});

export const listRooms = query({
	args: {},
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throw new Error("Not authenticated");
		const user = await ctx.db
			.query("users")
			.withIndex("by_user_id", (q) => q.eq("userId", identity.subject))
			.first();
		const userId = user?._id;
		if (!userId) throw new Error("Not authenticated");
		return await ctx.db.query("rooms").collect();
	},
});

export const joinRoom = mutation({
	args: {
		roomId: v.id("rooms"),
		peerId: v.string(),
	},
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throw new Error("Not authenticated");
		const user = await ctx.db
			.query("users")
			.withIndex("by_user_id", (q) => q.eq("userId", identity.subject))
			.first();
		const userId = user?._id;
		if (!userId) throw new Error("Not authenticated");

		const room = await ctx.db.get(args.roomId);
		if (!room) throw new Error("Room not found");

		// Remove any existing participant entries for this user
		const existing = await ctx.db
			.query("participants")
			.filter((q) => q.eq(q.field("userId"), userId))
			.filter((q) => q.eq(q.field("roomId"), args.roomId))
			.collect();

		for (const participant of existing) {
			await ctx.db.delete(participant._id);
		}

		await ctx.db.insert("participants", {
			roomId: args.roomId,
			userId,
			peerId: args.peerId,
		});
	},
});

export const leaveRoom = mutation({
	args: { roomId: v.id("rooms") },
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throw new Error("Not authenticated");
		const user = await ctx.db
			.query("users")
			.withIndex("by_user_id", (q) => q.eq("userId", identity.subject))
			.first();
		const userId = user?._id;
		if (!userId) throw new Error("Not authenticated");

		const participants = await ctx.db
			.query("participants")
			.filter((q) => q.eq(q.field("roomId"), args.roomId))
			.filter((q) => q.eq(q.field("userId"), userId))
			.collect();

		for (const participant of participants) {
			await ctx.db.delete(participant._id);
		}
	},
});

export const getRoomParticipants = query({
	args: { roomId: v.id("rooms") },
	handler: async (ctx, args) => {
		const participants = await ctx.db
			.query("participants")
			.withIndex("by_room", (q) => q.eq("roomId", args.roomId))
			.collect();

		return Promise.all(
			participants.map(async (p) => {
				const user = await ctx.db.get(p.userId);
				return {
					...p,
					user: user
						? {
								name: user.username,
								email: user.email,
							}
						: null,
				};
			}),
		);
	},
});
