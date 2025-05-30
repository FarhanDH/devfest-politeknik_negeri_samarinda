import { Avatar } from "@/components/retroui/Avatar"; // Import Avatar
import { Card } from "@/components/retroui/Card"; // Corrected Card import
import { Text } from "@/components/retroui/Text";
import { Button } from "@/components/ui/button";
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
			toast.info("Quiz has finished! Redirecting to results...");
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
			toast.info("You have already answered this question.");
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
			<div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-purple-600 to-blue-500 text-white">
				<Loader2 className="w-16 h-16 animate-spin mb-4" />
				<Text as="h2">Loading Quiz Arena...</Text>
			</div>
		);
	}

	if (playDataQuery === null || playDataQuery.error) {
		return (
			<div className="flex flex-col items-center justify-center min-h-screen p-4 bg-red-500 text-white">
				<AlertTriangle className="w-16 h-16 mb-4" />
				<Text as="h2">Error Loading Quiz</Text>
				<Text className="mt-2 text-center">
					{playDataQuery?.error ||
						"Could not load quiz data. Is the room code correct?"}
				</Text>
				<Button
					onClick={() => navigate({ to: "/dashboard", replace: true })}
					className="mt-6 bg-white text-red-500 hover:bg-red-100"
				>
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
	const getPlayerInitials = (name: string) =>
		name
			.split(" ")
			.map((n) => n[0])
			.join("")
			.toUpperCase()
			.slice(0, 2);

	return (
		<div className="min-h-screen bg-gradient-to-br from-purple-600 via-indigo-700 to-blue-600 flex flex-col lg:flex-row items-start justify-center p-4 gap-6 selection:bg-purple-300 selection:text-purple-900">
			{/* Main Quiz Card */}
			<Card className="w-full lg:flex-1 max-w-2xl shadow-2xl bg-white/90 backdrop-blur-sm rounded-xl overflow-hidden self-center lg:self-start mt-8 lg:mt-0">
				<Card.Header className="bg-black/50 text-white p-6">
					<div className="flex justify-between items-center mb-2">
						<Text as="p" className="text-purple-300">
							Multiplayer Quiz: {quiz.title}
						</Text>
						<Text
							as="p"
							className={`px-3 py-1 rounded-md font-semibold ${timeLeft !== null && timeLeft <= 5 ? "bg-red-500 text-white animate-pulse" : "bg-yellow-400 text-yellow-900"}`}
						>
							Time Left: {timeLeft === null ? "..." : timeLeft}s
						</Text>
					</div>
					<Card.Title className="text-2xl md:text-3xl !font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400">
						Question {currentQuestionIndex + 1} of {quiz.questions.length}
					</Card.Title>
					<Card.Description className="text-purple-200 mt-1">
						{currentQuestion.question}
					</Card.Description>
				</Card.Header>
				<Card.Content className="p-6 md:p-8">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						{currentQuestion.options.map((option: string, index: number) => {
							const isCorrectAnswer =
								quiz.questions[currentQuestionIndex].correctOptionIndex ===
								index;
							const isSelectedAnswer = selectedAnswerIndex === index;

							let buttonStyle =
								"bg-white/80 hover:bg-purple-100 border-purple-300 text-purple-800";
							if (isAnswered) {
								if (isCorrectAnswer) {
									buttonStyle = "!bg-green-500 !text-white border-green-700";
								} else if (isSelectedAnswer) {
									buttonStyle = "!bg-red-500 !text-white border-red-700";
								}
							} else if (isSelectedAnswer) {
								buttonStyle =
									"bg-purple-500 text-white border-purple-700 ring-2 ring-purple-300";
							}

							return (
								<Button
									key={option}
									variant="outline"
									onClick={() => handleAnswerSelect(index)}
									disabled={isAnswered || isSubmitting || timeLeft === 0}
									className={`p-4 h-auto text-left justify-start transition-all duration-200 ease-in-out transform hover:scale-105 
                              ${buttonStyle}
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
				<div className="p-6 bg-black/10 flex flex-col items-center">
					{isAnswered ? (
						<div className="text-center">
							<Text
								as="h3"
								className={
									quiz.questions[currentQuestionIndex].correctOptionIndex ===
									selectedAnswerIndex
										? "text-green-600"
										: "text-red-600"
								}
							>
								{selectedAnswerIndex !== null &&
									(quiz.questions[currentQuestionIndex].correctOptionIndex ===
									selectedAnswerIndex
										? "Correct!"
										: "Incorrect.")}
								{selectedAnswerIndex === null && "You didn't select an answer."}
							</Text>
							<Text as="p" className="mt-1 text-gray-700">
								Waiting for other players or next question...
							</Text>
						</div>
					) : (
						<Button
							onClick={handleSubmitAnswer}
							disabled={
								selectedAnswerIndex === null || isSubmitting || timeLeft === 0
							}
							className="w-full md:w-auto bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg transition duration-150 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{isSubmitting ? (
								<Loader2 className="mr-2 h-5 w-5 animate-spin" />
							) : null}
							Submit Answer
						</Button>
					)}
					{timeLeft === 0 && !isAnswered && (
						<Text as="p" className="mt-3 text-red-600 font-medium">
							Time's up! Your answer was not submitted.
						</Text>
					)}
				</div>
			</Card>

			{/* Scoreboard Card */}
			<Card className="w-full lg:w-80 shadow-xl bg-white/80 backdrop-blur-sm rounded-xl overflow-hidden self-center lg:self-start mt-8 lg:mt-0">
				<Card.Header className="bg-black/40 text-white p-4">
					<Card.Title className="text-xl !font-semibold text-center text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-orange-400 to-red-400">
						Live Scores
					</Card.Title>
				</Card.Header>
				<Card.Content className="p-4 space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto">
					{allPlayers.map((player, idx) => (
						<div
							key={player.userId}
							className={`flex items-center p-3 rounded-lg transition-all duration-300 shadow-sm hover:shadow-md 
                        ${player.userId === currentPlayer.userId ? "bg-purple-200 border-2 border-purple-500" : "bg-white/70"}
                        ${player.hasAnsweredCurrentQuestion ? "opacity-100" : "opacity-70"}`}
						>
							<Text
								as="p"
								className={`mr-3 font-bold text-lg ${player.userId === currentPlayer.userId ? "text-purple-700" : "text-gray-700"}`}
							>
								{idx + 1}.
							</Text>
							<Avatar className="h-10 w-10 mr-3 border-purple-400">
								<Avatar.Image
									src={player.profileImage || undefined}
									alt={player.username}
								/>
								<Avatar.Fallback className="bg-purple-500 text-white text-sm">
									{getPlayerInitials(player.username)}
								</Avatar.Fallback>
							</Avatar>
							<div className="flex-grow">
								<Text
									as="p"
									className={`font-semibold truncate ${player.userId === currentPlayer.userId ? "text-purple-800" : "text-gray-800"}`}
								>
									{player.username}{" "}
									{player.isHost && (
										<Crown className="inline h-4 w-4 ml-1 text-yellow-500" />
									)}
								</Text>
								<Text
									as="p"
									className={`text-sm ${player.userId === currentPlayer.userId ? "text-purple-600" : "text-gray-600"}`}
								>
									Score: {player.score}
								</Text>
							</div>
							{player.hasAnsweredCurrentQuestion && (
								<CheckCircle className="h-5 w-5 text-green-500 ml-2 flex-shrink-0" />
							)}
						</div>
					))}
				</Card.Content>
			</Card>

			<Button
				variant="outline"
				onClick={() => navigate({ to: "/dashboard", replace: true })}
				className="fixed bottom-4 left-4 bg-white/20 text-white hover:bg-white/30 border-white/50"
			>
				<ArrowLeft className="mr-2 h-4 w-4" /> Leave Quiz
			</Button>
		</div>
	);
}
