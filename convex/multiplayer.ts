import { v } from "convex/values";
import { nanoid } from "nanoid"; // Ensure nanoid is installed: npm install nanoid
import { api, internal } from "./_generated/api"; // Import api and internal
import { internalMutation, mutation, query } from "./_generated/server";
import { assertUserAuthenticated } from "./users";

const QUESTION_TIMEOUT_MS = 20000; // 20 seconds per question

// Mutations

/**
 * Creates a new multiplayer quiz room.
 * - Generates a unique room code.
 * - Adds the host (authenticated user) to the room.
 * - Returns the roomId and roomCode.
 */
export const createRoom = mutation({
	args: { quizId: v.id("quizzes") },
	handler: async (ctx, args) => {
		const user = await assertUserAuthenticated(ctx);

		const roomCode = nanoid(6).toUpperCase(); // Generate a 6-character uppercase room code

		const roomId = await ctx.db.insert("multiplayer_rooms", {
			code: roomCode,
			quizId: args.quizId,
			hostId: user._id,
			status: "waiting",
			currentQuestionIndex: -1, // Will be set to 0 when quiz starts
			// currentQuestionStartedAt will be set when a question starts
		});

		await ctx.db.insert("multiplayer_players", {
			roomId: roomId,
			userId: user._id,
			isHost: true,
			joinedAt: Date.now(),
			score: 0,
			questionAnswers: [],
			hasAnsweredCurrentQuestion: false,
		});

		return { roomId, roomCode };
	},
});

// Get room participants
export const getRoomParticipants = query({
	args: { roomCode: v.string() },
	handler: async (ctx, args) => {
		const room = await ctx.db
			.query("multiplayer_rooms")
			.withIndex("by_code", (q) => q.eq("code", args.roomCode))
			.unique();
		if (!room) {
			throw new Error("Ruang tidak ditemukan.");
		}
		const participants = await ctx.db
			.query("multiplayer_players")
			.withIndex("by_room", (q) => q.eq("roomId", room._id))
			.collect();
		return participants;
	},
});

export const leaveMultiplayerRoom = mutation({
	args: {
		roomCode: v.string(),
	},
	handler: async (ctx, args) => {
		const user = await assertUserAuthenticated(ctx);

		const room = await ctx.db
			.query("multiplayer_rooms")
			.withIndex("by_code", (q) => q.eq("code", args.roomCode))
			.unique();
		if (!room) {
			throw new Error("Ruang tidak ditemukan.");
		}

		const playerToRemove = await ctx.db
			.query("multiplayer_players")
			.withIndex("by_room_user", (q) =>
				q.eq("roomId", room._id).eq("userId", user._id),
			)
			.unique();

		if (!playerToRemove) {
			// console.warn("Player trying to leave a room they are not in:", { roomId: args.roomId, userId: user._id });
			return { success: false, message: "Pemain tidak ditemukan di dalam ruangan ini." };
		}

		const wasHost = playerToRemove.isHost;
		await ctx.db.delete(playerToRemove._id);

		const remainingPlayers = await ctx.db
			.query("multiplayer_players")
			.withIndex("by_room", (q) => q.eq("roomId", room._id))
			.collect();

		if (remainingPlayers.length === 0) {
			await ctx.db.delete(room._id);
			// console.log(`Room ${args.roomId} deleted as it became empty.`);
			return {
				success: true,
				message:
					"Berhasil keluar dari ruangan. Ruangan kosong dan telah dihapus.",
			};
		}
		// Ensure there are players left to be a host
		if (remainingPlayers.length > 0) {
			const sortedPlayersByJoinTime = remainingPlayers.sort(
				(a, b) => a.joinedAt - b.joinedAt,
			);
			const newHostPlayer = sortedPlayersByJoinTime[0];

			await ctx.db.patch(newHostPlayer._id, { isHost: true });
			await ctx.db.patch(room._id, { hostId: newHostPlayer.userId });
			// console.log(`Host left room ${args.roomId}. New host assigned: ${newHostPlayer.userId}`);
			return {
				success: true,
				message: "Berhasil keluar dari ruangan. Host baru telah ditunjuk.",
			};
		}
		// This case implies the host was the last player, and the room should be deleted.
		// This should ideally be caught by remainingPlayers.length === 0, but as a fallback:
		await ctx.db.delete(room._id);
		return {
			success: true,
			message:
				"Berhasil keluar dari ruangan. Ruangan kosong dan telah dihapus karena host adalah pemain terakhir.",
		};
	},
});

