import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "@cvx/_generated/api";
import type { Doc, Id } from "@cvx/_generated/dataModel";
import { vv } from "@cvx/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
	Link,
	createFileRoute,
	notFound,
	useNavigate,
} from "@tanstack/react-router";
import { validate } from "convex-helpers/validators";
import { ChevronLeft, FileQuestion, Zap } from "lucide-react";
import Markdown from "react-markdown";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/_authenticated/quizzes/$quizId/")({
	component: RouteComponent,
	params: {
		parse: (rawParams) => {
			const isValid = validate(vv.id("quizzes"), rawParams.quizId);
			if (!isValid) {
				throw notFound();
			}
			return {
				quizId: rawParams.quizId as Id<"quizzes">,
			};
		},
	},
});

function RouteComponent() {
	const { quizId } = Route.useParams();

	const { data: attempts, isLoading: isLoadingAttempts } = useQuery(
		convexQuery(api.quizzes.getQuizAttemptsSinglePlayer, { quizId }),
	);

	const { data: multiplayerRooms, isLoading: isLoadingMultiplayerRooms } =
		useQuery(convexQuery(api.quizzes.getQuizAttemptsMultiPlayer, { quizId }));

	const { data, isLoading } = useQuery(
		convexQuery(api.quizzes.getQuiz, { id: quizId }),
	);

	console.log({
		attempts,
		multiplayerRooms,
	});

	const navigate = useNavigate();

	const { mutateAsync: startQuizAttempt } = useMutation({
		mutationFn: useConvexMutation(api.quizzes.startQuizAttempt),
	});

	const { mutateAsync: createMultiplayerRoom, isPending: isCreatingRoom } =
		useMutation({
			mutationFn: useConvexMutation(api.multiplayer.createRoom),
		});

	const handleStartSingleQuiz = async () => {
		try {
			const attemptId = await startQuizAttempt({ quizId });
			// Navigate to the play page with the attempt ID
			navigate({
				to: "/quizzes/$quizId/play",
				params: { quizId },
				search: () => ({ attemptId }),
			});
		} catch (error) {
			console.error(error);
			toast.error("Sepertinya ada kesalahan");
		}
	};

	const handleStartMultiplayerQuiz = async () => {
		try {
			toast.loading("Lagi buatin room... Tunggin Yaa");
			const result = await createMultiplayerRoom({ quizId });
			if (result?.roomCode) {
				toast.dismiss();
				toast.success("Room berhasil dibuat!");
				navigate({
					to: "/multiplayer/$roomCode",
					params: { roomCode: result.roomCode },
				});
			} else {
				toast.dismiss();
				throw new Error("Gagal mendapatkan kode room dari server.");
			}
		} catch (error) {
			toast.dismiss();
			console.error("Gagal membuat room:", error);
			toast.error(
				error instanceof Error
					? error.message
					: "Yahh gagal membuat room. Coba lagi.",
			);
		}
	};

	if (!data || isLoading) {
		return <div>Memuat...</div>;
	}

	if (!data) {
		return <div>Quiz tidak ditemukan</div>;
	}
	return (
		<div className="min-h-screen p-4 md:p-8 flex flex-col items-center">
			<div className="w-full max-w-4xl">
				<Button asChild variant="outline" className="mb-4 self-start">
					<Link to={"/dashboard"}>
						<ChevronLeft className="mr-2 h-4 w-4" />
						Kembali ke Dashboard
					</Link>
				</Button>
				<Card className="w-full border">
					<CardHeader>
						<CardTitle className="text-3xl font-bold">{data.title}</CardTitle>
						<CardDescription className="text-lg pt-1">
							{data.description}
						</CardDescription>
					</CardHeader>
					<CardContent className="py-4">
						<div className="flex items-center gap-2 text-md">
							<FileQuestion className="h-5 w-5" />
							<p className="text-muted-foreground">
								{data.questions.length} pertanyaan
							</p>
						</div>
					</CardContent>
					<CardFooter className="flex flex-col sm:flex-row gap-3 pt-4">
						<Button
							onClick={handleStartSingleQuiz}
							className="w-full sm:w-auto flex-grow"
						>
							Mulai Quiz Sendiri
						</Button>
						<Button
							onClick={handleStartMultiplayerQuiz}
							disabled={isCreatingRoom}
							className="w-full sm:w-auto flex-grow"
						>
							{isCreatingRoom ? "Membuat Room..." : "Main dengan Teman"}
						</Button>
					</CardFooter>
				</Card>
				{/* Single-player History Section */}
				{isLoadingAttempts && (
					<p className="mt-8 text-center">Memuat riwayat permainan...</p>
				)}
				{!isLoadingAttempts && attempts && attempts.length === 0 && (
					<div className="mt-8 w-full text-center">
						<p className="text-muted-foreground">
							Belum ada riwayat permainan untuk kuis ini.
						</p>
					</div>
				)}
				{!isLoadingAttempts && attempts && attempts.length > 0 && (
					<div className="mt-8 w-full">
						<h2 className="text-2xl font-semibold mb-4">
							Riwayat Permainan Sendiri
						</h2>
						<div className="space-y-4">
							{attempts.map((attempt: Doc<"quiz_attempts">) => (
								<Card key={attempt._id} className="border">
									<CardHeader className="flex flex-row items-center justify-between pb-2 pt-2 px-4">
										<div>
											<p className="text-sm font-medium leading-none">Detail</p>
										</div>
										{attempt.feedback && (
											<Dialog>
												<DialogTrigger asChild>
													<Button
														variant="ghost"
														size="icon"
														disabled={!attempt.feedback}
														aria-label="Lihat Feedback"
													>
														<Zap className="size-5" />
													</Button>
												</DialogTrigger>
												<DialogContent className="min-w-[95vw] max-h-[95vh] sm:min-w-[80vw] md:min-w-[60vw] lg:min-w-[50vw]">
													<DialogHeader>
														<DialogTitle>Umpan Balik Kuis</DialogTitle>
														<DialogDescription className="pt-2 whitespace-pre-wrap overflow-y-auto max-h-[70vh]">
															<Markdown>{attempt.feedback}</Markdown>
														</DialogDescription>
													</DialogHeader>
												</DialogContent>
											</Dialog>
										)}
										{!attempt.feedback && (
											<Button
												variant="ghost"
												size="icon"
												disabled
												aria-label="Tidak Ada Feedback"
											>
												<Zap className="size-5 text-muted-foreground/50" />
											</Button>
										)}
									</CardHeader>
									<CardContent className="p-4 pt-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
										<div>
											<p className="text-sm text-muted-foreground">Tanggal:</p>
											<p className="font-medium">
												{new Date(attempt._creationTime).toLocaleDateString(
													"id-ID",
													{
														year: "numeric",
														month: "long",
														day: "numeric",
														hour: "2-digit",
														minute: "2-digit",
													},
												)}
											</p>
										</div>
										<div className="flex flex-col sm:flex-row gap-2 sm:items-center mt-2 sm:mt-0 self-start sm:self-center">
											<Badge variant="outline">
												Skor: {attempt.totalScore}
											</Badge>
											<Badge variant="secondary">
												EXP: {attempt.expEarned}
											</Badge>
										</div>
									</CardContent>
								</Card>
							))}
						</div>
					</div>
				)}
				{/* Multiplayer Room History Section */}
				{isLoadingMultiplayerRooms && (
					<p className="mt-8 text-center">Memuat riwayat room multiplayer...</p>
				)}
				{!isLoadingMultiplayerRooms &&
					multiplayerRooms &&
					multiplayerRooms.length === 0 && (
						<div className="mt-8 w-full text-center">
							<p className="text-muted-foreground">
								Belum ada riwayat room multiplayer untuk kuis ini.
							</p>
						</div>
					)}
				{!isLoadingMultiplayerRooms &&
					multiplayerRooms &&
					multiplayerRooms.length > 0 && (
						<div className="mt-8 w-full">
							<h2 className="text-2xl font-semibold mb-4">
								Riwayat Room Multiplayer
							</h2>
							<div className="space-y-4">
								{multiplayerRooms.map((room: Doc<"multiplayer_rooms">) => (
									<Card key={room._id} className="border">
										<CardHeader className="pb-2">
											<CardTitle className="text-xl">
												Room: {room.code}
											</CardTitle>
											<CardDescription>
												Tanggal:{" "}
												{new Date(room._creationTime).toLocaleDateString(
													"id-ID",
													{
														year: "numeric",
														month: "long",
														day: "numeric",
														hour: "2-digit",
														minute: "2-digit",
													},
												)}
											</CardDescription>
										</CardHeader>
										<CardContent className="pt-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
											<Badge
												variant={
													room.status === "finished"
														? "outline"
														: room.status === "active"
															? "default"
															: "secondary"
												}
											>
												Status:{" "}
												{room.status === "finished"
													? "Selesai"
													: room.status === "active"
														? "Sedang Main"
														: "Menunggu"}
											</Badge>
											{/* Player count display removed for now due to type incompatibility. Needs schema/query adjustment. */}
											{/* <div className="flex items-center gap-1 text-sm text-muted-foreground mt-2 sm:mt-0">
												<Users className="h-4 w-4" />
												<span>Pemain: N/A</span>
											</div> */}
										</CardContent>
									</Card>
								))}
							</div>
						</div>
					)}
			</div>
		</div>
	);
}
