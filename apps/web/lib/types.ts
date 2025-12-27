import type { InferUITool, ToolUIPart, UIMessage } from "ai";
import { z } from "zod";
import type { ArtifactKind } from "@/components/artifact";
import type { createDocument } from "./ai/tools/create-document";
import type { getWeather } from "./ai/tools/get-weather";
import type { requestSuggestions } from "./ai/tools/request-suggestions";
import type { updateDocument } from "./ai/tools/update-document";
import type { Suggestion } from "./db/schema";

export type DataPart = { type: "append-message"; message: string };

// Token usage statistics from AI model
export const usageSchema = z.object({
	promptTokens: z.number(),
	completionTokens: z.number(),
	totalTokens: z.number(),
});

export type Usage = z.infer<typeof usageSchema>;

export const messageMetadataSchema = z.object({
	createdAt: z.string().optional(),
	// Token usage (present on assistant messages after completion)
	usage: usageSchema.optional(),
	// Model used for this message
	model: z.string().optional(),
	// Whether a fallback model was used
	usedFallback: z.boolean().optional(),
	// When streaming started
	startedAt: z.number().optional(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

// Legacy tools (not currently used but kept for compatibility)
type weatherTool = InferUITool<typeof getWeather>;
type createDocumentTool = InferUITool<ReturnType<typeof createDocument>>;
type updateDocumentTool = InferUITool<ReturnType<typeof updateDocument>>;
type requestSuggestionsTool = InferUITool<
	ReturnType<typeof requestSuggestions>
>;

// Define generic tool types that allow any tool name
// This allows tools from the worker (web_search, url_fetch, duyet_mcp, etc.)
// to be properly typed without importing worker code in the frontend
type GenericToolUIPart = ToolUIPart & {
	type: `tool-${string}`;
};

export type ChatTools = {
	// Legacy tools
	getWeather: weatherTool;
	createDocument: createDocumentTool;
	updateDocument: updateDocumentTool;
	requestSuggestions: requestSuggestionsTool;
	// Allow any other tool - uses string index signature
	[key: string]: any;
};

export type CustomUIDataTypes = Record<string, any> & {
	textDelta: string;
	imageDelta: string;
	sheetDelta: string;
	codeDelta: string;
	suggestion: Suggestion;
	appendMessage: string;
	id: string;
	title: string;
	kind: ArtifactKind;
	clear: null;
	finish: null;
	"chat-title": string;
};

// Extend UIMessage to allow any tool-* part type
export type ChatMessage = UIMessage<
	MessageMetadata,
	CustomUIDataTypes,
	ChatTools
> & {
	parts?: Array<
		| { type: "text"; text: string }
		| { type: "reasoning"; text?: string }
		| { type: "file"; url: string; mediaType: string; filename?: string }
		| GenericToolUIPart
		| any
	>;
};

export type Attachment = {
	name: string;
	url: string;
	contentType: string;
};