/**
 * Allows a player to join an existing multiplayer quiz room.
 * - Validates the room code and room status.
 * - Adds the player to the room if not already joined.
 * - Returns the roomId.
 */
export const joinRoom = mutation({
	args: { roomCode: v.string() },
	handler: async (ctx, args) => {
		const user = await assertUserAuthenticated(ctx);

		const room = await ctx.db
			.query("multiplayer_rooms")
			.withIndex("by_code", (q) => q.eq("code", args.roomCode.toUpperCase()))
			.unique();

		if (!room) {
			throw new Error("Ruang tidak ditemukan. Silakan periksa kode dan coba lagi.");
		}

		if (room.status !== "waiting") {
			throw new Error("Ruangan ini tidak lagi menerima pemain baru.");
		}

		// Check if player is already in the room
		const existingPlayer = await ctx.db
			.query("multiplayer_players")
			.withIndex("by_room_user", (q) =>
				q.eq("roomId", room._id).eq("userId", user._id),
			)
			.unique();

		if (existingPlayer) {
			// Player is already in the room, perhaps they reconnected.
			// If status is 'waiting', it's fine. If 'active', they should be able to rejoin game page.

			return { roomId: room._id, alreadyInRoom: true };
		}

		await ctx.db.insert("multiplayer_players", {
			roomId: room._id,
			userId: user._id,
			isHost: false, // Only the creator is host
			joinedAt: Date.now(),
			score: 0,
			questionAnswers: [],
			hasAnsweredCurrentQuestion: false,
		});

		return { roomId: room._id, alreadyInRoom: false };
	},
});

/**
 * Starts the multiplayer quiz for a given room.
 * - Only the host can start the quiz.
 * - Updates room status to 'active', sets the first question, and starts the timer.
 * - Resets 'hasAnsweredCurrentQuestion' for all players.
 * - Schedules the first question timeout.
 */
export const setPeerId = mutation({
	args: {
		multiplayerPlayerId: v.id("multiplayer_players"),
		peerId: v.string(),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.multiplayerPlayerId, {
			peerId: args.peerId,
		});
	},
});

export const startRoom = mutation({
	args: { roomId: v.id("multiplayer_rooms") },
	handler: async (ctx, args) => {
		const user = await assertUserAuthenticated(ctx);
		const room = await ctx.db.get(args.roomId);

		if (!room) {
			throw new Error("Room not found.");
		}

		if (room.hostId !== user._id) {
			throw new Error("Hanya host yang dapat memulai kuis.");
		}

		if (room.status !== "waiting") {
			throw new Error(
				"Kuis tidak dapat dimulai. Mungkin sudah aktif atau telah selesai.",
			);
		}

		// Update room state
		await ctx.db.patch(args.roomId, {
			status: "active",
			currentQuestionIndex: 0,
			currentQuestionStartedAt: Date.now(),
		});

		// Reset hasAnsweredCurrentQuestion for all players in the room
		const players = await ctx.db
			.query("multiplayer_players")
			.withIndex("by_room", (q) => q.eq("roomId", args.roomId))
			.collect();

		for (const player of players) {
			await ctx.db.patch(player._id, { hasAnsweredCurrentQuestion: false });
		}

		// Schedule the timeout for the first question
		await ctx.scheduler.runAfter(
			QUESTION_TIMEOUT_MS,
			internal.multiplayer.internalHandleQuestionTimeout, // Correctly reference internal function
			{ roomId: args.roomId, expectedQuestionIndex: 0 }, // For the first question
		);

		return { success: true };
	},
});

/**
 * Submits an answer for the current question in a multiplayer quiz.
 * - Validates room status, question index, and if the player has already answered.
 * - Records the answer, calculates if it's correct, and updates the player's score.
 * - Sets 'hasAnsweredCurrentQuestion' to true for the player.
 */
