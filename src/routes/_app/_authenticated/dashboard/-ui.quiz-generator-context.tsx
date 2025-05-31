import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "@cvx/_generated/api";
import type { Id } from "@cvx/_generated/dataModel";
import { type UseQueryResult, useQuery } from "@tanstack/react-query";

import type { UploadFileResponse } from "@xixixao/uploadstuff";
import { useAction } from "convex/react";
import React from "react";
import { toast } from "sonner";
import { z } from "zod";

// Types
export interface WebsiteMetadata {
	title: string;
	description: string;
}

export interface FileMetadata {
	name: string;
	size: number; // in bytes
	type: string; // MIME type
}

export interface SourceContent {
	type: "file" | "url" | "prompt";
	data: FileMetadata | WebsiteMetadata | PromptMetadata;
	id: string; // either file ID, URL, or prompt text
}

export interface PromptMetadata {
	title: string;
	content: string;
}

export interface QuizSettings {
	difficulty: "mix" | "easy" | "medium" | "hard";
	questionCount: "5" | "10" | "15" | "30";
}

interface QuizGeneratorContextType {
	activeTaskIds: Id<"quiz_tasks">[];
	// State
	sourceContent: SourceContent | null;
	isProcessing: boolean; // true if processing content (e.g., uploading, fetching metadata)
	isFocused: boolean; // true if any input field is focused
	promptText: string;
	quizSettings: QuizSettings;

	// Refs
	fileRef: React.RefObject<HTMLInputElement | null>;
	urlRef: React.RefObject<HTMLInputElement | null>;
	textareaRef: React.RefObject<HTMLTextAreaElement | null>;

	// Actions
	handleUrlSubmit: (url: string) => Promise<void>;
	handleRemoveContent: () => void;
	handleGenerateQuiz: () => Promise<void>;
	setIsFocused: (focused: boolean) => void;
	setPromptText: (text: string) => void;
	setQuizSettings: (settings: Partial<QuizSettings>) => void;
	setActiveTaskIds: React.Dispatch<React.SetStateAction<Id<"quiz_tasks">[]>>;

	// Upload actions
	onUploadBegin: () => void;
	onUploadComplete: (files: UploadFileResponse[]) => void;
	onUploadError: (error: unknown) => void;

	// Computed values
	canGenerate: boolean;
	getFileUrl: UseQueryResult<string | null, Error>;
	generateUploadUrl: string | (() => Promise<string>);
}

// Validation schema
const urlSchema = z.string().url("Please enter a valid URL");

// Utility function
const getWebsiteMetadata = async (url: string): Promise<WebsiteMetadata> => {
	try {
		const apiUrl = new URL("https://api.microlink.io");
		apiUrl.searchParams.append("url", url);

		const response = await fetch(apiUrl.toString(), {
			headers: { "Content-Type": "application/json" },
		});

		const json = await response.json();

		return {
			title: json.data.title || "Website Title",
			description: json.data.description || "Website Description",
		};
	} catch (error) {
		throw new Error("Failed to fetch website metadata");
	}
};

// Context
const QuizGeneratorContext =
	React.createContext<QuizGeneratorContextType | null>(null);

