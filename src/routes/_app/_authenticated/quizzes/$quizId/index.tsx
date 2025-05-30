import { convexQuery } from "@convex-dev/react-query";
import { api } from "@cvx/_generated/api";
import type { Id } from "@cvx/_generated/dataModel";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/_authenticated/quizzes/$quizId/")({
	component: RouteComponent,
});

function RouteComponent() {
	const { quizId } = Route.useParams();
	const { data: quiz } = useQuery(
		convexQuery(api.quizzes.getQuiz, { id: quizId as Id<"quizzes"> }),
	);
	return <pre> {JSON.stringify(quiz, null, 2)}</pre>;
}
