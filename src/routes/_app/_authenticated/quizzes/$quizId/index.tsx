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
	notFound,
	useNavigate,
} from "@tanstack/react-router";
import { validate } from "convex-helpers/validators";
import { ChevronLeft, FileQuestion } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

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
					<Button>Start with Friend</Button>
				</CardFooter>
			</Card>
		</div>
	);
}
