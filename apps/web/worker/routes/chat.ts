/**
 * Chat routes for Hono worker
 * GET /api/chat/:id - Fetch chat with messages by ID
 * POST /api/chat - Main chat endpoint with streaming
 * DELETE /api/chat?id={id} - Delete chat
 * PATCH /api/chat/visibility - Update chat visibility
 * DELETE /api/chat/messages/trailing - Delete trailing messages after timestamp
 * DELETE /api/chat/messages/:id - Delete a single message
 * POST /api/chat/title - Generate title from message (requires AI)
 * POST /api/chat/branch - Create a branch from an existing chat
 */

import { zValidator } from "@hono/zod-validator";
import { generateText, streamText } from "ai";
import { and, eq, gt } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { convertToCoreMessages } from "../../lib/ai/message-converter";
import {
	artifactsPrompt,
	regularPrompt,
	titlePrompt,
} from "../../lib/ai/prompts";
import {
	chat,
	message as messageTable,
	stream,
	vote,
} from "../../lib/db/schema";
import {
	executeWithFallback,
	getLanguageModelForWorker,
	getTitleModelForWorker,
	streamWithFallback,
} from "../lib/ai";
import { createGuestSession, getSessionFromRequest } from "../lib/auth-helpers";
import { getDb } from "../lib/context";
import { WorkerError } from "../lib/errors";
import { createRateLimiters, getRateLimitIdentifier } from "../lib/rate-limit";
import { getWebWorkerTools } from "../lib/tools";
import { generateUUID } from "../lib/utils";
import type { Env } from "../types";

/**
 * Enhanced system prompt combining base prompts with tool descriptions
 *
 * Combines:
 * - Base prompt from existing web UI prompts
 * - Artifact-specific instructions for the web UI
 * - Tool descriptions
 */
function createWebChatSystemPrompt(
	selectedChatModel: string,
	requestHints: {
		latitude: string;
		longitude: string;
		city: string;
		country: string;
	},
) {
	// Build tool descriptions
	const toolDescriptions = `
Available Tools:
- web_search: Web search with DuckDuckGo, date filtering, source credibility scoring
- url_fetch: Fetch and extract text content from URLs
- duyet_mcp: Access information about Duyet (profile, CV, blog posts, GitHub activity)
- plan: Break down complex tasks into steps
- scratchpad: Store and retrieve temporary notes during conversation
- getWeather: Get current weather information for a location (city name or coordinates)

Use these tools when helpful to provide better responses.
`;

	// Request location context
	const locationContext = `
About the user's location:
- lat: ${requestHints.latitude}
- lon: ${requestHints.longitude}
- city: ${requestHints.city}
- country: ${requestHints.country}
`;

	// reasoning models don't need artifacts prompt (they can't use tools)
	if (
		selectedChatModel.includes("reasoning") ||
		selectedChatModel.includes("thinking")
	) {
		return `${regularPrompt}\n\n${toolDescriptions}\n\n${locationContext}`;
	}

	return `${regularPrompt}\n\n${toolDescriptions}\n\n${locationContext}\n\n${artifactsPrompt}`;
}

export const chatRoutes = new Hono<{ Bindings: Env }>();

/**
 * GET /api/chat/:id
 * Fetch chat with messages by ID
 */
chatRoutes.get("/:id", async (c) => {
	const id = c.req.param("id");

	if (!id) {
		throw new WorkerError("bad_request:api", "Parameter id is required");
	}

	const session = await getSessionFromRequest(c);

	if (!session) {
		throw new WorkerError("unauthorized:chat");
	}

	const db = getDb(c);

	// Get chat
	const chats = await db.select().from(chat).where(eq(chat.id, id));
	const chatRecord = chats[0];

	if (!chatRecord) {
		throw new WorkerError("not_found:chat");
	}

	// Check visibility permissions
	if (chatRecord.visibility === "private") {
		if (!session.user) {
			throw new WorkerError("unauthorized:chat");
		}
		if (session.user.id !== chatRecord.userId) {
			throw new WorkerError("forbidden:chat");
		}
	}

	// Get messages
	const messages = await db
		.select()
		.from(messageTable)
		.where(eq(messageTable.chatId, id))
		.orderBy(messageTable.createdAt);

	return c.json({
		id: chatRecord.id,
		title: chatRecord.title,
		visibility: chatRecord.visibility,
		createdAt: chatRecord.createdAt,
		messages,
		isReadonly: session?.user?.id !== chatRecord.userId,
	});
});

