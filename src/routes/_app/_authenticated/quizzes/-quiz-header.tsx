import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

interface QuizPageHeaderProps {
	title?: string;
	onToggleTextToSpeech: () => void;
	isTextToSpeechEnabled: boolean;
	backLink?: string;
}

export function QuizPageHeader({
	title,
	onToggleTextToSpeech,
	isTextToSpeechEnabled,
	backLink,
}: QuizPageHeaderProps) {
	return (
		<header className="sticky top-0 z-10 w-full bg-[var(--card)] border-b-2 border-[var(--border)] shadow-[var(--shadow-sm)] py-3 px-4 mb-6">
			<div className="container mx-auto flex items-center justify-between h-12">
				<div className="flex items-center gap-3">
					{backLink && (
						<Link
							to={backLink}
							className="p-2 -ml-2 text-[var(--foreground)] hover:text-[var(--primary)] transition-colors"
							aria-label="Go back"
						>
							<ChevronLeft size={24} />
						</Link>
					)}
					{title && (
						<h1 className="text-xl font-head text-[var(--foreground)] truncate">
							{title}
						</h1>
					)}
				</div>

				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={onToggleTextToSpeech}
						aria-pressed={isTextToSpeechEnabled}
						className="px-3 py-1.5 border-2 border-[var(--border)] rounded text-sm font-sans font-semibold text-[var(--foreground)] bg-[var(--background)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] shadow-[var(--shadow-xs)] transition-colors"
						title={
							isTextToSpeechEnabled
								? "Disable Text-to-Speech"
								: "Enable Text-to-Speech"
						}
					>
						🔊 Bacain: {isTextToSpeechEnabled ? "ON" : "OFF"}
					</button>
					{/* Future toolbar items can be added here */}
				</div>
			</div>
		</header>
	);
}
