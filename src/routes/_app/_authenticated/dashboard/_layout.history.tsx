import { api } from "@cvx/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { QuizTaskItem } from "./-ui-quiz-generation-status";

export const Route = createFileRoute(
	"/_app/_authenticated/dashboard/_layout/history",
)({
	component: RouteComponent,
});

function RouteComponent() {
	const tasks = useQuery(api.quizzes.getQuizTasks, { limit: 99 });

	return (
		<div className="w-full mt-12 max-w-3xl space-y-6 mx-auto">
			{tasks && tasks.length > 0 && (
				<div className="flex flex-col gap-2">
					<h2 className=" text-2xl font-semibold text-start">
						History Generasi Kuis
					</h2>
					{tasks
						? tasks.map((task) => (
								<QuizTaskItem
									key={task._id}
									taskId={task._id}
									onDismiss={() => {}}
									isShowDismissButton={false}
								/>
							))
						: null}
				</div>
			)}
		</div>
	);
}