// Schema for chat request
const chatMessageSchema = z.object({
	type: z.enum(["text"]),
	text: z.string().min(1).max(2000),
});

const filePartSchema = z.object({
	type: z.enum(["file"]),
	mediaType: z.enum([
		// Images
		"image/jpeg",
		"image/png",
		"image/gif",
		"image/webp",
		"image/svg+xml",
		// Documents
		"application/pdf",
		"text/plain",
		"text/markdown",
		"text/csv",
		// Code files
		"text/javascript",
		"text/typescript",
		"application/json",
		"text/html",
		"text/css",
		"text/xml",
		"application/xml",
	]),
	name: z.string().min(1).max(255),
	url: z.string().url(),
});

const partSchema = z.union([chatMessageSchema, filePartSchema]);

const userMessageSchema = z.object({
	id: z.string().uuid(),
	role: z.enum(["user"]),
	parts: z.array(partSchema),
});

const messageSchema = z.object({
	id: z.string(),
	role: z.string(),
	parts: z.array(z.any()),
});

const postRequestBodySchema = z.object({
	id: z.string().uuid(),
	message: userMessageSchema.optional(),
	messages: z.array(messageSchema).optional(),
	selectedChatModel: z.string(),
	selectedVisibilityType: z.enum(["public", "private"]),
	customInstructions: z.string().optional(),
	aiSettings: z
		.object({
			temperature: z.number().min(0).max(2).optional(),
			maxTokens: z.number().optional(),
			topP: z.number().min(0).max(1).optional(),
			frequencyPenalty: z.number().min(-2).max(2).optional(),
			presencePenalty: z.number().min(-2).max(2).optional(),
		})
		.optional(),
});

/**
 * POST /api/chat
 * Main chat endpoint with streaming AI response
 * Supports guest users - auto-creates guest session if none exists
 */
