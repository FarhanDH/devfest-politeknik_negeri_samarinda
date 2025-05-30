import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "@cvx/_generated/api";
import type { Id } from "@cvx/_generated/dataModel";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { VideoRoom } from "./-video-room";

export const Route = createFileRoute("/_app/_authenticated/playground/")({
	component: RouteComponent,
});

function RouteComponent() {
	const [roomId, setRoomId] = useState<Id<"rooms"> | null>(null);

	return (
		<div className="w-full max-w-4xl mx-auto">
			{roomId ? (
				<VideoRoom roomId={roomId} onLeave={() => setRoomId(null)} />
			) : (
				<JoinRoom onJoin={setRoomId} />
			)}
		</div>
	);
}

function JoinRoom({ onJoin }: { onJoin: (roomId: Id<"rooms">) => void }) {
	const [roomInput, setRoomInput] = useState("");
	const [isCreating, setIsCreating] = useState(false);
	const [roomName, setRoomName] = useState("");

	const createRoom = useMutation({
		mutationFn: useConvexMutation(api.rooms.createRoom),
	});
	const rooms = useQuery(convexQuery(api.rooms.listRooms, {})) || [];

	/**
	 * Handles joining a room.
	 *
	 * Prevents default form submission. If a room is found with the inputted ID,
	 * calls `onJoin` with the room ID. Otherwise, displays an error toast.
	 *
	 * @param {React.FormEvent} e - The form event
	 */
	const handleJoin = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			const room = rooms.data?.find(
				(r) => r._id === (roomInput as Id<"rooms">),
			);
			if (!room) {
				toast.error("Room not found");
				return;
			}

			onJoin(roomInput as Id<"rooms">);
		} catch (err) {
			toast.error("Invalid room ID");
		}
	};

	const handleCreate = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			const newRoomId = await createRoom.mutateAsync({ name: roomName });
			setIsCreating(false);
			onJoin(newRoomId);
		} catch (err) {
			toast.error("Failed to create room");
		}
	};

	if (isCreating) {
		return (
			<div className="flex flex-col gap-4 items-center">
				<h1 className="text-3xl font-bold">Create a Room</h1>
				<form
					onSubmit={handleCreate}
					className="flex flex-col gap-4 w-full max-w-md"
				>
					<input
						type="text"
						value={roomName}
						onChange={(e) => setRoomName(e.target.value)}
						placeholder="Room Name"
						className="px-4 py-2 border rounded-lg"
					/>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={() => setIsCreating(false)}
							className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={!roomName}
							className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
						>
							Create
						</button>
					</div>
				</form>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4 items-center">
			<h1 className="text-3xl font-bold">Join a Room</h1>
			<div className="flex gap-4">
				<form onSubmit={handleJoin} className="flex gap-2">
					<select
						value={roomInput}
						onChange={(e) => setRoomInput(e.target.value)}
						className="px-4 py-2 border rounded-lg"
					>
						<option value="">Select a Room</option>
						{rooms.data?.map((room) => (
							<option key={room._id} value={room._id}>
								{room.name}
							</option>
						))}
					</select>
					<button
						type="submit"
						disabled={!roomInput}
						className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
					>
						Join
					</button>
				</form>
				{/* biome-ignore lint/a11y/useButtonType: <explanation> */}
				<button
					onClick={() => setIsCreating(true)}
					className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
				>
					Create Room
				</button>
			</div>
		</div>
	);
}
