import { useConvexMutation } from "@convex-dev/react-query";
import { api } from "@cvx/_generated/api";
import type { Doc, Id } from "@cvx/_generated/dataModel";
import { useMutation } from "@tanstack/react-query";
import type React from "react";
import { createContext, useContext, useState } from "react";

type QuestionAnswer = {
	questionIndex: number;
	selectedIndex: number;
	isCorrect: boolean;
	timeTaken: number; // in ms
};

type QuizContextType = {
	quizData: Doc<"quizzes"> | null;
	attemptId: Id<"quiz_attempts"> | null;
	currentQuestionIndex: number;
	answers: QuestionAnswer[];
	startTime: number | null;
	endTime: number | null;
	isQuizStarted: boolean;
	isQuizFinished: boolean;

	// Methods
	startQuiz: (quizData: Doc<"quizzes">) => Promise<void>;
	submitAnswer: (selectedIndex: number) => Promise<void>;
	nextQuestion: () => void;
	finishQuiz: () => Promise<void>;
	setAttemptId: (id: Id<"quiz_attempts">) => void;
	setQuizData: (quizData: Doc<"quizzes">) => void;
};

const QuizContext = createContext<QuizContextType | null>(null);

export const useQuiz = () => {
	const context = useContext(QuizContext);
	if (!context) {
		throw new Error("useQuiz must be used within a QuizProvider");
	}
	return context;
};

export const QuizProvider: React.FC<{
	children: React.ReactNode;
}> = ({ children }) => {
	const [quizData, setQuizData] = useState<Doc<"quizzes"> | null>(null);
	const [attemptId, setAttemptId] = useState<Id<"quiz_attempts"> | null>(null);
	const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
	const [answers, setAnswers] = useState<QuestionAnswer[]>([]);
	const [startTime, setStartTime] = useState<number | null>(null);
	const [endTime, setEndTime] = useState<number | null>(null);
	const [isQuizStarted, setIsQuizStarted] = useState<boolean>(false);
	const [isQuizFinished, setIsQuizFinished] = useState<boolean>(false);

	// Mutations
	const { mutateAsync: startQuizAttempt } = useMutation({
		mutationFn: useConvexMutation(api.quizzes.startQuizAttempt),
	});

	const { mutateAsync: saveQuizAnswer } = useMutation({
		mutationFn: useConvexMutation(api.quizzes.saveQuizAnswer),
	});

	const { mutateAsync: finishQuizAttempt } = useMutation({
		mutationFn: useConvexMutation(api.quizzes.finishQuizAttempt),
	});

	// Start the quiz
	const startQuiz = async (quiz: Doc<"quizzes">) => {
		try {
			const now = Date.now();
			const newAttemptId = await startQuizAttempt({ quizId: quiz._id });

			setQuizData(quiz);
			setAttemptId(newAttemptId);
			setStartTime(now);
			setIsQuizStarted(true);
			setCurrentQuestionIndex(0);
			setAnswers([]);
		} catch (error) {
			console.error("Failed to start quiz:", error);
			throw error;
		}
	};

	// Submit an answer for the current question
	const submitAnswer = async (selectedIndex: number) => {
		if (
			!quizData ||
			!attemptId ||
			currentQuestionIndex >= quizData.questions.length
		) {
			return;
		}

		try {
			const now = Date.now();
			const questionStartTime = startTime || now;

			// Calculate time taken to answer (using previous answer's timestamp or quiz start time)
			const prevAnswerTime =
				answers.length > 0
					? answers[answers.length - 1].timeTaken + questionStartTime
					: questionStartTime;

			const timeTaken = now - prevAnswerTime;

			// Check if answer is correct
			const isCorrect =
				quizData.questions[currentQuestionIndex].correctOptionIndex ===
				selectedIndex;

			// Save answer
			const answer: QuestionAnswer = {
				questionIndex: currentQuestionIndex,
				selectedIndex,
				isCorrect,
				timeTaken,
			};

			// Add to local state
			setAnswers((prev) => [...prev, answer]);

			// Save to database
			await saveQuizAnswer({
				attemptId,
				questionIndex: currentQuestionIndex,
				selectedIndex,
				isCorrect,
				timeTaken,
			});
		} catch (error) {
			console.error("Failed to submit answer:", error);
			throw error;
		}
	};

	// Move to the next question
	const nextQuestion = () => {
		if (!quizData || currentQuestionIndex >= quizData.questions.length - 1) {
			return;
		}

		setCurrentQuestionIndex((prev) => prev + 1);
	};

	// Finish the quiz
	const finishQuiz = async () => {
		if (!attemptId) {
			console.error("Cannot finish quiz: No attempt ID");
			return;
		}

		try {
			console.log(
				"Finishing quiz with attempt ID:",
				attemptId,
				"(type:",
				typeof attemptId,
				")",
			);
			const now = Date.now();
			await finishQuizAttempt({
				attemptId,
			});

			setEndTime(now);
			setIsQuizFinished(true);

			// Navigate to result page
			if (quizData) {
				// Use a simpler approach to navigate with the attempt ID
				console.log("Navigating to result page with:", {
					quizId: quizData._id,
					attemptId,
				});

				// Navigate to the result page with the quiz ID and attempt ID
				const resultUrl = `/quizzes/${quizData._id}/result?attemptId=${attemptId}`;
				window.location.href = resultUrl;
			}
		} catch (error) {
			console.error("Failed to finish quiz:", error);
			throw error;
		}
	};

	// Method to directly set the attemptId (used when resuming a quiz from URL)
	const setAttemptIdMethod = (id: Id<"quiz_attempts">) => {
		console.log("Setting attempt ID:", id);
		setAttemptId(id);
		setIsQuizStarted(true);

		// We'll fetch the attempt data when needed in the useEffect in the component
		// This simplifies the flow and avoids race conditions

		// The quiz data will be loaded by the play.tsx component after setting the attemptId
		// This ensures we have both the quiz data and attempt data before proceeding
	};

	const contextValue: QuizContextType = {
		quizData,
		currentQuestionIndex,
		answers,
		attemptId,
		isQuizStarted,
		isQuizFinished,
		startTime,
		endTime,
		startQuiz,
		setAttemptId: setAttemptIdMethod,
		setQuizData,
		submitAnswer,
		nextQuestion,
		finishQuiz,
	};

	return (
		<QuizContext.Provider value={contextValue}>{children}</QuizContext.Provider>
	);
};