chatRoutes.post("/", zValidator("json", postRequestBodySchema), async (c) => {
	const startTime = Date.now();
	const requestId = generateUUID().slice(0, 8);

	console.log(`[${requestId}] POST /api/chat started`);

	const {
		id,
		message,
		messages: historyMessages,
		selectedChatModel,
		selectedVisibilityType,
		customInstructions,
		aiSettings,
	} = c.req.valid("json");

	console.log(
		`[${requestId}] Request: chatId=${id}, model=${selectedChatModel}, hasMessage=${!!message}`,
	);

	let session = await getSessionFromRequest(c);
	let sessionToken: string | undefined;
	let isGuest = false;

	// Auto-create guest session if not authenticated
	if (session?.user) {
		console.log(`[${requestId}] Authenticated: userId=${session.user.id}`);
	} else {
		console.log(`[${requestId}] No auth - creating guest session`);
		const guestData = await createGuestSession(c);
		session = guestData.session;
		sessionToken = guestData.token;
		isGuest = true;
		console.log(
			`[${requestId}] Guest session created: userId=${session.user.id}`,
		);
	}

	// Apply rate limiting (stricter for guests)
	// Only apply if RATE_LIMIT_KV binding exists
	let rateLimitInfo:
		| { limit: number; remaining: number; resetAt: string }
		| undefined;

	if (c.env.RATE_LIMIT_KV) {
		const rateLimiters = createRateLimiters(c.env);
		const clientIp =
			c.req.header("cf-connecting-ip") ||
			c.req.header("x-forwarded-for") ||
			"unknown";
		const identifier = getRateLimitIdentifier(
			isGuest ? undefined : session.user.id,
			isGuest ? session.user.id : undefined, // Guest userId as session token
			clientIp,
		);

		// Guests: 10 messages per day, Authenticated: 60 messages per minute
		const rateLimitResult = isGuest
			? await rateLimiters.guest(identifier)
			: await rateLimiters.chat(identifier);

		console.log(
			`[${requestId}] Rate limit check: identifier=${identifier}, allowed=${rateLimitResult.allowed}, remaining=${rateLimitResult.remaining}`,
		);

		// Store rate limit info for response headers
		rateLimitInfo = {
			limit: rateLimitResult.limit,
			remaining: rateLimitResult.remaining,
			resetAt: rateLimitResult.resetAt.toISOString(),
		};

		if (!rateLimitResult.allowed) {
			console.log(`[${requestId}] Rate limit exceeded for ${identifier}`);
			const retryAfter = Math.ceil(
				(rateLimitResult.resetAt.getTime() - Date.now()) / 1000,
			);

			return new Response(
				JSON.stringify({
					error: "rate_limit_exceeded",
					message: isGuest
						? `Guest users are limited to ${rateLimitResult.limit} messages per day. Please sign up for unlimited access.`
						: `Rate limit exceeded. Please try again later.`,
					resetAt: rateLimitInfo.resetAt,
					retryAfter,
				}),
				{
					status: 429,
					headers: {
						"Content-Type": "application/json",
						"X-RateLimit-Limit": String(rateLimitResult.limit),
						"X-RateLimit-Remaining": "0",
						"X-RateLimit-Reset": rateLimitInfo.resetAt,
						"Retry-After": String(retryAfter),
					},
				},
			);
		}
	}

	const db = getDb(c);

	// Check if chat exists
	console.log(`[${requestId}] Checking if chat exists: ${id}`);
	const existingChats = await db.select().from(chat).where(eq(chat.id, id));
	const existingChat = existingChats[0];

	if (existingChat) {
		console.log(
			`[${requestId}] Chat exists: title="${existingChat.title}", userId=${existingChat.userId}`,
		);
		if (existingChat.userId !== session.user.id) {
			console.log(
				`[${requestId}] Forbidden: chat userId=${existingChat.userId} != session userId=${session.user.id}`,
			);
			throw new WorkerError("forbidden:chat");
		}
	} else if (message?.role === "user") {
		// Create new chat
		console.log(
			`[${requestId}] Creating new chat: ${id} with visibility=${selectedVisibilityType}`,
		);
		await db.insert(chat).values({
			id,
			createdAt: new Date(),
			userId: session.user.id,
			title: "New chat",
			visibility: selectedVisibilityType,
		});
		console.log(`[${requestId}] New chat created successfully`);
	}

	// Save user message to database
	const userMessageId = message?.id ?? generateUUID();
	if (message?.role === "user") {
		console.log(`[${requestId}] Saving user message: ${userMessageId}`);
		await db.insert(messageTable).values({
			chatId: id,
			id: userMessageId,
			role: "user",
			parts: message.parts,
			attachments: [],
			createdAt: new Date(),
		});
		console.log(`[${requestId}] User message saved`);
	}

	// Get chat history for context
	console.log(`[${requestId}] Fetching chat history for context`);
	const allMessages = await db
		.select()
		.from(messageTable)
		.where(eq(messageTable.chatId, id))
		.orderBy(messageTable.createdAt);

	console.log(`[${requestId}] Found ${allMessages.length} messages in history`);

	// Convert messages to AI SDK format
	const coreMessages = convertToCoreMessages(allMessages);

	// Generate system prompt with packages/prompts
	// Extract location from Cloudflare request.cf object
	const cf = c.req.raw.cf as
		| {
				latitude?: string;
				longitude?: string;
				city?: string;
				country?: string;
				region?: string;
		  }
		| undefined;

	const requestHints = {
		latitude: cf?.latitude || "0",
		longitude: cf?.longitude || "0",
		city: cf?.city || "Unknown",
		country: cf?.country || "Unknown",
	};

	console.log(
		`[${requestId}] Location: ${requestHints.city}, ${requestHints.country} (${requestHints.latitude},${requestHints.longitude})`,
	);

	let system = createWebChatSystemPrompt(selectedChatModel, requestHints);

	// Append custom instructions if provided
	if (customInstructions?.trim()) {
		system = `${system}\n\nUser's Custom Instructions:\n${customInstructions.trim()}`;
		console.log(
			`[${requestId}] Custom instructions applied (${customInstructions.length} chars)`,
		);
	}

	// Get tools for this session
	const tools = getWebWorkerTools();
	console.log(`[${requestId}] Loaded ${Object.keys(tools).length} tools`);

	// Build AI settings with defaults
	const temperature = aiSettings?.temperature ?? 0.7;

	// Create streaming response with fallback support
	// If the primary model fails (rate limit, unavailable), falls back to alternative models
	console.log(`[${requestId}] Starting AI stream with fallback support...`);
	const { stream: result, modelUsed, usedFallback, fallbacksAttempted } = await streamWithFallback(
		c.env,
		selectedChatModel,
		(model) =>
			streamText({
				model,
				system,
				messages: coreMessages,
				tools,
				temperature,
				...(aiSettings?.maxTokens && { maxTokens: aiSettings.maxTokens }),
				...(aiSettings?.topP !== undefined && { topP: aiSettings.topP }),
				...(aiSettings?.frequencyPenalty !== undefined && {
					frequencyPenalty: aiSettings.frequencyPenalty,
				}),
				...(aiSettings?.presencePenalty !== undefined && {
					presencePenalty: aiSettings.presencePenalty,
				}),
			}),
	);

	if (usedFallback) {
		console.log(
			`[${requestId}] Used fallback model: ${modelUsed} (attempted: ${fallbacksAttempted.join(", ")})`,
		);
	} else {
		console.log(`[${requestId}] Using primary model: ${modelUsed}`);
	}

	// Get the response using toUIMessageStreamResponse for @ai-sdk/react compatibility
	const response = result.toUIMessageStreamResponse();

	// Set session cookie if we created a guest session
	if (sessionToken) {
		response.headers.set(
			"Set-Cookie",
			`session=${sessionToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${30 * 24 * 60 * 60}`,
		);
		console.log(`[${requestId}] Set guest session cookie`);
	}

	// Add rate limit headers to successful response
	if (rateLimitInfo) {
		response.headers.set("X-RateLimit-Limit", String(rateLimitInfo.limit));
		response.headers.set(
			"X-RateLimit-Remaining",
			String(rateLimitInfo.remaining),
		);
		response.headers.set("X-RateLimit-Reset", rateLimitInfo.resetAt);
	}

	// Add fallback information headers
	response.headers.set("X-Model-Used", modelUsed);
	if (usedFallback) {
		response.headers.set("X-Model-Fallback", "true");
		response.headers.set("X-Model-Requested", selectedChatModel);
	}

	const duration = Date.now() - startTime;
	console.log(`[${requestId}] POST /api/chat completed in ${duration}ms`);

	return response;
});

