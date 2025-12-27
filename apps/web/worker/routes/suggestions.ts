/**
 * Suggestions routes for Hono worker
 * GET /api/suggestions?documentId={id} - Get suggestions for document
 */

import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { suggestion } from "../../lib/db/schema";
import { getSessionFromRequest } from "../lib/auth-helpers";
import { getDb } from "../lib/context";
import { WorkerError } from "../lib/errors";
import type { Env } from "../types";

export const suggestionsRoutes = new Hono<{ Bindings: Env }>();

/**
 * GET /api/suggestions?documentId={id}
 * Get suggestions for document
 */
suggestionsRoutes.get("/", async (c) => {
	const documentId = c.req.query("documentId");

	if (!documentId) {
		throw new WorkerError(
			"bad_request:api",
			"Parameter documentId is required.",
		);
	}

	const session = await getSessionFromRequest(c);

	if (!session?.user) {
		throw new WorkerError("unauthorized:suggestions");
	}

	const db = getDb(c);
	const suggestions = await db
		.select()
		.from(suggestion)
		.where(eq(suggestion.documentId, documentId));

	const [suggestionRecord] = suggestions;

	if (!suggestionRecord) {
		return c.json([]);
	}

	if (suggestionRecord.userId !== session.user.id) {
		throw new WorkerError("forbidden:api");
	}

	return c.json(suggestions);
});
