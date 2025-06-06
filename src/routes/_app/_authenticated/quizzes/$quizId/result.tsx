import { Progress } from "@/components/retroui/Progress";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@cvx/_generated/api";
import type { Id } from "@cvx/_generated/dataModel";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAction } from "convex/react";
import { ArrowLeft, Award, Check, Clock, X } from "lucide-react";
import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface QuizResultProps {
	quizId: Id<"quizzes">;
	attemptId: string;
}

export const Route = createFileRoute(
	"/_app/_authenticated/quizzes/$quizId/result",
)({
	component: RouteComponent,
	validateSearch: (search: Record<string, unknown>) => ({
		attemptId: search.attemptId as Id<"quiz_attempts"> | undefined,
	}),
});

function formatTime(ms: number): string {
	const seconds = Math.floor(ms / 1000);
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;
	return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function QuizResult({ quizId, attemptId }: QuizResultProps) {
	const [totalTimeTaken, setTotalTimeTaken] = useState<number>(0);
	const [isGeneratingFeedback, setIsGeneratingFeedback] =
		useState<boolean>(false);

	// Fetch quiz data
	const { data: quiz, isLoading: isQuizLoading } = useQuery(
		convexQuery(api.quizzes.getQuiz, { id: quizId as Id<"quizzes"> }),
	);

	// Fetch attempt data
	const { data: attempt, isLoading: isAttemptLoading } = useQuery(
		convexQuery(api.quizzes.getQuizAttempt, {
			attemptId: attemptId as Id<"quiz_attempts">,
		}),
	);

	const generateFeedback = useAction(api.ai.generateFeedbackFromQuizResult);

	// Log the attempt data for debugging
	useEffect(() => {
		console.log("Attempt data in result page:", {
			attemptId,
			attempt,
			isAttemptLoading,
		});
	}, [attemptId, attempt, isAttemptLoading]);

	// Calculate total time taken
	useEffect(() => {
		if (attempt?.questionAnswers) {
			const totalTime = attempt.questionAnswers.reduce(
				(acc: number, answer: { timeTaken: number }) => {
					return acc + answer.timeTaken;
				},
				0,
			);
			setTotalTimeTaken(totalTime);

			generateFeedback({ attemptId: attempt._id });
		}
	}, [attempt]);

	useEffect(() => {
		if (attempt && !attempt.feedback) {
			setIsGeneratingFeedback(true);
			generateFeedback({ attemptId: attempt._id });
			setIsGeneratingFeedback(false);
		}
	}, [attempt, attempt?.feedback]);

	const navigate = useNavigate();

	if (isQuizLoading || isAttemptLoading) {
		return (
			<div className="container mx-auto max-w-4xl py-8">
				<Card>
					<CardHeader>
						<CardTitle>Sedang memuat hasil...</CardTitle>
					</CardHeader>
					<CardContent>
						<p>Tunggu sebentar ya, sedang memuat hasil quizmu.</p>
						{isGeneratingFeedback && <p>Sedang membuat evaluasi...</p>}
					</CardContent>
				</Card>
			</div>
		);
	}

	// Log detailed information about the attempt and quiz
	console.log("Result page data:", {
		quizId,
		attemptId,
		quiz,
		attempt,
		isQuizLoading,
		isAttemptLoading,
	});

	if (!quiz || !attempt) {
		return (
			<div className="container mx-auto max-w-4xl py-8">
				<Card>
					<CardHeader>
						<CardTitle>Hasil Tidak Ditemukan</CardTitle>
					</CardHeader>
					<CardContent>
						<p>Kita tidak bisa menemukan hasil quiz ini. Coba lagi nanti.</p>
						<p className="text-sm text-gray-500 mt-2">
							Debug info: Quiz ID: {quizId.toString()}, Attempt ID:{" "}
							{attemptId.toString()}
						</p>
						<Button
							className="mt-4"
							onClick={() => navigate({ to: "/quizzes" })}
						>
							Return to Quizzes
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	const correctAnswers = attempt.questionAnswers.filter(
		(a) => a.isCorrect,
	).length;
	const totalQuestions = quiz.questions.length;
	const percentage = Math.round((correctAnswers / totalQuestions) * 100);

	return (
		<div className="container mx-auto max-w-4xl py-8">
			<Button
				variant="outline"
				className="mb-4 flex items-center gap-2"
				onClick={() => navigate({ to: "/dashboard" })}
			>
				<ArrowLeft size={16} />
				Kembali ke Dashboard
			</Button>

			<Card className="mb-8">
				<CardHeader>
					<CardTitle className="text-2xl">{quiz.title}</CardTitle>
					<CardDescription>Hasil Quiz</CardDescription>
				</CardHeader>

				<CardContent className="space-y-6">
					{/* Score */}
					<div className="text-center">
						<h2 className="text-4xl font-bold mb-2">{percentage}%</h2>
						<p className="text-muted-foreground">
							Benar {correctAnswers} dari {totalQuestions} total pertanyaan
						</p>
						<Progress className="h-2 mt-4" value={percentage} />
					</div>

					{/* Stats */}
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
						<Card>
							<CardContent className="p-6 flex flex-col items-center">
								<Award className="w-8 h-8 mb-2 text-primary" />
								<p className="text-lg font-semibold">{attempt.expEarned} XP</p>
								<p className="text-sm text-muted-foreground">XP Diperoleh</p>
							</CardContent>
						</Card>

						<Card>
							<CardContent className="p-6 flex flex-col items-center">
								<Clock className="w-8 h-8 mb-2 text-primary" />
								<p className="text-lg font-semibold">
									{formatTime(totalTimeTaken)}
								</p>
								<p className="text-sm text-muted-foreground">
									Waktu Pengerjaan
								</p>
							</CardContent>
						</Card>

						<Card>
							<CardContent className="p-6 flex flex-col items-center">
								<div className="flex gap-2 mb-2">
									<Check className="w-6 h-6 text-green-500" />
									<X className="w-6 h-6 text-red-500" />
								</div>
								<p className="text-lg font-semibold">
									{attempt.totalScore} pts
								</p>
								<p className="text-sm text-muted-foreground">Total Score</p>
							</CardContent>
						</Card>
					</div>
				</CardContent>

				<CardFooter className="flex justify-center">
					<Button
						onClick={() =>
							navigate({
								to: "/quizzes/$quizId",
								params: { quizId },
							})
						}
					>
						Kembali ke Quiz
					</Button>
				</CardFooter>
			</Card>

			{!attempt.feedback && (
				<Card className="mb-8 border-2 border-yellow-400 shadow-[4px_4px_0px_#000] bg-[var(--retro-background-alt)] text-[var(--retro-text-color)]">
					<CardHeader>
						<CardTitle className="text-xl text-[var(--retro-text-color)]">
							✨ Evaluasi dari AI ✨
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p>Sedang mengevaluasi hasil quizmu...</p>
					</CardContent>
				</Card>
			)}

			{attempt?.feedback && (
				<Card className="mb-8 border-2 border-yellow-400 shadow-[4px_4px_0px_#000] bg-[var(--retro-background-alt)] text-[var(--retro-text-color)]">
					<CardHeader>
						<CardTitle className="text-xl text-[var(--retro-text-color)]">
							✨ Evaluasi dari AI ✨
						</CardTitle>
					</CardHeader>
					<CardContent>
						<Markdown remarkPlugins={[remarkGfm]}>{attempt.feedback}</Markdown>
					</CardContent>
				</Card>
			)}

			{/* Question Review */}
			<h2 className="text-2xl font-bold mb-4">Question Review</h2>
			<div className="space-y-4">
				{quiz.questions.map((question, index) => {
					const answer = attempt.questionAnswers.find(
						(a) => a.questionIndex === index,
					);
					const isCorrect = answer?.isCorrect || false;
					const selectedIndex = answer?.selectedIndex || 0;

					return (
						<Card
							key={`review-question-${question.question}-${index}`}
							className={isCorrect ? "border-green-200" : "border-red-200"}
						>
							<CardHeader className="pb-2">
								<div className="flex items-center space-x-2">
									<span className="text-sm">
										{formatTime(answer?.timeTaken as number)}
									</span>
									<CardTitle className="text-lg">
										Pertanyaan nomor {index + 1}
									</CardTitle>
									{isCorrect ? (
										<Check className="text-green-500" />
									) : (
										<X className="text-red-500" />
									)}
								</div>
							</CardHeader>

							<CardContent className="space-y-3">
								<p className="font-medium">{question.question}</p>

								<div className="space-y-2">
									{question.options.map((option, optionIndex) => {
										let className = "p-3 rounded-md text-sm";

										if (optionIndex === question.correctOptionIndex) {
											className += " bg-green-50 border border-green-200";
										} else if (optionIndex === selectedIndex && !isCorrect) {
											className += " bg-red-50 border border-red-200";
										} else {
											className += " bg-muted/50";
										}

										return (
											<div
												key={`option-${option}-${
													// biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
													optionIndex
												}`}
												className={className}
											>
												{option}
												{optionIndex === selectedIndex &&
													!isCorrect &&
													" (Jawabanmu)"}
												{optionIndex === question.correctOptionIndex &&
													" (Jawaban Benar)"}
											</div>
										);
									})}
								</div>

								<div className="mt-4 p-4 bg-muted/30 rounded-md">
									<p className="font-medium mb-1">Penjelasan:</p>
									<p className="text-muted-foreground">
										{question.explanation}
									</p>
								</div>
							</CardContent>
						</Card>
					);
				})}
			</div>
		</div>
	);
}

function RouteComponent() {
	const { quizId } = Route.useParams();
	const searchParams = Route.useSearch();
	const attemptId = searchParams.attemptId;

	console.log("RouteComponent received:", { quizId, attemptId, searchParams });

	if (!attemptId) {
		return (
			<div className="container mx-auto max-w-4xl py-8">
				<Card>
					<CardHeader>
						<CardTitle>Missing Attempt ID</CardTitle>
					</CardHeader>
					<CardContent>
						<p>No quiz attempt was specified. Please try again.</p>
						<p className="text-sm text-gray-500 mt-2">
							Debug info: Quiz ID: {quizId}, Search params:{" "}
							{JSON.stringify(searchParams)}
						</p>
						<Button className="mt-4" onClick={() => window.history.back()}>
							Go Back
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	// Ensure attemptId is properly cast as an Id<"quiz_attempts">
	return (
		<QuizResult
			quizId={quizId as Id<"quizzes">}
			attemptId={attemptId as Id<"quiz_attempts">}
		/>
	);
}
