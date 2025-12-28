/**
 * Client-side API functions to replace Server Actions
 * These functions call the Hono worker API endpoints
 */

import { z } from "zod";
import type { VisibilityType } from "@/components/visibility-selector";
import type { Suggestion } from "@/lib/db/schema";
import { authFormSchema, formatZodError, isZodError } from "./auth/validation";

// Type definitions matching the old Server Actions
export type LoginActionState = {
	status: "idle" | "in_progress" | "success" | "failed" | "invalid_data";
	error?: string;
	token?: string; // JWT token for bearer auth
};

export type RegisterActionState = {
	status:
		| "idle"
		| "in_progress"
		| "success"
		| "failed"
		| "user_exists"
		| "invalid_data";
	error?: string;
	token?: string; // JWT token for bearer auth
};

/**
 * Safe fetch wrapper with error handling and abort support
 */
async function safeFetch<T>(
	url: string,
	options: RequestInit = {},
	schema?: z.ZodSchema<T>,
): Promise<{ data?: T; error?: string; status: number }> {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), 30_000); // 30s timeout

	try {
		const response = await fetch(url, {
			...options,
			signal: controller.signal,
		});

		clearTimeout(timeoutId);

		if (!response.ok) {
			const data = await response.json().catch(() => ({}));
			return {
				error:
					(data as { error?: string }).error ||
					`Request failed with status ${response.status}`,
				status: response.status,
			};
		}

		const json = await response.json();

		if (schema) {
			try {
				const validated = schema.parse(json);
				return { data: validated, status: response.status };
			} catch (error) {
				if (isZodError(error)) {
					return { error: formatZodError(error), status: response.status };
				}
				return { error: "Invalid response format", status: response.status };
			}
		}

		return { data: json as T, status: response.status };
	} catch (error) {
		clearTimeout(timeoutId);

		if (error instanceof Error) {
			if (error.name === "AbortError") {
				return { error: "Request timeout. Please try again.", status: 408 };
			}
			return { error: error.message, status: 0 };
		}

		return { error: "An unexpected error occurred", status: 0 };
	}
}

// Zod schemas for API responses
const _sessionResponseSchema = z.object({
	user: z.object({
		id: z.string(),
		email: z.string().optional(),
	}),
	expires: z.string(),
});

const authResponseSchema = z.object({
	success: z.boolean(),
	user: z.object({
		id: z.string(),
		email: z.string(),
		type: z.enum(["guest", "regular"]),
	}),
	token: z.string(),
});

/**
 * Login with email/password
 */
export async function login(formData: FormData): Promise<LoginActionState> {
	try {
		const validatedData = authFormSchema.parse({
			email: formData.get("email"),
			password: formData.get("password"),
		});

		const result = await safeFetch("/api/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				email: validatedData.email,
				password: validatedData.password,
			}),
		});

		if (result.error) {
			return { status: "failed", error: result.error };
		}

		// Validate and extract token
		const validated = authResponseSchema.safeParse(result.data);
		if (validated.success) {
			return { status: "success", token: validated.data.token };
		}

		return { status: "success" };
	} catch (error) {
		if (isZodError(error)) {
			return { status: "invalid_data", error: formatZodError(error) };
		}
		return { status: "failed", error: "An unexpected error occurred" };
	}
}

/**
 * Register new user
 */
export async function register(
	formData: FormData,
): Promise<RegisterActionState> {
	try {
		const validatedData = authFormSchema.parse({
			email: formData.get("email"),
			password: formData.get("password"),
		});

		const result = await safeFetch("/api/auth/register", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				email: validatedData.email,
				password: validatedData.password,
			}),
		});

		if (result.status === 409) {
			return {
				status: "user_exists",
				error: result.error || "User already exists",
			};
		}

		if (result.error) {
			return { status: "failed", error: result.error };
		}

		// Validate and extract token
		const validated = authResponseSchema.safeParse(result.data);
		if (validated.success) {
			return { status: "success", token: validated.data.token };
		}

		return { status: "success" };
	} catch (error) {
		if (isZodError(error)) {
			return { status: "invalid_data", error: formatZodError(error) };
		}
		return { status: "failed", error: "An unexpected error occurred" };
	}
}

/**
 * Logout
 */
export async function logout(): Promise<void> {
	await safeFetch("/api/auth/logout", { method: "POST" });
	window.location.href = "/";
}

/**
 * Update chat visibility
 */
