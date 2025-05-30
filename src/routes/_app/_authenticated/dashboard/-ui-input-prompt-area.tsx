import { Button } from "@/components/retroui/Button";
import { Input } from "@/components/retroui/Input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { UploadDropzone } from "@xixixao/uploadstuff/react";
import { ArrowUp, FileArchive, Globe, Link, Sparkles, X } from "lucide-react";
import type React from "react";
import {
	type FileMetadata,
	type QuizSettings as TQuizSettings,
	type WebsiteMetadata,
	useQuizGenerator,
} from "./-ui.quiz-generator-context";

// Separate components for better organization
const QuizSettings: React.FC = () => {
	const { quizSettings, setQuizSettings } = useQuizGenerator();

	return (
		<div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
			<div className="flex items-center gap-2 w-full xs:w-auto">
				<span className="text-xs font-medium text-foreground whitespace-nowrap font-sans">
					Difficulty:
				</span>
				<Select
					value={quizSettings.difficulty}
					onValueChange={(value) =>
						setQuizSettings({
							difficulty: value as TQuizSettings["difficulty"],
						})
					}
				>
					<SelectTrigger className="h-8 text-xs border-2 border-border bg-background shadow-sm flex-1 xs:flex-none xs:w-20">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="mix">Mix</SelectItem>
						<SelectItem value="easy">Easy</SelectItem>
						<SelectItem value="medium">Medium</SelectItem>
						<SelectItem value="hard">Hard</SelectItem>
					</SelectContent>
				</Select>
			</div>

			<div className="flex items-center gap-2 w-full xs:w-auto">
				<span className="text-xs font-medium text-foreground whitespace-nowrap font-sans">
					Questions:
				</span>
				<Select
					value={quizSettings.questionCount}
					onValueChange={(value) =>
						setQuizSettings({
							questionCount: value as TQuizSettings["questionCount"],
						})
					}
				>
					<SelectTrigger className="h-8 text-xs border-2 border-border bg-background shadow-sm flex-1 xs:flex-none xs:w-16">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="5">5</SelectItem>
						<SelectItem value="10">10</SelectItem>
						<SelectItem value="15">15</SelectItem>
						<SelectItem value="30">30</SelectItem>
					</SelectContent>
				</Select>
			</div>
		</div>
	);
};

const FileUploadCard: React.FC = () => {
	const {
		generateUploadUrl,
		isProcessing,
		onUploadBegin,
		onUploadComplete,
		onUploadError,
	} = useQuizGenerator();

	return (
		<div className="relative overflow-hidden flex">
			<UploadDropzone
				uploadUrl={generateUploadUrl}
				fileTypes={{
					"application/pdf": [".pdf"],
				}}
				multiple={false}
				uploadImmediately
				onUploadError={onUploadError}
				className={() =>
					"flex flex-col items-center justify-center flex-1 border-2 border-border bg-card hover:bg-primary/10 transition-colors duration-200 cursor-pointer shadow-md font-sans"
				}
				onUploadBegin={onUploadBegin}
				onUploadComplete={onUploadComplete}
			/>

			{isProcessing && (
				<div className="absolute inset-0 bg-card border-2 border-border flex items-center justify-center">
					<div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
				</div>
			)}
		</div>
	);
};

const WebsiteUrlCard: React.FC = () => {
	const { urlRef, isProcessing, handleUrlSubmit } = useQuizGenerator();

	return (
		<div className="relative overflow-hidden border-2 border-border bg-card shadow-md">
			<div className="p-4 sm:p-6">
				<div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center border-2 border-border bg-accent shadow-sm">
					<Link className="h-6 w-6 text-foreground" />
				</div>
				<h3 className="font-head text-sm mb-3 text-center text-foreground">
					Add Website
				</h3>
				<div className="flex flex-col sm:flex-row gap-2">
					<Input
						// ref={urlRef}
						type="url"
						placeholder="Paste URL here..."
						className="text-sm border-2 border-border bg-background shadow-sm flex-1 font-sans"
						disabled={isProcessing}
						onKeyDown={(e) => {
							if (e.key === "Enter" && urlRef.current?.value) {
								handleUrlSubmit(urlRef.current.value);
							}
						}}
					/>
					<Button
						variant="secondary"
						size="sm"
						className="px-3 w-full sm:w-auto font-sans"
						disabled={isProcessing}
						onClick={() => {
							if (urlRef.current?.value) {
								handleUrlSubmit(urlRef.current.value);
							}
						}}
					>
						<ArrowUp className="h-4 w-4 sm:mr-1" />
						<span className="hidden sm:inline">Add</span>
					</Button>
				</div>
			</div>
			{isProcessing && (
				<div className="absolute inset-0 bg-card border-2 border-border flex items-center justify-center">
					<div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
				</div>
			)}
		</div>
	);
};

