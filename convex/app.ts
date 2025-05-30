import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { createOrUpdateUser } from "./users";

/**
 * Completes the onboarding process for a new user.
 *
 * @param username - The desired username for the user.
 * @returns The created or updated user object.
 * @throws Error if the user is not authenticated or if user creation fails.
 */
export const completeOnboardingUsernameStep = mutation({
	args: {
		username: v.string(),
	},

	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw new Error("User not authenticated");
		}

		const user = await createOrUpdateUser(ctx, identity.subject, {
			username: args.username,
			email: identity.email as string,
			profileImage: identity.pictureUrl || "",
			userId: identity.subject,
			alreadyOnboarded: false,
			exp: identity.exp ? Number(identity.exp) : 0,
		});

		if (!user) {
			throw new Error("Failed to create user");
		}

		return user;
	},
});

export const completeOnboardingEducationLevelStep = mutation({
	args: {
		educationLevel: v.union(
			v.literal("sd"),
			v.literal("smp"),
			v.literal("sma"),
			v.literal("kuliah"),
		),
	},
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw new Error("User not authenticated");
		}

		const user = await ctx.db
			.query("users")
			.withIndex("by_user_id", (q) => q.eq("userId", identity.subject))
			.first();

		if (!user) {
			throw new Error("User not found");
		}

		await ctx.db.patch(user._id, {
			alreadyOnboarded: true,
			education_level: args.educationLevel,
		});

		return user;
	},
});

/**
 * Generates a URL for uploading files.
 *
 * @returns A promise that resolves to the upload URL.
 * @throws Error if the user is not authenticated.
 */
export const generateUploadUrl = mutation({
	args: {},
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity;
		if (!identity) {
			throw new Error("User not found");
		}
		return await ctx.storage.generateUploadUrl();
	},
});

// Get a URL to download an uploaded file with proper content type
export const getFileUrl = query({
	args: {
		storageId: v.string(),
		contentType: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		console.log(`[getFileUrl] Getting URL for storage ID: ${args.storageId}`);

		try {
			// Try to determine content type from the storageId or provided parameter
			let imageContentType = args.contentType || "image/png";

			// Check the storage ID for file extension clues
			const storageId = args.storageId;
			if (storageId.includes(".jpg") || storageId.includes(".jpeg")) {
				imageContentType = "image/jpeg";
			} else if (storageId.includes(".svg")) {
				imageContentType = "image/svg+xml";
			} else if (storageId.includes(".png")) {
				imageContentType = "image/png";
			}

			console.log(`[getFileUrl] Using content type: ${imageContentType}`);

			// Get URL from storage
			// Unfortunately, Convex storage.getUrl() doesn't accept content type parameters
			// But we're logging this information for debugging purposes
			const url = await ctx.storage.getUrl(args.storageId);

			if (!url) {
				console.log(
					`[getFileUrl] Failed to get URL for storage ID: ${args.storageId}`,
				);
				return null;
			}

			console.log(`[getFileUrl] Generated URL: ${url}`);
			return url;
		} catch (error) {
			console.error("[getFileUrl] Error getting URL:", error);
			return null;
		}
	},
});

export const deleteFile = mutation({
	args: {
		storageId: v.id("_storage"),
	},
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw new Error("User not found");
		}

		const file = await ctx.db.system.get(args.storageId);
		if (!file) {
			throw new Error("File not found");
		}
		await ctx.storage.delete(args.storageId);
	},
});

/**
 * Retrieves the currently authenticated user.
 *
 * @returns A promise that resolves to the user object or null if not found or not authenticated.
 */
export const getCurrentUser = query({
	args: {},
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			return null;
		}

		const userData = await ctx.db
			.query("users")
			.withIndex("by_user_id", (q) => q.eq("userId", identity.subject))
			.first();

		if (!userData) {
			return null;
		}

		return userData;
	},
});

/**
 * Deletes the account of the currently authenticated user.
 *
 * @throws Error if the user is not authenticated or not found.
 */
export const deleteCurrentUserAccount = mutation({
	args: {},
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			return;
		}
		const user = await ctx.db
			.query("users")
			.withIndex("by_user_id", (q) => q.eq("userId", identity.subject))
			.first();

		if (!user) {
			throw new Error("User not found");
		}

		await ctx.db.delete(user._id);
	},
});

export const getLeaderboard = query({
	args: {},
	handler: async (ctx) => {
		const leaderboard = await ctx.db.query("users").collect();
		const topTenHighestExpUsers = leaderboard
			.sort((a, b) => b.exp - a.exp)
			.slice(0, 10);

		return topTenHighestExpUsers;
	},
});