export async function updateChatVisibility({
	chatId,
	visibility,
}: {
	chatId: string;
	visibility: VisibilityType;
}): Promise<void> {
	const result = await safeFetch("/api/chat/visibility", {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ chatId, visibility }),
	});

	if (result.error) {
		throw new Error(result.error);
	}
}

/**
 * Delete trailing messages after a specific message
 */
export async function deleteTrailingMessages({
	id,
}: {
	id: string;
}): Promise<void> {
	const result = await safeFetch("/api/chat/messages/trailing", {
		method: "DELETE",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ messageId: id }),
	});

	if (result.error) {
		throw new Error(result.error);
	}
}

/**
 * Delete a single message by ID
 */
export async function deleteMessage({ id }: { id: string }): Promise<void> {
	const result = await safeFetch(`/api/chat/messages/${id}`, {
		method: "DELETE",
	});

	if (result.error) {
		throw new Error(result.error);
	}
}

/**
 * Generate title from message and update chat
 * With proper error handling and logging
 */
export async function generateTitleFromUserMessage({
	chatId,
	message,
}: {
	chatId: string;
	message: string;
}): Promise<string> {
	const result = await safeFetch("/api/chat/title", {
		method: "POST",
		body: JSON.stringify({ chatId, message }),
	});

	if (result.error) {
		console.warn("[generateTitle] Failed to generate title:", result.error);
		return "New chat";
	}

	const titleSchema = z.object({ title: z.string().optional() });
	const validated = titleSchema.safeParse(result.data);

	if (!validated.success) {
		console.warn("[generateTitle] Invalid response format");
		return "New chat";
	}

	return validated.data.title || "New chat";
}

/**
 * Get suggestions for document
 */
export async function getSuggestions({
	documentId,
}: {
	documentId: string;
}): Promise<Suggestion[]> {
	const result = await safeFetch(
		`/api/suggestions?documentId=${encodeURIComponent(documentId)}`,
	);

	if (result.error) {
		return [];
	}

	const suggestionsSchema = z.array(z.any());
	const validated = suggestionsSchema.safeParse(result.data);

	return validated.success ? validated.data : [];
}

// Zod schemas for share API
const shareResponseSchema = z.object({
	shareId: z.string(),
	shareToken: z.string(),
	shareUrl: z.string(),
});

/**
 * Create share link for artifact
 */
export async function createArtifactShare({
	documentId,
}: {
	documentId: string;
}): Promise<{ shareUrl: string } | null> {
	const result = await safeFetch(
		`/api/document/share?id=${encodeURIComponent(documentId)}`,
		{
			method: "POST",
		},
		shareResponseSchema,
	);

	if (result.error || !result.data) {
		console.error("[createArtifactShare] Failed:", result.error);
		return null;
	}

	return { shareUrl: result.data.shareUrl };
}

/**
 * Revoke share link for artifact
 */
export async function revokeArtifactShare({
	documentId,
}: {
	documentId: string;
}): Promise<boolean> {
	const result = await safeFetch(
		`/api/document/share?id=${encodeURIComponent(documentId)}`,
		{
			method: "DELETE",
		},
	);

	if (result.error) {
		console.error("[revokeArtifactShare] Failed:", result.error);
		return false;
	}

	return true;
}

/**
 * Get shared artifact (public, no auth)
 */
export async function getSharedArtifact({
	shareId,
}: {
	shareId: string;
}): Promise<any[] | null> {
	const result = await safeFetch(`/api/share/${shareId}`);

	if (result.error || !result.data) {
		console.error("[getSharedArtifact] Failed:", result.error);
		return null;
	}

	return result.data as any[];
}

// Agent types
export type Agent = {
	id: string;
	name: string;
	description: string;
	avatar: string | null;
	systemPrompt: string;
	guidelines: string;
	outputFormat: string;
	modelId: string;
	temperature: string;
	maxTokens: string;
	topP: string;
	frequencyPenalty: string;
	presencePenalty: string;
	enabledTools: string[];
	needsApproval: boolean;
	isEnabled: boolean;
	category: string;
	createdAt: Date;
	updatedAt: Date;
};

export type AgentCategory = {
	value: string;
	label: string;
	description: string;
};

export type AgentTemplate = {
	systemPrompt: string;
	guidelines: string;
	outputFormat: string;
};