/**
 * DELETE /api/chat?id={id}
 * Delete chat
 */
chatRoutes.delete("/", async (c) => {
	const id = c.req.query("id");

	if (!id) {
		throw new WorkerError("bad_request:api", "Parameter id is required");
	}

	const session = await getSessionFromRequest(c);

	if (!session?.user) {
		throw new WorkerError("unauthorized:chat");
	}

	const db = getDb(c);

	// Get chat
	const chats = await db.select().from(chat).where(eq(chat.id, id));
	const chatRecord = chats[0];

	if (!chatRecord) {
		throw new WorkerError("not_found:chat");
	}

	if (chatRecord.userId !== session.user.id) {
		throw new WorkerError("forbidden:chat");
	}

	// Delete votes, messages, stream, and chat
	await db.delete(vote).where(eq(vote.chatId, id));
	await db.delete(messageTable).where(eq(messageTable.chatId, id));
	await db.delete(stream).where(eq(stream.chatId, id));

	const deletedChats = await db.delete(chat).where(eq(chat.id, id)).returning();

	return c.json(deletedChats[0] || { success: true });
});

/**
 * PATCH /api/chat/visibility
 * Update chat visibility
 */
const visibilitySchema = z.object({
	chatId: z.string().uuid(),
	visibility: z.enum(["public", "private"]),
});