export const submitAnswer = mutation({
	args: {
		roomId: v.id("multiplayer_rooms"),
		questionIndex: v.number(),
		selectedIndex: v.number(),
		timeTaken: v.number(), // Time in milliseconds
	},
	handler: async (ctx, args) => {
		const user = await assertUserAuthenticated(ctx);
		const room = await ctx.db.get(args.roomId);

		if (!room) {
			throw new Error("Room not found.");
		}

		if (room.status !== "active") {
			throw new Error("Quiz is not active. Answers cannot be submitted.");
		}

		if (room.currentQuestionIndex !== args.questionIndex) {
			throw new Error("Answer submitted for an incorrect question index.");
		}

		const player = await ctx.db
			.query("multiplayer_players")
			.withIndex("by_room_user", (q) =>
				q.eq("roomId", args.roomId).eq("userId", user._id),
			)
			.unique();

		if (!player) {
			throw new Error("Player not found in this room.");
		}

		if (player.hasAnsweredCurrentQuestion) {
			throw new Error("You have already answered this question.");
		}

		const quiz = await ctx.db.get(room.quizId);
		if (!quiz) {
			throw new Error("Quiz data not found for this room.");
		}

		const question = quiz.questions[args.questionIndex];
		if (!question) {
			throw new Error("Question not found in quiz data.");
		}

		const isCorrect = question.correctOptionIndex === args.selectedIndex;
		const scoreEarned = isCorrect ? 10 : 0; // Simple scoring: 10 points for correct

		await ctx.db.patch(player._id, {
			questionAnswers: [
				...player.questionAnswers,
				{
					questionIndex: args.questionIndex,
					selectedIndex: args.selectedIndex,
					isCorrect: isCorrect,
					timeTaken: args.timeTaken,
					answeredAt: Date.now(),
				},
			],
			score: player.score + scoreEarned,
			hasAnsweredCurrentQuestion: true,
		});

		// After submitting, attempt to advance the question.
		// This will check if all players have answered.
		// The timeout is handled separately by the scheduled internalHandleQuestionTimeout.
		await ctx.runMutation(api.multiplayer.advanceToNextQuestionOrFinish, {
			// Use api.multiplayer
			roomId: args.roomId,
		});

		return { success: true, isCorrect };
	},
});

/**
 * Advances the quiz to the next question or finishes it if all questions are done.
 * This can be triggered by all players answering or by a timeout.
 */
export const advanceToNextQuestionOrFinish = mutation({
	args: { roomId: v.id("multiplayer_rooms") },
	handler: async (ctx, args) => {
		const room = await ctx.db.get(args.roomId);
		if (!room || room.status !== "active") {
			// Quiz is not active or doesn't exist
			return { status: "no_action_quiz_not_active" };
		}

		const quiz = await ctx.db.get(room.quizId);
		if (!quiz) {
			throw new Error("Quiz data not found for this room.");
		}

		const players = await ctx.db
			.query("multiplayer_players")
			.withIndex("by_room", (q) => q.eq("roomId", args.roomId))
			.collect();

		const allAnswered = players.every((p) => p.hasAnsweredCurrentQuestion);
		const timeElapsed = room.currentQuestionStartedAt
			? Date.now() >= room.currentQuestionStartedAt + QUESTION_TIMEOUT_MS
			: false;

		if (!allAnswered && !timeElapsed) {
			// Not all players answered and time is not up yet
			return { status: "no_action_waiting_for_players_or_timeout" };
		}

		// Proceed to next question or finish quiz
		const nextQuestionIndex = room.currentQuestionIndex + 1;

		if (nextQuestionIndex < quiz.questions.length) {
			// More questions available
			await ctx.db.patch(args.roomId, {
				currentQuestionIndex: nextQuestionIndex,
				currentQuestionStartedAt: Date.now(),
			});

			for (const player of players) {
				await ctx.db.patch(player._id, { hasAnsweredCurrentQuestion: false });
			}

			// Schedule timeout for the new question
			await ctx.scheduler.runAfter(
				QUESTION_TIMEOUT_MS,
				internal.multiplayer.internalHandleQuestionTimeout, // Correctly reference internal function
				{ roomId: args.roomId, expectedQuestionIndex: nextQuestionIndex },
			);
			return { status: "advanced_to_next_question" };
		}
		// Last question was answered, or timed out
		await ctx.db.patch(args.roomId, {
			status: "finished",
			currentQuestionStartedAt: undefined, // Clear the start time as quiz is over
		});
		return { status: "quiz_finished" };
	},
});

/**
 * Internal mutation to handle question timeouts.
 * Called by the scheduler.
 */