// Zod schemas for API responses
const agentsResponseSchema = z.object({
	agents: z.array(
		z.object({
			id: z.string(),
			name: z.string(),
			description: z.string(),
			avatar: z.string().nullable(),
			systemPrompt: z.string(),
			guidelines: z.string(),
			outputFormat: z.string(),
			modelId: z.string(),
			temperature: z.string(),
			maxTokens: z.string(),
			topP: z.string(),
			frequencyPenalty: z.string(),
			presencePenalty: z.string(),
			enabledTools: z.array(z.string()),
			needsApproval: z.boolean(),
			isEnabled: z.boolean(),
			category: z.string(),
			createdAt: z.coerce.date(),
			updatedAt: z.coerce.date(),
		}),
	),
});

const agentResponseSchema = z.object({
	agent: z.object({
		id: z.string(),
		name: z.string(),
		description: z.string(),
		avatar: z.string().nullable(),
		systemPrompt: z.string(),
		guidelines: z.string(),
		outputFormat: z.string(),
		modelId: z.string(),
		temperature: z.string(),
		maxTokens: z.string(),
		topP: z.string(),
		frequencyPenalty: z.string(),
		presencePenalty: z.string(),
		enabledTools: z.array(z.string()),
		needsApproval: z.boolean(),
		isEnabled: z.boolean(),
		category: z.string(),
		createdAt: z.coerce.date(),
		updatedAt: z.coerce.date(),
	}),
});

const templatesResponseSchema = z.object({
	categories: z.array(
		z.object({
			value: z.string(),
			label: z.string(),
			description: z.string(),
		}),
	),
	models: z.array(z.string()),
	templates: z.record(
		z.object({
			systemPrompt: z.string(),
			guidelines: z.string(),
			outputFormat: z.string(),
		}),
	),
});

/**
 * Get all agents for current user
 */
export async function getAgents(): Promise<Agent[] | null> {
	const result = await safeFetch("/api/agents", undefined, agentsResponseSchema);

	if (result.error || !result.data) {
		console.error("[getAgents] Failed:", result.error);
		return null;
	}

	return result.data.agents;
}

/**
 * Get agent templates (categories, models, templates)
 */
export async function getAgentTemplates(): Promise<{
	categories: AgentCategory[];
	models: string[];
	templates: Record<string, AgentTemplate>;
} | null> {
	const result = await safeFetch("/api/agents/templates", undefined, templatesResponseSchema);

	if (result.error || !result.data) {
		console.error("[getAgentTemplates] Failed:", result.error);
		return null;
	}

	return result.data;
}

/**
 * Create a new agent
 */
export async function createAgent(
	agentData: Omit<Agent, "id" | "createdAt" | "updatedAt">,
): Promise<Agent | null> {
	const result = await safeFetch(
		"/api/agents",
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(agentData),
		},
		agentResponseSchema,
	);

	if (result.error || !result.data) {
		console.error("[createAgent] Failed:", result.error);
		return null;
	}

	return result.data.agent;
}

/**
 * Get a specific agent by ID
 */
export async function getAgent(agentId: string): Promise<Agent | null> {
	const result = await safeFetch(`/api/agents/${agentId}`, undefined, agentResponseSchema);

	if (result.error || !result.data) {
		console.error("[getAgent] Failed:", result.error);
		return null;
	}

	return result.data.agent;
}

/**
 * Update an existing agent
 */
export async function updateAgent(
	agentId: string,
	agentData: Omit<Agent, "id" | "createdAt" | "updatedAt">,
): Promise<Agent | null> {
	const result = await safeFetch(
		`/api/agents/${agentId}`,
		{
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(agentData),
		},
		agentResponseSchema,
	);

	if (result.error || !result.data) {
		console.error("[updateAgent] Failed:", result.error);
		return null;
	}

	return result.data.agent;
}

/**
 * Delete an agent
 */
export async function deleteAgent(agentId: string): Promise<boolean> {
	const result = await safeFetch(`/api/agents/${agentId}`, {
		method: "DELETE",
	});

	if (result.error) {
		console.error("[deleteAgent] Failed:", result.error);
		return false;
	}

	return true;
}

/**
 * Toggle agent enabled state
 */
export async function toggleAgent(agentId: string): Promise<Agent | null> {
	const result = await safeFetch(
		`/api/agents/${agentId}/toggle`,
		{
			method: "PATCH",
		},
		agentResponseSchema,
	);

	if (result.error || !result.data) {
		console.error("[toggleAgent] Failed:", result.error);
		return null;
	}

	return result.data.agent;
}
