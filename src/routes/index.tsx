import { Button } from "@/components/retroui/Button";
import { Logo } from "@/components/ui/logo";
import { SignInButton, SignUp } from "@clerk/clerk-react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Authenticated, Unauthenticated, useConvexAuth } from "convex/react";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
	component: Index,
	ssr: true,
});

function Index() {
	const { isLoading, isAuthenticated } = useConvexAuth();
	const navigate = useNavigate();

	useEffect(() => {
		if (isLoading) return;
		if (isAuthenticated) {
			navigate({ to: "/dashboard" });
		}
	}, [isLoading, isAuthenticated]);
	return (
		<div className="relative flex h-full w-full flex-col bg-card">
			{/* Navigation */}
			<div className="sticky top-0 z-50 mx-auto flex w-full max-w-screen-lg items-center justify-between p-6 py-3">
				<Link to="/" className="flex h-10 items-center gap-1">
					<Logo />
				</Link>
				<div className="flex items-center gap-4">
					<Unauthenticated>
						<SignInButton
							mode="modal"
							fallbackRedirectUrl={"/dashboard"}
							signUpFallbackRedirectUrl={"/onboarding/username"}
						>
							<Button size={"sm"} disabled={isLoading}>
								{isLoading && <Loader2 className="animate-spin w-16 h-4" />}
								{!isLoading && !isAuthenticated && "Get Started"}
							</Button>
						</SignInButton>
					</Unauthenticated>

					<Authenticated>
						<Button size={"sm"} disabled={isLoading}>
							<Link
								to={"/dashboard"}
								// className={buttonVariants({ size: "sm" })}
								disabled={isLoading}
							>
								{isLoading && <Loader2 className="animate-spin w-16 h-4" />}
								{!isLoading && isAuthenticated && "Dashboard"}
							</Link>
						</Button>
					</Authenticated>
				</div>
			</div>

			<Unauthenticated>
				<div className="flex mt-40 justify-center h-screen">
					<SignUp />
				</div>
			</Unauthenticated>
		</div>
	);
}
