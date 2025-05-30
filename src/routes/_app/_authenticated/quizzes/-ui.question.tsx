import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Doc } from "@cvx/_generated/dataModel";
import { Check, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export const DUMMY_QUESTIONS: Doc<"quizzes">["questions"] = [
	{
		question: "What is the capital of France?",
		options: ["Paris", "London", "Berlin", "Madrid"],
		difficulty: "easy",
		questionType: "multiple_choice",
		correctOptionIndex: 0,
		explanation: "The capital of France is Paris.",
	},
	{
		question: "What is the largest planet in our solar system?",
		options: ["Earth", "Saturn", "Jupiter", "Uranus"],
		difficulty: "medium",
		questionType: "multiple_choice",
		correctOptionIndex: 2,
		explanation: "The largest planet in our solar system is Jupiter.",
	},
	{
		question: "What is the boiling point of water in Kelvin?",
		options: ["100", "200", "300", "373"],
		difficulty: "hard",
		questionType: "multiple_choice",
		correctOptionIndex: 3,
		explanation: "The boiling point of water in Kelvin is 373.",
	},
	{
		question: "What is the chemical symbol for gold?",
		options: ["Ag", "Au", "Hg", "Pb"],
		difficulty: "medium",
		questionType: "multiple_choice",
		correctOptionIndex: 1,
		explanation: "The chemical symbol for gold is Au.",
	},
	{
		question: "What is the smallest country in the world?",
		options: ["Vatican City", "Monaco", "San Marino", "Liechtenstein"],
		difficulty: "easy",
		questionType: "multiple_choice",
		correctOptionIndex: 0,
		explanation: "The smallest country in the world is Vatican City.",
	},
];

interface QuestionProps {
	data: Doc<"quizzes">["questions"][number];
	onSubmitAnswer: (selectedIndex: number) => Promise<void>;
	onNextQuestion: () => void;
	isLastQuestion: boolean;
	isActive: boolean;
	isAnswered: boolean;
	answeredIndex?: number;
	questionNumber: number;
}

export const Question: React.FC<QuestionProps> = ({
	data,
	onSubmitAnswer,
	onNextQuestion,
	isLastQuestion,
	isActive,
	isAnswered,
	answeredIndex,
	questionNumber,
}: QuestionProps): React.ReactElement => {
	const [selectedOption, setSelectedOption] = useState<number | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const questionRef = useRef<HTMLDivElement>(null);

	// Scroll into view when the question becomes active
	useEffect(() => {
		if (isActive && questionRef.current) {
			questionRef.current.scrollIntoView({
				behavior: "smooth",
				block: "start",
			});
		}
	}, [isActive]);

	// Reset selected option when a new question becomes active
	useEffect(() => {
		if (isActive && !isAnswered) {
			setSelectedOption(null);
		}
		if (isAnswered && answeredIndex !== undefined) {
			setSelectedOption(answeredIndex);
		}
	}, [isActive, isAnswered, answeredIndex]);

	const handleSubmit = async () => {
		if (selectedOption === null || isSubmitting || isAnswered) return;

		setIsSubmitting(true);
		try {
			await onSubmitAnswer(selectedOption);
		} catch (error) {
			console.error("Error submitting answer:", error);
		} finally {
			setIsSubmitting(false);
		}
	};

	const isCorrect = isAnswered && selectedOption === data.correctOptionIndex;
	const showExplanation = isAnswered;

	return (
		<div ref={questionRef} className="mb-8 scroll-mt-8">
			<Card
				className={`w-full ${isActive ? "border-primary" : "border-muted"}`}
			>
				<CardHeader>
					<CardTitle className="flex justify-between">
						<span>Question {questionNumber + 1}</span>
						{isAnswered && (
							<span className={isCorrect ? "text-green-500" : "text-red-500"}>
								{isCorrect ? (
									<Check className="inline ml-2" />
								) : (
									<X className="inline ml-2" />
								)}
							</span>
						)}
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<p className="text-lg font-medium">{data.question}</p>
					<div className="space-y-2">
						{data.options.map((option, optIdx) => (
							<QuestionOption
								key={`${option}-${
									// biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
									optIdx
								}`}
								option={option}
								isSelected={selectedOption === optIdx}
								isCorrect={data.correctOptionIndex === optIdx}
								isDisabled={isAnswered || !isActive}
								isRevealed={isAnswered}
								onSelect={() =>
									!isAnswered && isActive && setSelectedOption(optIdx)
								}
							/>
						))}
					</div>

					{showExplanation && (
						<Alert className={isCorrect ? "bg-green-50" : "bg-red-50"}>
							<AlertTitle>{isCorrect ? "Correct!" : "Incorrect!"}</AlertTitle>
							<AlertDescription>{data.explanation}</AlertDescription>
						</Alert>
					)}

					<div className="pt-4 flex justify-end">
						{!isAnswered && isActive && (
							<Button
								onClick={handleSubmit}
								disabled={selectedOption === null || isSubmitting}
							>
								Submit Answer
							</Button>
						)}

						{isAnswered && isActive && (
							<Button onClick={onNextQuestion}>
								{isLastQuestion ? "Finish Quiz" : "Next Question"}
							</Button>
						)}
					</div>
				</CardContent>
			</Card>
		</div>
	);
};

function QuestionOption({
	option,
	isSelected,
	isCorrect,
	isDisabled,
	isRevealed,
	onSelect,
}: {
	option: string;
	isSelected: boolean;
	isCorrect: boolean;
	isDisabled: boolean;
	isRevealed: boolean;
	onSelect: () => void;
}): React.ReactElement {
	let buttonVariant: "outline" | "default" | "secondary" = "outline";
	let extraClasses = "";

	if (isRevealed) {
		if (isCorrect) {
			buttonVariant = "default";
			extraClasses =
				"bg-green-100 border-green-300 text-green-800 hover:bg-green-100";
		} else if (isSelected) {
			buttonVariant = "secondary";
			extraClasses = "bg-red-100 border-red-300 text-red-800 hover:bg-red-100";
		}
	} else if (isSelected) {
		buttonVariant = "default";
	}

	return (
		<Button
			type="button"
			variant={buttonVariant}
			className={`w-full justify-start text-left font-normal h-auto py-3 ${extraClasses}`}
			onClick={onSelect}
			disabled={isDisabled}
		>
			{option}
		</Button>
	);
}