// Provider Component
export const QuizGeneratorProvider: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => {
	// State
	const [sourceContent, setSourceContent] =
		React.useState<SourceContent | null>(null);
	const [isProcessing, setIsProcessing] = React.useState(false);
	const [isFocused, setIsFocused] = React.useState(false);
	const [promptText, setPromptText] = React.useState("");
	const [quizSettings, setQuizSettingsState] = React.useState<QuizSettings>({
		difficulty: "mix",
		questionCount: "10",
	});
	const [activeTaskIds, setActiveTaskIds] = React.useState<Id<"quiz_tasks">[]>(
		[],
	);

	// Refs
	const fileRef = React.useRef<HTMLInputElement>(null);
	const urlRef = React.useRef<HTMLInputElement>(null);
	const textareaRef = React.useRef<HTMLTextAreaElement>(null);

	// Hooks
	const generateUploadUrl = useConvexMutation(api.app.generateUploadUrl);
	const startGenerateQuizWorkflow = useAction(
		api.quizzes.startGenerateQuizWorkflow,
	);
	const deleteFile = useConvexMutation(api.app.deleteFile);

	const getFileUrl = useQuery(
		convexQuery(api.app.getFileUrl, {
			storageId: sourceContent?.id as Id<"_storage">,
		}),
	);

	// Actions
	const handleUrlSubmit = async (url: string) => {
		const result = urlSchema.safeParse(url);
		if (!result.success) {
			toast.error(result.error.format()._errors[0]);
			return;
		}

		setIsProcessing(true);

		console.log({
			url,
			sourceContent,
			result,
		});

		try {
			const promise = toast.promise(getWebsiteMetadata(url), {
				loading: "Fetching website metadata...",
				success: (data) => `Fetched metadata for ${data.title}`,
				error: "Failed to fetch website metadata",
			});

			const metadata = await promise.unwrap();

			setSourceContent({
				type: "url",
				data: metadata,
				id: url,
			});

			if (urlRef.current) {
				urlRef.current.value = "";
			}
		} catch (error) {
			// Error already handled by toast.promise
		} finally {
			setIsProcessing(false);
		}
	};

	const handleRemoveContent = async () => {
		if (sourceContent?.type === "file") {
			// Remove file from storage
			try {
				await deleteFile({ storageId: sourceContent.id as Id<"_storage"> });
				toast.success("File removed successfully");
			} catch (error) {
				console.error("Error removing file:", error);
				toast.error("Failed to remove file");
			}
		}

		setSourceContent(null);
		setPromptText("");
		if (fileRef.current) {
			fileRef.current.value = "";
		}
		if (urlRef.current) {
			urlRef.current.value = "";
		}
	};

	const handleGenerateQuiz = async () => {
		// Check for content source - either sourceContent or text prompt
		const textPrompt = promptText.trim();

		if (!sourceContent && !textPrompt) {
			toast.error("Please add a PDF file, URL, or enter a text prompt");
			return;
		}

		setIsProcessing(true);

		try {
			let contentType: "file" | "url" | "prompt";
			let content: string;
			let title: string | undefined;

			if (textPrompt) {
				// Handle text prompt
				contentType = "prompt";
				content = textPrompt;
				title = textPrompt.slice(0, 50) + (textPrompt.length > 50 ? "..." : "");
			} else if (sourceContent?.type === "file") {
				// Handle file upload
				contentType = "file";
				content = sourceContent.id; // Use storageId for file content
				title = (sourceContent.data as FileMetadata).name;
			} else if (sourceContent?.type === "url") {
				// Handle URL
				contentType = "url";
				content = sourceContent.id;
				title = (sourceContent.data as WebsiteMetadata).title;
			} else {
				toast.error("Invalid content type");
				return;
			}

			// Show loading toast
			const loadingToast = toast.loading("Generating your quiz...", {
				description: "This may take a moment",
			});

			// Call our orchestrating action
			const taskId = await startGenerateQuizWorkflow({
				contentType,
				content,
				quizSettings,
				title,
			});

			// Dismiss loading toast
			toast.dismiss(loadingToast);

			// Show success message
			toast.success("Quiz generation started!", {
				description: "You can monitor its progress on the dashboard.",
			});

			// Add task to active tasks
			if (taskId) {
				setActiveTaskIds((prev) => [...prev, taskId]);
			}

			// Clear the form
			setPromptText("");
			setSourceContent(null);
		} catch (error) {
			console.error("Error generating quiz:", error);
			toast.error("Failed to generate quiz", {
				description:
					error instanceof Error ? error.message : "Please try again",
			});
		} finally {
			setIsProcessing(false);
		}
	};

	const setQuizSettings = (settings: Partial<QuizSettings>) => {
		setQuizSettingsState((prev) => ({ ...prev, ...settings }));
	};

	// Upload handlers
	const onUploadBegin = () => {
		setIsProcessing(true);
	};

	const onUploadComplete = (files: UploadFileResponse[]) => {
		setIsProcessing(false);
		if (files.length > 0) {
			const file = files[0];
			setSourceContent({
				type: "file",
				data: {
					name: file.name,
					size: file.size,
					type: file.type,
				},
				// biome-ignore lint/suspicious/noExplicitAny: <explanation>
				id: (file.response as any).storageId,
			});
		}
		toast.success("File attached successfully");
	};

	const onUploadError = (error: unknown) => {
		setIsProcessing(false);
		console.error("Upload error:", error);
		toast.error("Something went wrong while uploading the file.");
	};

	// Computed values
	const canGenerate = !isProcessing && (!!sourceContent || !!promptText.trim());

	const contextValue: QuizGeneratorContextType = {
		// State
		sourceContent,
		isProcessing,
		isFocused,
		promptText,
		quizSettings,
		activeTaskIds,

		// Refs
		fileRef,
		urlRef,
		textareaRef,

		// Actions
		handleUrlSubmit,
		handleRemoveContent,
		handleGenerateQuiz,
		setIsFocused,
		setPromptText,
		setQuizSettings,
		setActiveTaskIds, // Added setActiveTaskIds

		// Upload actions
		onUploadBegin,
		onUploadComplete,
		onUploadError,

		// Computed values
		canGenerate,
		getFileUrl,
		generateUploadUrl,
	};

	return (
		<QuizGeneratorContext.Provider value={contextValue}>
			{children}
		</QuizGeneratorContext.Provider>
	);
};

// Custom hook
export const useQuizGenerator = (): QuizGeneratorContextType => {
	const context = React.useContext(QuizGeneratorContext);
	if (!context) {
		throw new Error(
			"useQuizGenerator must be used within a QuizGeneratorProvider",
		);
	}
	return context;
};
