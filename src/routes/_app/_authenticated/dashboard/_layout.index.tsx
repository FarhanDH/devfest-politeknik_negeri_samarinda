import { HeaderConfiguration } from "@/components/header-provider";
import { Logo } from "@/components/ui/logo";
import siteConfig from "@/site.config";
import { createFileRoute } from "@tanstack/react-router";
import { PromptInputArea } from "./-ui-input-prompt-area";
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
	return (
		<>
			<HeaderConfiguration
				headerDescription="Manage your Apps and view your usage."
				headerTitle="Dashboard"
				isVisible={false}
			/>
			<QuizGeneratorProvider>
				<div className="flex min-h-[80vh] w-full flex-col items-center justify-center bg-background p-4 sm:p-6 md:p-8">
					<div className="w-full max-w-3xl">
						{/* Logo Placeholder - Replace with actual logo component if available */}
						<div className="mb-8 flex justify-center">
							{/* <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground"> */}
							{/* Placeholder for a logo, e.g., a simple shape or an SVG icon */}
							<Logo className="h-16 w-16" />
							{/* </div> */}
						</div>

						<h1 className="mb-10 text-center text-4xl font-semibold text-foreground sm:text-5xl">
							What can I help you with today?
						</h1>

						<PromptInputArea />

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
		</>
	);
}
