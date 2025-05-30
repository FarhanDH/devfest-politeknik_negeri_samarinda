import { WorkflowManager } from "@convex-dev/workflow";
// convex/index.ts
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { components } from "./_generated/api";

export const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
	throw new Error("Missing OpenRouter API key");
}

export type OpenrouterCompletions = {
	id: string;
	provider: string;
	model: string;
	object: string;
	created: number;
	choices: Array<{
		message: {
			role: string;
			content: string;
		};
	}>;
	usage: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
};

export const openrouter = createOpenRouter({
	apiKey: OPENROUTER_API_KEY,
});

export const workflow = new WorkflowManager(components.workflow);