export const internalHandleQuestionTimeout = internalMutation({
	args: {
		roomId: v.id("multiplayer_rooms"),
		expectedQuestionIndex: v.number(),
	},
	handler: async (ctx, args) => {
		const room = await ctx.db.get(args.roomId);

		// If room is no longer active or the question has already advanced, do nothing.
		if (
			!room ||
			room.status !== "active" ||
			room.currentQuestionIndex !== args.expectedQuestionIndex
		) {
			console.log(
				`Timeout for room ${args.roomId}, question ${args.expectedQuestionIndex} is stale. Current index: ${room?.currentQuestionIndex}, status: ${room?.status}`,
			);
			return;
		}

		console.log(
			`Timeout triggered for room ${args.roomId}, question ${args.expectedQuestionIndex}. Advancing.`,
		);
		// Call the public mutation to advance the question
		await ctx.runMutation(api.multiplayer.advanceToNextQuestionOrFinish, {
			// Use api.multiplayer
			roomId: args.roomId,
		});
	},
});

// Queries

export const deleteRoom = mutation({
	args: { roomId: v.id("multiplayer_rooms") },
	handler: async (ctx, args) => {
		const user = await assertUserAuthenticated(ctx);
		const room = await ctx.db.get(args.roomId);

		if (!room) {
			throw new Error("Room not found.");
		}

		if (room.hostId !== user._id) {
			throw new Error("Only the host can delete the room.");
		}

		// Delete all players in the room
		const playersInRoom = await ctx.db
			.query("multiplayer_players")
			.withIndex("by_room", (q) => q.eq("roomId", args.roomId))
			.collect();

		for (const player of playersInRoom) {
			await ctx.db.delete(player._id);
		}

		// Delete the room itself
		await ctx.db.delete(args.roomId);

		// TODO: Cancel any scheduled functions associated with this room if applicable
		// For example, if internalHandleQuestionTimeout was scheduled for this room.
		// This might require storing scheduler IDs or using a more robust cleanup mechanism.

		return { success: true, message: "Room deleted successfully." };
	},
});

/**
 * Fetches data for the multiplayer room lobby.
 * Includes room details, quiz details, and list of players with their usernames.
 */
export const getRoomLobbyData = query({
	args: { roomCode: v.string() }, // Changed from roomId to roomCode
	handler: async (ctx, args) => {
		const room = await ctx.db
			.query("multiplayer_rooms")
			.withIndex("by_code", (q) => q.eq("code", args.roomCode.toUpperCase()))
			.unique();

		if (!room) {
			return null; // Or throw new Error("Room not found. Please check the code.");
		}

		const quiz = await ctx.db.get(room.quizId);
		if (!quiz) {
			// This should ideally not happen if data integrity is maintained
			throw new Error("Associated quiz not found for this room.");
		}

		const playersInRoom = await ctx.db
			.query("multiplayer_players")
			.withIndex("by_room", (q) => q.eq("roomId", room._id)) // Use room._id obtained from roomCode lookup
			.collect();

		const playersData = await Promise.all(
			playersInRoom.map(async (player) => {
				const userProfile = await ctx.db.get(player.userId);
				return {
					_id: player._id,
					userId: player.userId,
					username: userProfile?.username ?? "Unknown Player",
					profileImage: userProfile?.profileImage,
					isHost: player.isHost,
					joinedAt: player.joinedAt,
					// Do not include score or answers in lobby data for privacy/simplicity
				};
			}),
		);

		return {
			_id: room._id,
			code: room.code,
			status: room.status,
			hostId: room.hostId,
			quiz: {
				_id: quiz._id,
				title: quiz.title,
				description: quiz.description,
				questionCount: quiz.questions.length,
			},
			players: playersData.sort((a, b) => a.joinedAt - b.joinedAt), // Sort by join time
		};
	},
});

/**
 * Fetches data for playing a multiplayer quiz.
 * Includes room state, full quiz questions, and current player's status.
 */
