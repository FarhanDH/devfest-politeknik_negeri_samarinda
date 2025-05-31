import { Button } from "@/components/retroui/Button";
import { Card } from "@/components/retroui/Card";
import { Text } from "@/components/retroui/Text";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
			toast.success("Kuis dimulai! Mulai bermain!");
			// Navigation to play page will be handled by useEffect watching room status
		},
		onError: (err) => {
			toast.error(err instanceof Error ? err.message : "Gagal memulai kuis");
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
			.then(() => toast.success("Kode ruangan berhasil disalin!"))
			.catch(() => toast.error("Gagal menyalin kode ruangan."));
	};

	if (isLoadingLobby) {
		return (
			<div className="flex flex-col items-center justify-center min-h-screen bg-[var(--background)]">
				<Loader2 className="h-12 w-12 animate-spin text-[var(--primary)]" />
				<Text as="p" className="mt-4 text-lg">
					Memuat Ruangan...
				</Text>
			</div>
		);
	}

	if (lobbyError || !lobbyData) {
		return (
			<div className="flex flex-col items-center justify-center min-h-screen p-4 bg-[var(--background)]">
				<Text
					as="h2"
					className="text-2xl font-semibold text-[var(--destructive)] mb-4"
				>
					{lobbyError ? "Terjadi kesalahan saat memuat ruangan" : "Ruangan tidak ditemukan"}
				</Text>
				<Text
					as="p"
					className="text-[var(--muted-foreground)] mb-6 text-center"
				>
					{lobbyError
						? lobbyError.message
						: `Kode ruangan "${roomCode.toUpperCase()}" mungkin tidak valid atau ruangan sudah tidak tersedia.`}
				</Text>

				<Link to="/dashboard">
					<Button>Kembali ke Beranda</Button>
				</Link>
			</div>
		);
	}

	const isHost = lobbyData.hostId === currentUser?._id;
	return (
		<div className="container mx-auto max-w-2xl py-8 px-4 min-h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)] font-[var(--font-sans)]">
			<Link
				to="/dashboard"
				className="absolute top-4 left-4 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
			>
				<ChevronLeft size={24} />
			</Link>

			<Card className="w-full shadow-[var(--shadow-xl)] border-2 border-[var(--border)] flex-grow flex flex-col bg-[var(--card)] text-[var(--card-foreground)]">
				<Card.Header className="text-center">
					<Text
						as="h1"
						className="text-3xl font-[var(--font-head)]"
						style={{
							textShadow: "0 0 5px var(--primary), 0 0 10px var(--primary)",
						}}
					>
						Lobi Multiplayer
					</Text>
					<Text as="p" className="text-[var(--muted-foreground)]">
						Siap untuk menantang temanmu!
					</Text>
					<div className="mt-4">
						<Text as="p" className="text-sm text-[var(--muted-foreground)]">
							KODE RUANGAN:
						</Text>
						<Button
							variant="outline"
							className="inline-block text-2xl font-mono tracking-widest p-3 bg-[var(--secondary)] text-[var(--secondary-foreground)] border-2 border-[var(--border)] shadow-[var(--shadow-sm)]"
							onClick={copyRoomCode}
							aria-label="Copy room code"
						>
							{lobbyData.code}
							<Copy size={18} className="ml-3 inline" />
						</Button>
					</div>
				</Card.Header>

				<Card.Content className="flex-grow space-y-6">
					<div className="text-center">
						<Text as="h3" className="text-xl font-[var(--font-head)]">
							{lobbyData.quiz.title}
						</Text>
						<Text as="p" className="text-sm text-[var(--muted-foreground)]">
							{lobbyData.quiz.description}
						</Text>
						<Text as="p" className="text-sm text-[var(--muted-foreground)]">
							{lobbyData.quiz.questionCount} Soal
						</Text>
					</div>

					<div>
						<Text
							as="h4"
							className="text-lg mb-3 flex items-center font-[var(--font-head)]"
						>
							<Users size={20} className="mr-2 text-[var(--primary)]" /> Peserta
							({lobbyData.players.length})
						</Text>
						<ul className="space-y-3 max-h-60 overflow-y-auto bg-[var(--muted)]/20 p-3 rounded-md border-2 border-[var(--border)] shadow-[var(--shadow-sm)]">
							{lobbyData.players.map((player) => (
								<li
									key={player.userId}
									className="flex items-center justify-between p-2 bg-[var(--background)] rounded-md shadow-[var(--shadow-xs)] border border-[var(--border)]"
								>
									<div className="flex items-center">
										<Avatar className="h-8 w-8 mr-3 border border-[var(--primary)]">
											<AvatarImage
												src={player.profileImage}
												alt={player.username}
											/>
											<AvatarFallback className="bg-[var(--primary)] text-[var(--primary-foreground)]">
												{player.username?.substring(0, 2).toUpperCase()}
											</AvatarFallback>
										</Avatar>
										<Text as="span" className="font-medium">
											{player.username}
										</Text>
									</div>
									{player.userId === lobbyData.hostId && (
										<div className="text-xs px-2 py-1 rounded-md bg-[var(--accent)] text-[var(--accent-foreground)] border border-[var(--border)] shadow-[var(--shadow-xs)]">
											Host
										</div>
									)}
								</li>
							))}
						</ul>
					</div>
				</Card.Content>

				<Card.Content className="mt-auto pt-6 border-t-2 border-dashed border-[var(--muted)]">
					{isHost && lobbyData.status === "waiting" && (
						<div className="flex w-full items-center justify-center gap-2">
							<Button
								variant="secondary"
								size={"icon"}
								className="bg-[var(--destructive)] text-[var(--destructive-foreground)] hover:bg-[var(--destructive)]/90"
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
										<Loader2 className="mr-2 h-5 w-5 animate-spin" /> Memulai...
									</>
								) : (
									<>
										<PlayCircle size={20} className="mr-2" /> Mulai Quiz
									</>
								)}
							</Button>
						</div>
					)}
					{lobbyData.status === "active" && (
						<Text
							as="p"
							className="text-center w-full text-[var(--accent)] font-semibold"
						>
							Quiz aktif! Mengarahkan...
						</Text>
					)}
					{lobbyData.status === "finished" && (
						<>
							<Text
								as="p"
								className="text-center w-full text-[var(--primary)] font-semibold"
							>
								Quiz selesai.
							</Text>
							{/* TODO: Add button to view results */}
						</>
					)}
				</Card.Content>
			</Card>
		</div>
	);
}