chatRoutes.patch(
	"/visibility",
	zValidator("json", visibilitySchema),
	async (c) => {
		const { chatId, visibility } = c.req.valid("json");

		const session = await getSessionFromRequest(c);

		if (!session?.user) {
			throw new WorkerError("unauthorized:chat");
		}

		const db = getDb(c);

		// Verify ownership
		const chats = await db.select().from(chat).where(eq(chat.id, chatId));
		const chatRecord = chats[0];

		if (!chatRecord) {
			throw new WorkerError("not_found:chat");
		}

		if (chatRecord.userId !== session.user.id) {
			throw new WorkerError("forbidden:chat");
		}

		// Update visibility
		const updated = await db
			.update(chat)
			.set({ visibility })
			.where(eq(chat.id, chatId))
			.returning();

		return c.json(updated[0]);
	},
);

/**
 * DELETE /api/chat/messages/trailing
 * Delete all messages after a specific timestamp in a chat
 */
const trailingMessagesSchema = z.object({
	messageId: z.string().uuid(),
});

chatRoutes.delete(
	"/messages/trailing",
	zValidator("json", trailingMessagesSchema),
	async (c) => {
		const { messageId } = c.req.valid("json");

		const session = await getSessionFromRequest(c);

		if (!session?.user) {
			throw new WorkerError("unauthorized:chat");
		}

		const db = getDb(c);

		// Get the message to find its timestamp and chatId
		const messages = await db
			.select()
			.from(messageTable)
			.where(eq(messageTable.id, messageId));
		const targetMessage = messages[0];

		if (!targetMessage) {
			throw new WorkerError("not_found:message");
		}

		// Verify ownership through chat
		const chats = await db
			.select()
			.from(chat)
			.where(eq(chat.id, targetMessage.chatId));
		const chatRecord = chats[0];

		if (!chatRecord || chatRecord.userId !== session.user.id) {
			throw new WorkerError("forbidden:chat");
		}

		// Delete messages after the target message's timestamp
		await db
			.delete(messageTable)
			.where(
				and(
					eq(messageTable.chatId, targetMessage.chatId),
					gt(messageTable.createdAt, targetMessage.createdAt),
				),
			);

		return c.json({ success: true });
	},
);

/**
 * DELETE /api/chat/messages/:id
 * Delete a single message by ID
 */
chatRoutes.delete("/messages/:id", async (c) => {
	const messageId = c.req.param("id");

	if (!messageId) {
		throw new WorkerError("validation:missing_message_id");
	}

	const session = await getSessionFromRequest(c);

	if (!session?.user) {
		throw new WorkerError("unauthorized:chat");
	}

	const db = getDb(c);

	// Get the message to verify ownership
	const messages = await db
		.select()
		.from(messageTable)
		.where(eq(messageTable.id, messageId));
	const targetMessage = messages[0];

	if (!targetMessage) {
		throw new WorkerError("not_found:message");
	}

	// Verify ownership through chat
	const chats = await db
		.select()
		.from(chat)
		.where(eq(chat.id, targetMessage.chatId));
	const chatRecord = chats[0];

	if (!chatRecord || chatRecord.userId !== session.user.id) {
		throw new WorkerError("forbidden:chat");
	}

	// Delete the message
	await db.delete(messageTable).where(eq(messageTable.id, messageId));

	return c.json({ success: true });
});

/**
 * POST /api/chat/title
 * Generate title from message using AI and update the chat
 */
const titleRequestSchema = z.object({
	chatId: z.string().uuid(),
	message: z.string(),
});

