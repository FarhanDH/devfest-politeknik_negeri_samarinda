import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@cvx/_generated/api";
import type { Doc, Id } from "@cvx/_generated/dataModel";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react"; // Added useState
import { QuizProvider, useQuiz } from "../-quiz-context";
import { QuizPageHeader } from "../-quiz-header"; // Added QuizPageHeader import
import { Question } from "../-ui.question";

export const Route = createFileRoute(
	"/_app/_authenticated/quizzes/$quizId/play",
)({
	component: PlayingAQuizPage,
	validateSearch: (search: Record<string, unknown>) => ({
		attemptId: search.attemptId as Id<"quiz_attempts"> | undefined,
	}),
});

function QuizContent() {
	const { quizId } = Route.useParams();
	const [isTextToSpeechEnabled, setIsTextToSpeechEnabled] = useState(false);
	const toggleTextToSpeech = () => setIsTextToSpeechEnabled((prev) => !prev);
	const { attemptId } = Route.useSearch();

	const {
		quizData,
		currentQuestionIndex,
		answers,
		isQuizStarted,
		startQuiz,
		setAttemptId,
		submitAnswer,
		nextQuestion,
		finishQuiz,
		setQuizData,
	} = useQuiz();

	// Fetch the quiz data
	const { data: fetchedQuizData, isLoading: isQuizLoading } = useQuery(
		convexQuery(api.quizzes.getQuiz, { id: quizId as Id<"quizzes"> }),
	);

	// We'll only fetch the quiz data directly, and handle the attempt data in the effect

	// Use refs to track initialization state
	const hasInitializedRef = useRef(false);
	const hasStartedQuizRef = useRef(false);

	// First effect: Handle setting the attempt ID if present
	useEffect(() => {
		if (attemptId && !isQuizStarted && !hasInitializedRef.current) {
			console.log("Setting attempt ID from URL:", attemptId);
			setAttemptId(attemptId);
			hasInitializedRef.current = true;
		}
	}, [attemptId, isQuizStarted, setAttemptId]);

	// Second effect: Handle starting a new quiz when we have the data
	useEffect(() => {
		// Skip if we've already started the quiz or don't have data yet
		if (hasStartedQuizRef.current || !fetchedQuizData) {
			return;
		}

		// For new quizzes (no attempt ID) - only start if explicitly not started
		if (!attemptId && !isQuizStarted) {
			console.log("Starting new quiz with data:", fetchedQuizData);
			startQuiz(fetchedQuizData);
			hasStartedQuizRef.current = true;
			return;
		}

		// For existing quizzes with attempt ID but no quiz data yet
		// IMPORTANT: We don't call startQuiz here, just set the quiz data
		if (attemptId && isQuizStarted && !quizData) {
			console.log("Setting quiz data for existing attempt:", fetchedQuizData);
			// Don't call startQuiz again as it would create a new attempt
			// Instead, just set the quiz data directly
			setQuizData(fetchedQuizData);
			hasStartedQuizRef.current = true;
			return;
		}
	}, [
		fetchedQuizData,
		isQuizStarted,
		attemptId,
		quizData,
		startQuiz,
		setQuizData,
	]);

	// We'll handle loading attempt data in a future update
	// For now, we'll focus on making the basic quiz flow work correctly

	// Debug logs
	console.log({
		quizId,
		attemptId,
		isQuizStarted,
		quizDataExists: !!quizData,
		fetchedQuizDataExists: !!fetchedQuizData,
		currentQuestionIndex,
		answersCount: answers.length,
	});

	// If we're loading the quiz data, show loading
	const isLoading = isQuizLoading;

	if (isLoading) {
		return (
			<div className="min-h-screen container mx-auto max-w-4xl py-8">
				<Card>
					<CardHeader>
						<CardTitle>Sedang memuat Quiz... Tungguin yaa</CardTitle>
					</CardHeader>
					<CardContent>
						<p>Tunggu sebentar ya, sedang memuat quizmu.</p>
					</CardContent>
				</Card>
			</div>
		);
	}

	// More detailed debug logs to help diagnose the issue
	console.log("Detailed quiz state:", {
		quizId,
		attemptId,
		isQuizStarted,
		quizData,
		fetchedQuizData,
		hasInitialized: hasInitializedRef.current,
		hasStartedQuiz: hasStartedQuizRef.current,
		currentQuestionIndex,
		answersCount: answers.length,
	});

	// Last resort: If we have fetchedQuizData but no quizData, force start the quiz
	if (fetchedQuizData && !quizData && !hasStartedQuizRef.current) {
		console.log("EMERGENCY: Forcing quiz start with fetched data");
		startQuiz(fetchedQuizData);
		hasStartedQuizRef.current = true;
	}

	if (!quizData) {
		return (
			<div className="min-h-screen container mx-auto max-w-4xl py-8">
				<Card>
					<CardHeader>
						<CardTitle>Quiz Tidak Ditemukan</CardTitle>
					</CardHeader>
					<CardContent>
						<p>Kita tidak bisa menemukan quiz ini. Coba lagi nanti.</p>
						<p className="text-sm text-gray-500 mt-2">
							Debug info: Quiz ID: {quizId}, Attempt ID:{" "}
							{attemptId?.toString() || "none"}, Has Quiz Data:{" "}
							{fetchedQuizData ? "yes" : "no"}
						</p>
						<Button className="mt-4" onClick={() => window.history.back()}>
							Kembali
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	// Handle submitting an answer for the current question
	const handleSubmitAnswer = async (selectedIndex: number) => {
		await submitAnswer(selectedIndex);
	};

	return (
		<div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
			<QuizPageHeader
				title={quizData?.title || "Playing Quiz"}
				backLink={`/quizzes/${quizId}`}
				isTextToSpeechEnabled={isTextToSpeechEnabled}
				onToggleTextToSpeech={toggleTextToSpeech}
			/>
			<main className="container mx-auto max-w-4xl px-4 py-8 pb-20">
				<div className="flex flex-col w-full">
					{quizData.questions
						.filter((_, index: number) => index <= currentQuestionIndex)
						.map(
							(
								question: Doc<"quizzes">["questions"][number],
								index: number,
							) => (
								<Question
									isTextToSpeechEnabled={isTextToSpeechEnabled}
									key={`question-${question.question}-${index}`}
									data={question}
									onSubmitAnswer={(selectedIndex) =>
										handleSubmitAnswer(selectedIndex)
									}
									onNextQuestion={
										index === currentQuestionIndex &&
										index === quizData.questions.length - 1
											? finishQuiz
											: nextQuestion
									}
									isLastQuestion={index === quizData.questions.length - 1}
									isActive={index === currentQuestionIndex}
									isAnswered={answers.some((a) => a.questionIndex === index)}
									answeredIndex={
										answers.find((a) => a.questionIndex === index)
											?.selectedIndex
									}
									questionNumber={index}
								/>
							),
						)}
				</div>
			</main>
		</div>
	);
}

function PlayingAQuizPage() {
	return (
		<QuizProvider>
			<QuizContent />
		</QuizProvider>
	);
}
