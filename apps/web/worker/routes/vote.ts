/**
 * Vote routes for Hono worker
 * GET /api/vote?chatId={id} - Get votes for chat
 * PATCH /api/vote - Vote on message
 */

import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { chat, vote } from "../../lib/db/schema";
import { getSessionFromRequest } from "../lib/auth-helpers";
import { getDb } from "../lib/context";
import { WorkerError } from "../lib/errors";
import type { Env } from "../types";

export const voteRoutes = new Hono<{ Bindings: Env }>();

// Schema for vote request
const voteSchema = z.object({
	chatId: z.string(),
	messageId: z.string(),
	type: z.enum(["up", "down"]),
});

/**
 * GET /api/vote?chatId={id}
 * Get votes for chat
 */
voteRoutes.get("/", async (c) => {
	const chatId = c.req.query("chatId");

	if (!chatId) {
		throw new WorkerError("bad_request:api", "Parameter chatId is required.");
	}

	const session = await getSessionFromRequest(c);

	if (!session?.user) {
		throw new WorkerError("unauthorized:vote");
	}

	const db = getDb(c);
	const chats = await db.select().from(chat).where(eq(chat.id, chatId));
	const chatRecord = chats[0];

	if (!chatRecord) {
		throw new WorkerError("not_found:chat");
	}

	if (chatRecord.userId !== session.user.id) {
		throw new WorkerError("forbidden:vote");
	}

	const votes = await db.select().from(vote).where(eq(vote.chatId, chatId));

	return c.json(votes);
});

/**
 * PATCH /api/vote
 * Vote on message
 */
voteRoutes.patch("/", zValidator("json", voteSchema), async (c) => {
	const { chatId, messageId, type } = c.req.valid("json");

	const session = await getSessionFromRequest(c);

	if (!session?.user) {
		throw new WorkerError("unauthorized:vote");
	}

	const db = getDb(c);
	const chats = await db.select().from(chat).where(eq(chat.id, chatId));
	const chatRecord = chats[0];

	if (!chatRecord) {
		throw new WorkerError("not_found:vote");
	}

	if (chatRecord.userId !== session.user.id) {
		throw new WorkerError("forbidden:vote");
	}

	// Check for existing vote
	const existingVotes = await db
		.select()
		.from(vote)
		.where(eq(vote.messageId, messageId));

	if (existingVotes.length > 0) {
		// Update existing vote
		await db
			.update(vote)
			.set({ isUpvoted: type === "up" })
			.where(eq(vote.messageId, messageId));
	} else {
		// Insert new vote
		await db.insert(vote).values({
			chatId,
			messageId,
			isUpvoted: type === "up",
		});
	}

	return c.body(null, 200);
});
