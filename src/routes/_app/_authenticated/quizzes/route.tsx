import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/_authenticated/quizzes")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<div className="flex flex-col min-h-screen bg-background">
			<Outlet />
		</div>
	);
}