const SourceContentDisplay: React.FC = () => {
	const { sourceContent, handleRemoveContent, isProcessing } =
		useQuizGenerator();

	if (!sourceContent) return null;

	return (
		<div className="border-2 border-border bg-card shadow-md p-4">
			<div className="flex items-start sm:items-center justify-between gap-3">
				<div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
					<div className="flex items-center justify-center w-10 h-10 border-2 border-border shadow-sm flex-shrink-0 bg-background text-foreground">
						{sourceContent.type === "file" ? (
							<FileArchive className="h-5 w-5" />
						) : (
							<Globe className="h-5 w-5" />
						)}
					</div>
					<div className="min-w-0 flex-1">
						<h4 className="font-medium text-sm truncate text-foreground font-sans">
							{sourceContent.type === "file"
								? (sourceContent.data as FileMetadata).name
								: (sourceContent.data as WebsiteMetadata).title}
						</h4>
						<p className="text-xs text-muted-foreground line-clamp-2 sm:line-clamp-1 font-sans">
							{sourceContent.type === "file"
								? `${((sourceContent.data as FileMetadata).size / 1024 / 1024).toFixed(1)} MB`
								: (sourceContent.data as WebsiteMetadata).description}
						</p>
					</div>
				</div>
				<Button
					// variant="destructive"
					size="icon"
					className="flex-shrink-0"
					onClick={handleRemoveContent}
					disabled={isProcessing}
				>
					<X className="h-4 w-4" />
				</Button>
			</div>
		</div>
	);
};

export const PromptInputArea: React.FC = () => {
	const {
		textareaRef,
		isFocused,
		setIsFocused,
		promptText,
		setPromptText,
		sourceContent,
		canGenerate,
		handleGenerateQuiz,
	} = useQuizGenerator();

	return (
		<div className="mb-8 w-full">
			{/* Main container with retro border */}
			<div className="border-2 border-border bg-card shadow-lg">
				{/* Header with icon */}
				<div className="flex items-center gap-3 p-4 border-b-2 border-border bg-primary">
					<div className="flex items-center justify-center w-8 h-8 border-2 border-border bg-secondary shadow-sm">
						<Sparkles className="h-4 w-4 text-secondary-foreground" />
					</div>
					<div className="min-w-0 flex-1">
						<h3 className="font-head text-sm text-primary-foreground">
							Quiz Generator
						</h3>
						<p className="text-xs opacity-80 hidden sm:block font-sans text-primary-foreground">
							Create practice questions from your content
						</p>
					</div>
				</div>

				{/* Main input area */}
				<div className="p-4">
					<div
						className={`border-2 transition-colors duration-200 ${
							isFocused
								? "border-primary bg-primary/5"
								: "border-border bg-background"
						} shadow-sm`}
					>
						<textarea
							ref={textareaRef}
							placeholder="What topic would you like to practice today?"
							className="w-full resize-none border-0 bg-transparent p-4 text-sm placeholder-muted-foreground focus:ring-0 focus:outline-none min-h-[100px] font-sans"
							rows={3}
							value={promptText}
							onChange={(e) => setPromptText(e.target.value)}
							onFocus={() => setIsFocused(true)}
							onBlur={() => setIsFocused(false)}
						/>

						{/* Settings bar */}
						<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 pt-0 border-t-2 border-border bg-card">
							<QuizSettings />

							<Button
								variant="default"
								size="sm"
								className="h-9 px-4 w-full sm:w-auto font-sans font-medium"
								onClick={handleGenerateQuiz}
								disabled={!canGenerate}
							>
								<Sparkles className="h-4 w-4 mr-1" />
								<span className="text-sm">Generate</span>
							</Button>
						</div>
					</div>
				</div>
			</div>

			{/* Source content section */}
			<div className="mt-4">
				{!sourceContent ? (
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<FileUploadCard />
						<WebsiteUrlCard />
					</div>
				) : (
					<SourceContentDisplay />
				)}
			</div>
		</div>
	);
};
