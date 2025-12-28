/**
 * History routes for Hono worker
 * GET /api/history - Get chat history with pagination
 * DELETE /api/history - Delete all chats
 */

import { zValidator } from "@hono/zod-validator";
import { desc, eq, gt, inArray, lt } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { chat, message, stream, vote } from "../../lib/db/schema";
import { getSessionFromRequest } from "../lib/auth-helpers";
import { getDb } from "../lib/context";
import { WorkerError } from "../lib/errors";
import type { Env } from "../types";

export const historyRoutes = new Hono<{ Bindings: Env }>();

// Validation schema for history query parameters
const historyQuerySchema = z.object({
	limit: z.coerce.number().int().min(1).max(100).default(10),
	starting_after: z.string().uuid().optional(),
	ending_before: z.string().uuid().optional(),
});

/**
 * GET /api/history
 * Get chat history with pagination
 */
historyRoutes.get("/", zValidator("query", historyQuerySchema), async (c) => {
	const { limit, starting_after, ending_before } = c.req.valid("query");

	if (starting_after && ending_before) {
		throw new WorkerError(
			"bad_request:api",
			"Only one of starting_after or ending_before can be provided.",
		);
	}

	const session = await getSessionFromRequest(c);

	if (!session?.user) {
		throw new WorkerError("unauthorized:chat");
	}

	const db = getDb(c);
	const extendedLimit = limit + 1;

	let filteredChats: (typeof chat.$inferSelect)[] = [];

	if (startingAfter) {
		const [selectedChat] = await db
			.select()
			.from(chat)
			.where(eq(chat.id, startingAfter))
			.limit(1);

		if (!selectedChat) {
			throw new WorkerError(
				"not_found:database",
				`Chat with id ${startingAfter} not found`,
			);
		}

		filteredChats = await db
			.select()
			.from(chat)
			.where(gt(chat.createdAt, selectedChat.createdAt))
			.orderBy(desc(chat.createdAt))
			.limit(extendedLimit);
	} else if (endingBefore) {
		const [selectedChat] = await db
			.select()
			.from(chat)
			.where(eq(chat.id, endingBefore))
			.limit(1);

		if (!selectedChat) {
			throw new WorkerError(
				"not_found:database",
				`Chat with id ${endingBefore} not found`,
			);
		}

		filteredChats = await db
			.select()
			.from(chat)
			.where(lt(chat.createdAt, selectedChat.createdAt))
			.orderBy(desc(chat.createdAt))
			.limit(extendedLimit);
	} else {
		filteredChats = await db
			.select()
			.from(chat)
			.where(eq(chat.userId, session.user.id))
			.orderBy(desc(chat.createdAt))
			.limit(extendedLimit);
	}

	const hasMore = filteredChats.length > limit;

	return c.json({
		chats: hasMore ? filteredChats.slice(0, limit) : filteredChats,
		hasMore,
	});
});

/**
 * DELETE /api/history
 * Delete all chats for current user
 */
historyRoutes.delete("/", async (c) => {
	const session = await getSessionFromRequest(c);

	if (!session?.user) {
		throw new WorkerError("unauthorized:chat");
	}

	const db = getDb(c);

	// Get all user chats
	const userChats = await db
		.select({ id: chat.id })
		.from(chat)
		.where(eq(chat.userId, session.user.id));

	if (userChats.length === 0) {
		return c.json({ deletedCount: 0 });
	}

	const chatIds = userChats.map((c) => c.id);

	// Delete votes, messages, streams, and chats
	await db.delete(vote).where(inArray(vote.chatId, chatIds));
	await db.delete(message).where(inArray(message.chatId, chatIds));
	await db.delete(stream).where(inArray(stream.chatId, chatIds));

	const deletedChats = await db
		.delete(chat)
		.where(eq(chat.userId, session.user.id))
		.returning();

	return c.json({ deletedCount: deletedChats.length });
});
