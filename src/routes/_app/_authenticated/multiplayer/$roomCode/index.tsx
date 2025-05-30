import { Button } from "@/components/retroui/Button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge"; // Assuming Badge component exists
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "@cvx/_generated/api";
import type { Id } from "@cvx/_generated/dataModel"; // Adjusted to 'import type { Id }'
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	ChevronLeft,
	Copy,
	Loader2,
	PlayCircle,
	Trash,
	Users,
} from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

export const Route = createFileRoute(
	"/_app/_authenticated/multiplayer/$roomCode/",
)({
	component: RouteComponent,
});

function RouteComponent() {
	const { roomCode } = Route.useParams();
	const navigate = useNavigate();
	const { data: currentUser } = useQuery(
		convexQuery(api.app.getCurrentUser, {}),
	);

	const {
		data: lobbyData,
		isLoading: isLoadingLobby,
		error: lobbyError,
	} = useQuery(
		convexQuery(api.multiplayer.getRoomLobbyData, {
			roomCode: roomCode.toUpperCase(),
		}),
	);

	const { mutate: startGame, isPending: isStartingGame } = useMutation({
		mutationFn: useConvexMutation(api.multiplayer.startRoom),
		onSuccess: () => {
			toast.success("Quiz started! Let the games begin!");
			// Navigation to play page will be handled by useEffect watching room status
		},
		onError: (err) => {
			toast.error(err instanceof Error ? err.message : "Failed to start quiz");
		},
	});

	useEffect(() => {
		if (lobbyData?.status === "active") {
			navigate({
				to: "/multiplayer/$roomCode/play",
				params: { roomCode },
			});
		}
	}, [lobbyData?.status, navigate, roomCode]);

	const handleStartGame = () => {
		if (lobbyData?._id) {
			startGame({ roomId: lobbyData._id as Id<"multiplayer_rooms"> });
		}
	};

	const copyRoomCode = () => {
		navigator.clipboard
			.writeText(roomCode.toUpperCase())
			.then(() => toast.success("Room code copied to clipboard!"))
			.catch(() => toast.error("Failed to copy room code."));
	};

	if (isLoadingLobby) {
		return (
			<div className="flex flex-col items-center justify-center min-h-screen">
				<Loader2 className="h-12 w-12 animate-spin text-primary" />
				<p className="mt-4 text-lg">Loading Room...</p>
			</div>
		);
	}

	if (lobbyError || !lobbyData) {
		return (
			<div className="flex flex-col items-center justify-center min-h-screen p-4">
				<p className="text-2xl font-semibold text-destructive mb-4">
					{lobbyError ? "Error loading room" : "Room not found"}
				</p>
				<p className="text-muted-foreground mb-6 text-center">
					{lobbyError
						? lobbyError.message
						: `The room code "${roomCode.toUpperCase()}" might be invalid or the room may have expired.`}
				</p>

				<Link to="/dashboard">
					<Button>Go to Dashboard</Button>
				</Link>
			</div>
		);
	}

	const isHost = lobbyData.hostId === currentUser?._id;
	return (
		<div className="container mx-auto max-w-2xl py-8 px-4 min-h-screen flex flex-col">
			<Link
				to="/dashboard"
				className="absolute top-4 left-4 text-muted-foreground hover:text-foreground"
			>
				<ChevronLeft size={24} />
			</Link>

			<Card className="w-full shadow-xl flex-grow flex flex-col">
				<CardHeader className="text-center">
					<CardTitle className="text-3xl font-bold">
						Multiplayer Lobby
					</CardTitle>
					<CardDescription>
						Get ready to challenge your friends!
					</CardDescription>
					<div className="mt-4">
						<p className="text-sm text-muted-foreground">ROOM CODE:</p>
						<Badge
							variant="secondary"
							className="text-2xl font-mono tracking-widest p-3 cursor-pointer"
							onClick={copyRoomCode}
						>
							{lobbyData.code}
							<Copy size={18} className="ml-3" />
						</Badge>
					</div>
				</CardHeader>

				<CardContent className="flex-grow space-y-6">
					<div className="text-center">
						<h3 className="text-xl font-semibold">{lobbyData.quiz.title}</h3>
						<p className="text-sm text-muted-foreground">
							{lobbyData.quiz.description}
						</p>
						<p className="text-sm text-muted-foreground">
							{lobbyData.quiz.questionCount} Questions
						</p>
					</div>

					<div>
						<h4 className="text-lg font-semibold mb-3 flex items-center">
							<Users size={20} className="mr-2" /> Participants (
							{lobbyData.players.length})
						</h4>
						<ul className="space-y-3 max-h-60 overflow-y-auto bg-muted/50 p-3 rounded-md">
							{lobbyData.players.map((player) => (
								<li
									key={player.userId}
									className="flex items-center justify-between p-2 bg-background rounded-md shadow-sm"
								>
									<div className="flex items-center">
										<Avatar className="h-8 w-8 mr-3">
											<AvatarImage
												src={player.profileImage}
												alt={player.username}
											/>
											<AvatarFallback>
												{player.username?.substring(0, 2).toUpperCase()}
											</AvatarFallback>
										</Avatar>
										<span className="font-medium">{player.username}</span>
									</div>
									{player.userId === lobbyData.hostId && (
										<Badge variant="outline" className="text-xs">
											Host
										</Badge>
									)}
								</li>
							))}
						</ul>
					</div>
				</CardContent>

				<CardFooter className="mt-auto">
					{isHost && lobbyData.status === "waiting" && (
						<div className="flex w-full items-center justify-center gap-2">
							<Button
								className="bg-destructive text-white hover:bg-destructive/90"
								size={"icon"}
							>
								<Trash />
							</Button>
							<Button
								className="w-full text-lg flex items-center gap-2"
								onClick={handleStartGame}
								disabled={
									isStartingGame ||
									lobbyData.players.length < 1 /* Consider min players? */
								}
							>
								{isStartingGame ? (
									<>
										<Loader2 className="mr-2 h-5 w-5 animate-spin" />{" "}
										Starting...
									</>
								) : (
									<>
										<PlayCircle size={20} className="mr-2" /> Start Quiz
									</>
								)}
							</Button>
						</div>
					)}
					{lobbyData.status === "active" && (
						<p className="text-center w-full text-green-500 font-semibold">
							Quiz is active! Redirecting...
						</p>
					)}
					{lobbyData.status === "finished" && (
						<p className="text-center w-full text-blue-500 font-semibold">
							This quiz has finished.
						</p>
						// TODO: Add button to view results
					)}
				</CardFooter>
			</Card>
		</div>
	);
}
