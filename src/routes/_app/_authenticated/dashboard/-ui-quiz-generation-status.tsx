import { Button } from "@/components/ui/button";
import { api } from "@cvx/_generated/api";
import { Link } from "@tanstack/react-router";
import type { Id } from "convex/_generated/dataModel";
import { useQuery } from "convex/react";
// import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
// import { Badge } from '@/components/ui/badge';
import {
	AlertCircle,
	CheckCircle2,
	ExternalLink,
	Loader2,
	XCircle,
} from "lucide-react";
import type React from "react";
import { useQuizGenerator } from "./-ui.quiz-generator-context";

interface QuizTaskItemProps {
	taskId: Id<"quiz_tasks">;
	onDismiss: (taskId: Id<"quiz_tasks">) => void;
	isShowDismissButton?: boolean;
}

export const QuizTaskItem: React.FC<QuizTaskItemProps> = ({
	taskId,
	onDismiss,
	isShowDismissButton = true,
}) => {
	const task = useQuery(api.quizzes.getQuizTaskPublic, { taskId });

	if (!task) {
		return (
			<div className="mb-4 w-full border rounded-lg p-4 shadow">
				<div className="mb-2">
					<h3 className="text-lg font-semibold flex items-center">
						<Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading Task...
					</h3>
				</div>
				<div>
					<p className="text-sm text-gray-600">
						Fetching details for task ID: {taskId}
					</p>
				</div>
			</div>
		);
	}
	const getStatusIcon = (status: string) => {
		switch (status) {
			case "completed":
				return <CheckCircle2 className="mr-2 h-5 w-5 text-green-500" />;
			case "failed":
				return <XCircle className="mr-2 h-5 w-5 text-red-500" />;
			case "pending":
			case "summarizing_content":
			case "summary_completed":
			case "generating_questions":
			case "questions_generated":
			case "storing_quiz":
				return <Loader2 className="mr-2 h-5 w-5 animate-spin text-blue-500" />;
			default:
				return <AlertCircle className="mr-2 h-5 w-5 text-yellow-500" />;
		}
	};

	return (
		<div className="mb-4 w-full border rounded-lg p-4 shadow">
			{/* Header Section */}
			<div className="mb-2">
				<div className="flex items-center justify-between">
					<h3 className="text-lg font-semibold flex items-center">
						{getStatusIcon(task.status)}
						{task.title || `Quiz Task (${taskId.slice(-6)})`}
					</h3>
					<span
						className={`px-2 py-1 text-xs font-semibold rounded-full ${task.status === "completed" ? "bg-green-100 text-green-700" : task.status === "failed" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}
					>
						{task.status.replace(/_/g, " ")}
					</span>
				</div>
				{task.statusMessage && (
					<p className="text-sm text-gray-600 mt-1">{task.statusMessage}</p>
				)}
			</div>

			{/* Content Section */}
			<div className="mb-2">
				{task.status === "failed" && task.error && (
					<p className="text-sm text-red-600">Error: {task.error}</p>
				)}
			</div>

			{/* Footer Section */}
			<div className="flex justify-end space-x-2 pt-2 border-t mt-2">
				{task.status === "completed" && task.quizId && (
					<Button asChild variant="default">
						<Link to="/quizzes/$quizId" params={{ quizId: task.quizId }}>
							View Quiz <ExternalLink className="ml-2 h-4 w-4" />
						</Link>
					</Button>
				)}
				{(task.status === "completed" || task.status === "failed") &&
					isShowDismissButton && (
						<Button variant="outline" onClick={() => onDismiss(taskId)}>
							Dismiss
						</Button>
					)}
			</div>
		</div>
	);
};

export const QuizGenerationStatus: React.FC = () => {
	const { activeTaskIds, setActiveTaskIds } = useQuizGenerator();

	const tasks = useQuery(api.quizzes.getQuizTasks, { limit: 5 });

	const handleDismissTask = (taskIdToDismiss: Id<"quiz_tasks">) => {
		setActiveTaskIds((prevTaskIds) =>
			prevTaskIds.filter((id) => id !== taskIdToDismiss),
		);
	};

	return (
		<div className="w-full mt-12 max-w-3xl space-y-6">
			{!activeTaskIds || activeTaskIds.length === 0 ? null : (
				<div className="flex flex-col gap-6">
					<h2 className=" text-2xl font-semibold text-center">
						Active Quiz Generation
					</h2>
					{activeTaskIds.map((taskId) => (
						<QuizTaskItem
							key={taskId}
							taskId={taskId}
							onDismiss={handleDismissTask}
						/>
					))}
				</div>
			)}
			{tasks && tasks.length > 0 && (
				<div className="flex flex-col gap-2">
					<h2 className=" text-2xl font-semibold text-center">
						Previous Quiz Generation
					</h2>
					{activeTaskIds
						? tasks
								.filter((task) => !activeTaskIds.includes(task._id))
								.map((task) => (
									<QuizTaskItem
										key={task._id}
										taskId={task._id}
										onDismiss={handleDismissTask}
										isShowDismissButton={false}
									/>
								))
						: tasks.map((task) => (
								<QuizTaskItem
									key={task._id}
									taskId={task._id}
									onDismiss={handleDismissTask}
								/>
							))}

					{tasks.length >= 5 && (
						<div className="flex items-center justify-center mb-6">
							<Link to="/dashboard/history" className="">
								<Button variant="outline">Lihat Semua</Button>
							</Link>
						</div>
					)}
				</div>
			)}
		</div>
	);
};
