import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "@cvx/_generated/api";
import type { Id } from "@cvx/_generated/dataModel";
import { vv } from "@cvx/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	notFound,
	useNavigate,
} from "@tanstack/react-router";
import { validate } from "convex-helpers/validators";
import { ChevronLeft, FileQuestion } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/_authenticated/quizzes/$quizId/")({
	component: RouteComponent,
	params: {
		parse: (rawParams) => {
			const isValid = validate(vv.id("quizzes"), rawParams.quizId);
			if (!isValid) {
				throw notFound();
			}
			return {
				quizId: rawParams.quizId as Id<"quizzes">,
			};
		},
	},
});

function RouteComponent() {
	const { quizId } = Route.useParams();
	// const [isTextToSpeechEnabled, setIsTextToSpeechEnabled] = useState(false); // Reverted

	const { data, isLoading } = useQuery(
		convexQuery(api.quizzes.getQuiz, { id: quizId }),
	);

	const navigate = useNavigate();

	const { mutateAsync: startQuizAttempt } = useMutation({
		mutationFn: useConvexMutation(api.quizzes.startQuizAttempt),
	});

	const { mutateAsync: createMultiplayerRoom, isPending: isCreatingRoom } =
		useMutation({
			mutationFn: useConvexMutation(api.multiplayer.createRoom),
		});

	const handleStartSingleQuiz = async () => {
		try {
			const attemptId = await startQuizAttempt({ quizId });
			// Navigate to the play page with the attempt ID
			navigate({
				to: "/quizzes/$quizId/play",
				params: { quizId },
				search: () => ({ attemptId }),
			});
		} catch (error) {
			console.error(error);
			toast.error("Failed to start quiz attempt");
		}
	};

	const handleStartMultiplayerQuiz = async () => {
		try {
			toast.loading("Creating multiplayer room...");
			const result = await createMultiplayerRoom({ quizId });
			if (result?.roomCode) {
				toast.dismiss();
				toast.success("Multiplayer room created!");
				navigate({
					to: "/multiplayer/$roomCode",
					params: { roomCode: result.roomCode },
				});
			} else {
				toast.dismiss();
				throw new Error("Failed to get room code from server.");
			}
		} catch (error) {
			toast.dismiss();
			console.error("Failed to create multiplayer room:", error);
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to create multiplayer room. Please try again.",
			);
		}
	};

	if (!data || isLoading) {
		return <div>Loading...</div>;
	}

	if (!data) {
		return <div>Quiz not found</div>;
	}
	return (
		<div className="relative min-h-screen ">
			<Link to={"/dashboard"} className="absolute top-4 left-4">
				<ChevronLeft />
			</Link>

			<Card className="container mx-auto max-w-4xl border p-4 ">
				<CardHeader>
					<CardTitle className="text-2xl font-bold">{data.title}</CardTitle>
					<CardDescription>{data.description}</CardDescription>
				</CardHeader>
				<CardContent className="flex items-center gap-2">
					<div className="flex items-center gap-2 text-xs">
						<FileQuestion />
						<p className="text-muted-foreground">
							{data.questions.length} questions
						</p>
					</div>
				</CardContent>
				<CardFooter className="flex items-center gap-2 flex-col sm:flex-row">
					<Button onClick={handleStartSingleQuiz}>Start Quiz</Button>
					<Button
						onClick={handleStartMultiplayerQuiz}
						disabled={isCreatingRoom}
					>
						{isCreatingRoom ? "Creating Room..." : "Start with Friend"}
					</Button>
				</CardFooter>
			</Card>
		</div>
	);
}
