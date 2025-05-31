import { Avatar } from "@/components/retroui/Avatar";
import { Button } from "@/components/retroui/Button";
import { Card } from "@/components/retroui/Card";
import { Text } from "@/components/retroui/Text";
import { api } from "@cvx/_generated/api";
import type { Id } from "@cvx/_generated/dataModel"; // Use type-only import
import {
	createFileRoute,
	useNavigate,
	useParams,
} from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import {
	AlertTriangle,
	ArrowLeft,
	CheckCircle,
	Crown,
	Loader2,
	XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LiveVideo } from "../-live-video";

export const Route = createFileRoute(
	"/_app/_authenticated/multiplayer/$roomCode/play",
)({
	component: MultiplayerQuizPlayPage,
});

function MultiplayerQuizPlayPage() {
	const { roomCode } = useParams({
		from: "/_app/_authenticated/multiplayer/$roomCode/play",
	});
	const navigate = useNavigate();

	const playDataQuery = useQuery(api.multiplayer.getMultiplayerQuizPlayData, {
		roomCode,
	});
	const submitAnswerMutation = useMutation(api.multiplayer.submitAnswer);

	const [selectedAnswerIndex, setSelectedAnswerIndex] = useState<number | null>(
		null,
	);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [timeLeft, setTimeLeft] = useState<number | null>(null);

	const room = playDataQuery?.room;
	const quiz = playDataQuery?.quiz;
	const currentPlayer = playDataQuery?.currentPlayer;
	const allPlayers = playDataQuery?.allPlayers?.sort(
		(a, b) => b.score - a.score,
	); // Sort players by score
	const currentQuestionIndex = room?.currentQuestionIndex;
	const currentQuestion =
		quiz?.questions &&
		currentQuestionIndex !== undefined &&
		currentQuestionIndex >= 0
			? quiz.questions[currentQuestionIndex]
			: null;

	useEffect(() => {
		if (room?.status === "finished") {
			toast.info("Kuis telah selesai! Mengarahkan ke hasil...");
			navigate({
				to: "/multiplayer/$roomCode/results",
				params: { roomCode },
				replace: true,
			});
		}
	}, [room?.status, roomCode, navigate]);

	useEffect(() => {
		let timerId: NodeJS.Timeout | undefined;
		if (
			room?.status === "active" &&
			room.currentQuestionStartedAt &&
			currentQuestionIndex !== undefined &&
			currentQuestionIndex >= 0 &&
			quiz?.questions[currentQuestionIndex]
		) {
			const questionDuration = 20; // TODO: Use question.timeLimitSeconds from schema when available, e.g., (quiz.questions[currentQuestionIndex] as any).timeLimitSeconds ?? 20;
			const updateTimer = () => {
				const elapsed =
					(Date.now() - (room.currentQuestionStartedAt ?? Date.now())) / 1000;
				const remaining = Math.max(0, questionDuration - elapsed);
				setTimeLeft(Math.round(remaining));
			};
			updateTimer();
			timerId = setInterval(updateTimer, 1000);
		}
		return () => clearInterval(timerId);
	}, [
		room?.status,
		room?.currentQuestionStartedAt,
		currentQuestionIndex,
		quiz?.questions,
	]);

	const handleAnswerSelect = (index: number) => {
		if (
			currentPlayer?.hasAnsweredCurrentQuestion ||
			timeLeft === 0 ||
			isSubmitting
		)
			return;
		setSelectedAnswerIndex(index);
	};

	const handleSubmitAnswer = async () => {
		if (
			selectedAnswerIndex === null ||
			!room?._id ||
			currentQuestionIndex === undefined ||
			currentQuestionIndex < 0
		)
			return;
		if (currentPlayer?.hasAnsweredCurrentQuestion) {
			toast.info("Kamu sudah menjawab pertanyaan ini.");
			return;
		}
		if (timeLeft === 0) {
			toast.error("Time is up! Cannot submit answer.");
			return;
		}

		setIsSubmitting(true);
		const questionStartTime = room.currentQuestionStartedAt ?? Date.now();
		const timeTaken = Date.now() - questionStartTime;

		try {
			await submitAnswerMutation({
				roomId: room._id as Id<"multiplayer_rooms">,
				questionIndex: currentQuestionIndex,
				selectedIndex: selectedAnswerIndex,
				timeTaken: Math.max(0, timeTaken),
			});
			toast.success("Answer submitted!");
		} catch (error) {
			console.error("Failed to submit answer:", error);
			toast.error(
				(error as Error).message ||
					"Failed to submit answer. Please try again.",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	if (playDataQuery === undefined) {
		return (
			<div className="flex flex-col items-center justify-center min-h-screen p-4 bg-[var(--background)] text-[var(--foreground)]">
				<Loader2 className="h-16 w-16 animate-spin text-[var(--primary)] mb-4" />
				<Text as="p" className="text-xl">
					Loading Quiz Arena...
				</Text>
			</div>
		);
	}

	if (playDataQuery === null || playDataQuery.error) {
		return (
			<div className="flex flex-col items-center justify-center min-h-screen p-4 bg-[var(--background)] text-[var(--destructive)]">
				<AlertTriangle className="w-16 h-16 mb-4" />
				<Text
					as="h2"
					className="text-2xl font-bold"
					style={{
						textShadow:
							"0 0 5px var(--destructive), 0 0 10px var(--destructive)",
					}}
				>
					Error Loading Quiz
				</Text>
				<Text as="p" className="text-center mb-6">
					{playDataQuery?.error ||
						"Could not load quiz data. Please try again."}
				</Text>
				<Button onClick={() => navigate({ to: "/dashboard", replace: true })}>
					<ArrowLeft className="mr-2 h-4 w-4" /> Go to Dashboard
				</Button>
			</div>
		);
	}

	if (!quiz || !room || !currentPlayer || !allPlayers) {
		if (room?.status === "finished") {
			return (
				<div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-green-500 to-teal-400 text-white">
					<CheckCircle className="w-20 h-20 mb-6 text-white" />
					<Text as="h1" className="mb-4">
						Quiz Finished!
					</Text>
					<Text className="mb-6 text-center">
						The quiz has concluded. Preparing results...
					</Text>
					<Button
						onClick={() =>
							navigate({
								to: "/multiplayer/$roomCode/results",
								params: { roomCode },
								replace: true,
							})
						}
						className="bg-white text-green-600 hover:bg-green-100 font-semibold py-3 px-6 rounded-lg shadow-lg transition duration-150 ease-in-out transform hover:scale-105"
					>
						View Results
					</Button>
				</div>
			);
		}
		return (
			<div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-gray-700 via-gray-900 to-black text-white">
				<Loader2 className="w-16 h-16 animate-spin mb-4" />
				<Text as="h3">Preparing quiz...</Text>
				{/* biome-ignore lint/suspicious/noExplicitAny: <explanation> */}
				{room && (room.status as any) === "waiting" && (
					<Text className="mt-2">
						The quiz hasn't started yet. Waiting for host...
					</Text>
				)}
			</div>
		);
	}

	// If we reach here, room, quiz, currentPlayer, allPlayers are defined,
	// and room.status is "active" (neither "finished" nor "waiting" due to prior checks that return).
	if (currentQuestionIndex === undefined || currentQuestionIndex < 0) {
		return (
			<div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-gray-700 via-gray-900 to-black text-white">
				<Loader2 className="w-16 h-16 animate-spin mb-4" />
				<Text as="h3">Quiz is active. Loading question...</Text>
				<Text className="mt-2">The next question will appear shortly.</Text>
			</div>
		);
	}

	if (!currentQuestion) {
		return (
			<div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-yellow-500 to-orange-500 text-white">
				<AlertTriangle className="w-16 h-16 mb-4" />
				<Text as="h3">Question not available</Text>
				<Text className="mt-2">
					Waiting for the next question or quiz to start.
				</Text>
			</div>
		);
	}

	const isAnswered = currentPlayer.hasAnsweredCurrentQuestion;

	const getPlayerInitials = (name: string) => {
		if (!name) return "P";
		return name
			.split(" ")
			.map((n) => n[0])
			.join("")
			.toUpperCase()
			.slice(0, 2);
	};

	// Main component rendering
	return (
		<div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] font-[var(--font-sans)] flex flex-col lg:flex-row lg:items-start lg:justify-center gap-6 p-4 md:p-8 pb-20 overflow-hidden">
			{/* Quiz Card */}
			<Card className="w-full lg:w-[600px] shadow-[var(--shadow-xl)] border-2 border-[var(--border)] bg-[var(--card)] text-[var(--card-foreground)]">
				<Card.Header className="flex flex-col items-center">
					<Text
						as="h2"
						className="text-2xl font-bold"
						style={{
							textShadow: "0 0 5px var(--primary), 0 0 10px var(--primary)",
						}}
					>
						{quiz.title}
					</Text>
					<div className="flex items-center justify-center space-x-2 text-sm mt-2">
						<span className="bg-[var(--primary)]/20 text-[var(--primary-foreground)] px-2 py-1 rounded-full border border-[var(--border)] shadow-[var(--shadow-xs)]">
							Question {currentQuestionIndex + 1} of {quiz.questions.length}
						</span>
						{timeLeft !== null && (
							<span
								className={`px-2 py-1 rounded-full border border-[var(--border)] shadow-[var(--shadow-xs)] ${timeLeft > 10 ? "bg-[var(--accent)]/20 text-[var(--accent-foreground)]" : timeLeft > 5 ? "bg-[var(--primary)]/20 text-[var(--primary-foreground)]" : "bg-[var(--destructive)]/20 text-[var(--destructive-foreground)]"}`}
							>
								{timeLeft}s remaining
							</span>
						)}
					</div>
				</Card.Header>
				<Card.Content className="p-6 md:p-8">
					<Text as="p" className="text-lg mb-4">
						{currentQuestion.question}
					</Text>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						{currentQuestion.options.map((option: string, index: number) => {
							const isCorrectAnswer =
								quiz.questions[currentQuestionIndex].correctOptionIndex ===
								index;
							const isSelectedAnswer = selectedAnswerIndex === index;

							let buttonStyle = "";
							if (isAnswered) {
								if (isCorrectAnswer) {
									buttonStyle =
										"bg-[var(--accent)] text-[var(--accent-foreground)] border-[var(--border)] shadow-[var(--shadow-md)]";
								} else if (isSelectedAnswer) {
									buttonStyle =
										"bg-[var(--destructive)] text-[var(--destructive-foreground)] border-[var(--border)] shadow-[var(--shadow-md)]";
								}
							} else if (isSelectedAnswer) {
								buttonStyle =
									"bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--border)] shadow-[var(--shadow-md)]";
							}

							return (
								<Button
									key={option}
									variant="outline"
									onClick={() => handleAnswerSelect(index)}
									disabled={isAnswered || isSubmitting || timeLeft === 0}
									className={`p-4 h-auto text-left justify-start transition-all duration-200 ease-in-out hover:translate-y-1 ${buttonStyle}
                              disabled:opacity-70 disabled:transform-none disabled:cursor-not-allowed 
                            `}
								>
									<Text as="p">
										{String.fromCharCode(65 + index)}. {option}
									</Text>
									{isAnswered && isCorrectAnswer && (
										<CheckCircle className="ml-auto h-5 w-5 text-white" />
									)}
									{isAnswered && isSelectedAnswer && !isCorrectAnswer && (
										<XCircle className="ml-auto h-5 w-5 text-white" />
									)}
								</Button>
							);
						})}
					</div>
				</Card.Content>
				<Card.Content className="border-t-2 border-dashed border-[var(--muted)] pt-6 flex flex-col items-center">
					{isAnswered ? (
						<div className="text-center">
							<Text
								as="h3"
								className={
									quiz.questions[currentQuestionIndex].correctOptionIndex ===
									selectedAnswerIndex
										? "text-[var(--accent)]"
										: "text-[var(--destructive)]"
								}
							>
								{selectedAnswerIndex !== null &&
									(quiz.questions[currentQuestionIndex].correctOptionIndex ===
									selectedAnswerIndex
										? "Correct!"
										: "Incorrect.")}
								{selectedAnswerIndex === null && "You didn't select an answer."}
							</Text>
							<Text as="p" className="mt-1 text-[var(--muted-foreground)]">
								Waiting for other players or next question...
							</Text>
						</div>
					) : (
						<Button
							onClick={handleSubmitAnswer}
							disabled={
								selectedAnswerIndex === null || isSubmitting || timeLeft === 0
							}
							className="w-full md:w-auto"
						>
							{isSubmitting ? (
								<Loader2 className="mr-2 h-5 w-5 animate-spin" />
							) : null}
							Submit Answer
						</Button>
					)}
					{timeLeft === 0 && !isAnswered && (
						<Text as="p" className="mt-3 text-[var(--destructive)]">
							Time's up! Your answer was not submitted.
						</Text>
					)}
				</Card.Content>
			</Card>

			{/* Scoreboard Card */}

			<div className="flex flex-row lg:flex-col gap-4">
				<Card className="w-full lg:w-80 shadow-[var(--shadow-xl)] border-2 border-[var(--border)] bg-[var(--card)] text-[var(--card-foreground)] self-center lg:self-start mt-8 lg:mt-0">
					<Card.Header>
						<Text
							as="h3"
							className="text-xl font-bold text-center"
							style={{
								textShadow: "0 0 5px var(--primary), 0 0 10px var(--primary)",
							}}
						>
							Live Scores
						</Text>
					</Card.Header>
					<Card.Content className="p-4 space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto">
						{allPlayers.map((player, idx) => (
							<div
								key={player.userId}
								className={`flex items-center p-3 rounded-md transition-all duration-300 shadow-[var(--shadow-xs)] hover:shadow-[var(--shadow-sm)] border border-[var(--border)]
                        ${player.userId === currentPlayer.userId ? "bg-[var(--primary)]/20 border-2 border-[var(--primary)]" : "bg-[var(--background)]"}
                        ${player.hasAnsweredCurrentQuestion ? "opacity-100" : "opacity-70"}`}
							>
								<Text
									as="p"
									className={`mr-3 text-lg ${player.userId === currentPlayer.userId ? "text-[var(--primary)]" : "text-[var(--foreground)]"}`}
								>
									{idx + 1}.
								</Text>
								<Avatar className="h-10 w-10 mr-3 border border-[var(--border)]">
									<Avatar.Image
										src={player.profileImage || undefined}
										alt={player.username}
									/>
									<Avatar.Fallback className="bg-[var(--primary)] text-[var(--primary-foreground)] text-sm">
										{getPlayerInitials(player.username)}
									</Avatar.Fallback>
								</Avatar>
								<div className="flex-grow">
									<Text
										as="p"
										className={`truncate ${player.userId === currentPlayer.userId ? "text-[var(--primary)]" : "text-[var(--foreground)]"}`}
									>
										{player.username}{" "}
										{player.isHost && (
											<Crown className="inline h-4 w-4 ml-1 text-[var(--accent)]" />
										)}
									</Text>
									<Text
										as="p"
										className={`text-sm ${player.userId === currentPlayer.userId ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"}`}
									>
										Score: {player.score}
									</Text>
								</div>
								{player.hasAnsweredCurrentQuestion && (
									<CheckCircle className="h-5 w-5 text-[var(--accent)] ml-2 flex-shrink-0" />
								)}
							</div>
						))}
					</Card.Content>
				</Card>
				<LiveVideo
					onLeave={() => navigate({ to: "/dashboard", replace: true })}
					roomCode={roomCode}
				/>
			</div>

			<Button
				variant="outline"
				onClick={() => navigate({ to: "/dashboard", replace: true })}
				className="fixed bottom-4 left-4 bg-[var(--background)]/80 text-[var(--foreground)] hover:bg-[var(--background)] border border-[var(--border)] shadow-[var(--shadow-sm)]"
			>
				<ArrowLeft className="mr-2 h-4 w-4" /> Leave Quiz
			</Button>
		</div>
	);
}
