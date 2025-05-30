import { HeaderConfiguration } from "@/components/header-provider";
import { Button } from "@/components/retroui/Button";
import { Card } from "@/components/retroui/Card";
import { Input } from "@/components/retroui/Input";
import { Text } from "@/components/retroui/Text";
import { Logo } from "@/components/ui/logo";
import siteConfig from "@/site.config";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "@cvx/_generated/api";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SendHorizonal } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";
import { PromptInputArea } from "./-ui-input-prompt-area";
import { QuizGenerationStatus } from "./-ui-quiz-generation-status";
import { QuizGeneratorProvider } from "./-ui.quiz-generator-context";

export const Route = createFileRoute("/_app/_authenticated/dashboard/_layout/")(
	{
		component: RouteComponent,
		beforeLoad: () => ({
			title: `${siteConfig.siteTitle} - Dashboard`,
		}),
		ssr: true,
	},
);

function RouteComponent() {
	const { data: user } = useQuery(convexQuery(api.app.getCurrentUser, {}));
	const navigate = useNavigate();
	const inputRoomCodeRef = useRef<HTMLInputElement>(null);

	const joinRoom = useMutation({
		mutationFn: useConvexMutation(api.multiplayer.joinRoom),
		onSuccess: () => {
			const roomCode = inputRoomCodeRef.current?.value as string;
			navigate({
				to: "/multiplayer/$roomCode",
				params: {
					roomCode,
				},
			});
		},
	});
	return (
		<div className="flex relative min-h-screen">
			<HeaderConfiguration
				headerDescription="Manage your Apps and view your usage."
				headerTitle="Dashboard"
				isVisible={false}
			/>
			<QuizGeneratorProvider>
				<div className="flex min-h-[80vh] pb-40 md:pb-0 w-full flex-col items-center justify-center bg-background p-4 sm:p-6 md:p-8">
					<div className="w-full max-w-3xl">
						{/* Logo Placeholder - Replace with actual logo component if available */}
						<div className="mb-8 flex justify-center">
							{/* <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground"> */}
							{/* Placeholder for a logo, e.g., a simple shape or an SVG icon */}
							<Logo className="h-16 w-16" />
							{/* </div> */}
						</div>

						<Text
							as="h1"
							className="mb-10 text-center text-4xl font-semibold text-foreground sm:text-5xl"
						>
							Mau Ngerti<span className="text-primary">.</span>in apa hari ini?
						</Text>

						<PromptInputArea />

						{/* Display active quiz generation tasks */}
						<QuizGenerationStatus />

						{/* Example Prompts */}
						{/* <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3  relative z-10 py-10 max-w-7xl mx-auto">
						{SAMPLE_PROMPTS.map((prompt, index) => (
							<FeaturedCard key={prompt.title} {...prompt} index={index} />
						))}
					</div> */}
						{/* <div className="mb-12 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3"></div> */}

						{/* Footer Text */}
						<p className="text-center text-sm text-muted-foreground">
							Our AI-driven solution prioritizes your privacy and data security.
							<a
								href="/privacy"
								className="ml-1 font-medium text-foreground hover:underline"
							>
								{" "}
								{/* Changed href to a more appropriate value */}
								Privacy & Corporate AI
							</a>
						</p>
					</div>
				</div>
			</QuizGeneratorProvider>

			<Card className="fixed bottom-0 left-0 right-0 w-full shadow-md sm:bottom-4 sm:right-4 sm:left-auto sm:max-w-[260px] sm:rounded-md sm:shadow-none sm:hover:shadow-md h-fit">
				<Card.Content>
					<Text className="text-lg">Masukan code bermain dengan temanmu</Text>

					<div className="flex items-center space-x-2 mt-6">
						{/* <Avatar className="h-10 w-10">
							<Avatar.Image
								alt="avatar"
								src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=880&q=80"
							/>
						</Avatar> */}
						<Input
							placeholder="Masukan code"
							ref={inputRoomCodeRef}
							className="flex-grow"
						/>
						<Button
							type="button"
							size="icon"
							disabled={joinRoom.isPending}
							onClick={() => {
								// if (!inputRoomCodeRef.current?.value) return;
								if (inputRoomCodeRef.current?.value.length !== 6) {
									return toast.error("Room code must be 6 characters long");
								}
								joinRoom.mutate({ roomCode: inputRoomCodeRef.current.value });
							}}
						>
							<SendHorizonal className="w-4 h-4" />
						</Button>
					</div>
				</Card.Content>
			</Card>
		</div>
	);
}
