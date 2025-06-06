import { Logo } from "@/components/ui/logo";
import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/_authenticated/onboarding/_layout")(
	{
		component: OnboardingLayout,
	},
);

export default function OnboardingLayout() {
	return (
		<div className="relative flex h-screen w-full">
			<div className="absolute left-1/2 top-8 mx-auto -translate-x-1/2 transform justify-center">
				<Logo />
			</div>
			<div className="z-10 h-screen w-screen">
				<Outlet />
			</div>
			<div className="base-grid fixed h-screen w-screen opacity-40" />
			<div className="fixed bottom-0 h-screen w-screen bg-gradient-to-t from-[hsl(var(--card))] to-transparent" />
		</div>
	);
}