export const getMultiplayerQuizPlayData = query({
	args: { roomCode: v.string() }, // Changed from roomId to roomCode
	handler: async (ctx, args) => {
		const user = await assertUserAuthenticated(ctx); // Ensure user is logged in
		// Fetch room by code
		const room = await ctx.db
			.query("multiplayer_rooms")
			.withIndex("by_code", (q) => q.eq("code", args.roomCode.toUpperCase()))
			.unique();

		if (!room) {
			return { error: "Room not found. Please check the code." };
		}

		// Potentially allow rejoining a finished room to see results,
		// but play page should primarily be for 'active' rooms.
		if (room.status !== "active" && room.status !== "finished") {
			return {
				error: "Quiz is not active or has not finished yet.",
				status: room.status,
			};
		}

		const quiz = await ctx.db.get(room.quizId);
		if (!quiz) {
			return { error: "Quiz data not found." };
		}

		const currentPlayer = await ctx.db
			.query("multiplayer_players")
			.withIndex(
				"by_room_user",
				(q) => q.eq("roomId", room._id).eq("userId", user._id), // Use room._id from the fetched room
			)
			.unique();

		if (!currentPlayer) {
			// This might happen if a user tries to access a play URL for a room they haven't joined
			return { error: "Player not found in this room." };
		}

		// For active games, only send the current question to prevent cheating?
		// Or send all questions and let client manage display.
		// For simplicity now, sending all. Consider implications.
		// Also, client needs all questions to show progress (e.g. Q 1 of 10).

		return {
			room: {
				_id: room._id,
				status: room.status,
				currentQuestionIndex: room.currentQuestionIndex,
				currentQuestionStartedAt: room.currentQuestionStartedAt,
				hostId: room.hostId,
			},
			quiz: {
				_id: quiz._id,
				title: quiz.title,
				questions: quiz.questions, // Send all questions
			},
			currentPlayer: {
				_id: currentPlayer._id,
				userId: currentPlayer.userId,
				score: currentPlayer.score,
				// Only include answers relevant for the current question or all for review?
				// For play, 'hasAnsweredCurrentQuestion' is most relevant for current question.
				hasAnsweredCurrentQuestion: currentPlayer.hasAnsweredCurrentQuestion,
				// To show past answers if needed, or for a review mode:
				// questionAnswers: currentPlayer.questionAnswers,
			},
			// Optionally, include all players for a live scoreboard if desired
			allPlayers: await Promise.all(
				(
					await ctx.db
						.query("multiplayer_players")
						.withIndex("by_room", (q) => q.eq("roomId", room._id))
						.collect()
				).map(async (p) => {
					const userProfile = await ctx.db.get(p.userId);
					return {
						userId: p.userId,
						username: userProfile?.username ?? "Player",
						profileImage: userProfile?.profileImage,
						score: p.score,
						hasAnsweredCurrentQuestion: p.hasAnsweredCurrentQuestion,
						isHost: p.isHost, // Might be useful to indicate the host
					};
				}),
			),
		};
	},
});

// Query to fetch data for the results page
export const getMultiplayerQuizResultsData = query({
	args: { roomCode: v.string() },
	handler: async (ctx, args) => {
		const room = await ctx.db
			.query("multiplayer_rooms")
			.withIndex("by_code", (q) => q.eq("code", args.roomCode.toUpperCase()))
			.unique();

		if (!room) {
			return { error: "Room not found. Please check the code." };
		}

		// Results are typically for finished quizzes, but can be fetched for active/finished ones.
		if (room.status !== "finished" && room.status !== "active") {
			return {
				error: "Quiz is not yet finished or active.",
				status: room.status,
			};
		}

		const quiz = await ctx.db.get(room.quizId);
		if (!quiz) {
			return { error: "Quiz data not found." };
		}

		const playersInRoom = await ctx.db
			.query("multiplayer_players")
			.withIndex("by_room", (q) => q.eq("roomId", room._id))
			.collect();

		const playersData = await Promise.all(
			playersInRoom.map(async (p) => {
				const userProfile = await ctx.db.get(p.userId);
				return {
					userId: p.userId,
					username: userProfile?.username ?? "Player",
					profileImage: userProfile?.profileImage,
					score: p.score,
					isHost: p.isHost,
					// You could add more details here if needed, e.g., number of correct answers
				};
			}),
		);

		// Sort players by score descending, then by username ascending as a tie-breaker
		const sortedPlayers = playersData.sort((a, b) => {
			if (b.score === a.score) {
				return a.username.localeCompare(b.username);
			}
			return b.score - a.score;
		});

		return {
			quizTitle: quiz.title,
			roomStatus: room.status,
			players: sortedPlayers,
			hostId: room.hostId,
			quizId: quiz._id, // Useful for linking back to the quiz details
		};
	},
});