chatRoutes.post("/title", zValidator("json", titleRequestSchema), async (c) => {
	const { chatId, message } = c.req.valid("json");

	const session = await getSessionFromRequest(c);

	if (!session?.user) {
		throw new WorkerError("unauthorized:chat");
	}

	const db = getDb(c);

	// Verify chat ownership
	const chats = await db.select().from(chat).where(eq(chat.id, chatId));
	const chatRecord = chats[0];

	if (!chatRecord) {
		throw new WorkerError("not_found:chat");
	}

	if (chatRecord.userId !== session.user.id) {
		throw new WorkerError("forbidden:chat");
	}

	try {
		// Use executeWithFallback for title generation with graceful degradation
		const result = await executeWithFallback(
			c.env,
			"anthropic/claude-3.5-haiku", // Primary title model
			async (model) => {
				const { text } = await generateText({
					model,
					prompt: `${titlePrompt}\n\nUser message: ${message}`,
				});
				return text;
			},
		);

		if (!result.success) {
			console.error("[Title Generation] All models failed:", result.error);
			return c.json({ title: "New chat" });
		}

		const title = result.result?.trim() || "New chat";

		if (result.fallbacksAttempted.length > 0) {
			console.log(
				`[Title Generation] Used fallback: ${result.modelUsed} (tried: ${result.fallbacksAttempted.join(", ")})`,
			);
		}

		// Update the chat title in database
		await db.update(chat).set({ title }).where(eq(chat.id, chatId));

		return c.json({ title });
	} catch (error) {
		console.error("[Title Generation] Error:", error);
		// Fallback to "New chat" if AI fails
		return c.json({ title: "New chat" });
	}
});

/**
 * POST /api/chat/branch
 * Create a branch from an existing chat at a specific message
 */
const branchRequestSchema = z.object({
	chatId: z.string().min(1),
	messageId: z.string().optional(), // Branch point message ID
});

chatRoutes.post(
	"/branch",
	zValidator("json", branchRequestSchema),
	async (c) => {
		const { chatId, messageId } = c.req.valid("json");

		const session = await getSessionFromRequest(c);
		if (!session?.user) {
			throw new WorkerError(
				"unauthorized:chat",
				"Must be logged in to branch chat",
			);
		}

		const db = getDb(c);

		// Get the original chat
		const [originalChat] = await db
			.select()
			.from(chat)
			.where(eq(chat.id, chatId))
			.limit(1);

		if (!originalChat) {
			throw new WorkerError("not_found:database", `Chat ${chatId} not found`);
		}

		// Verify user owns the chat
		if (originalChat.userId !== session.user.id) {
			throw new WorkerError(
				"unauthorized:chat",
				"Cannot branch another user's chat",
			);
		}

		// Get messages to copy (all messages up to branchPoint if provided)
		let messagesToCopy = await db
			.select()
			.from(messageTable)
			.where(eq(messageTable.chatId, chatId))
			.orderBy(messageTable.createdAt);

		// If messageId is provided, only copy messages up to and including that message
		if (messageId) {
			const branchIndex = messagesToCopy.findIndex((m) => m.id === messageId);
			if (branchIndex !== -1) {
				messagesToCopy = messagesToCopy.slice(0, branchIndex + 1);
			}
		}

		// Create the new branched chat
		const newChatId = generateUUID();
		const now = new Date();

		await db.insert(chat).values({
			id: newChatId,
			userId: session.user.id,
			title: `${originalChat.title} (Branch)`,
			visibility: originalChat.visibility,
			parentChatId: chatId,
			branchPoint: messageId ? now : null,
			createdAt: now,
		});

		// Copy messages to the new chat with new IDs
		if (messagesToCopy.length > 0) {
			const newMessages = messagesToCopy.map((msg) => ({
				id: generateUUID(),
				chatId: newChatId,
				role: msg.role,
				parts: msg.parts,
				attachments: msg.attachments,
				createdAt: msg.createdAt,
			}));

			await db.insert(messageTable).values(newMessages);
		}

		return c.json({
			newChatId,
			messageCount: messagesToCopy.length,
		});
	},
);
