/**
 * Document routes for Hono worker
 * GET /api/document?id={id} - Get document
 * POST /api/document?id={id} - Save document
 * DELETE /api/document?id={id}&timestamp={ts} - Delete document after timestamp
 * POST /api/document/share?id={id} - Create share link
 * DELETE /api/document/share?id={id} - Revoke share link
 */

import { and, eq, gt } from "drizzle-orm";
import { Hono } from "hono";
import { document } from "../../lib/db/schema";
import { getSessionFromRequest } from "../lib/auth-helpers";
import { getDb } from "../lib/context";
import { WorkerError } from "../lib/errors";
import type { Env } from "../types";

export const documentRoutes = new Hono<{ Bindings: Env }>();
export const shareRoutes = new Hono<{ Bindings: Env }>();

type ArtifactKind = "text" | "code" | "image" | "sheet";

/**
 * GET /api/document?id={id}
 * Get document
 */
documentRoutes.get("/", async (c) => {
	const id = c.req.query("id");

	if (!id) {
		throw new WorkerError("bad_request:api", "Parameter id is missing");
	}

	const session = await getSessionFromRequest(c);

	if (!session?.user) {
		throw new WorkerError("unauthorized:document");
	}

	const db = getDb(c);
	const documents = await db
		.select()
		.from(document)
		.where(eq(document.id, id))
		.orderBy(document.createdAt);

	const [doc] = documents;

	if (!doc) {
		throw new WorkerError("not_found:document");
	}

	if (doc.userId !== session.user.id) {
		throw new WorkerError("forbidden:document");
	}

	return c.json(documents);
});

/**
 * POST /api/document?id={id}
 * Save document
 */
documentRoutes.post("/", async (c) => {
	const id = c.req.query("id");

	if (!id) {
		throw new WorkerError("bad_request:api", "Parameter id is required.");
	}

	const session = await getSessionFromRequest(c);

	if (!session?.user) {
		throw new WorkerError("not_found:document");
	}

	const {
		content,
		title,
		kind,
	}: { content: string; title: string; kind: ArtifactKind } =
		await c.req.json();

	const db = getDb(c);
	const documents = await db.select().from(document).where(eq(document.id, id));

	if (documents.length > 0) {
		const [doc] = documents;

		if (doc.userId !== session.user.id) {
			throw new WorkerError("forbidden:document");
		}
	}

	const [savedDocument] = await db
		.insert(document)
		.values({
			id,
			content,
			title,
			kind,
			userId: session.user.id,
			createdAt: new Date(),
		})
		.returning();

	return c.json(savedDocument);
});

/**
 * DELETE /api/document?id={id}&timestamp={ts}
 * Delete document after timestamp
 */
documentRoutes.delete("/", async (c) => {
	const id = c.req.query("id");
	const timestamp = c.req.query("timestamp");

	if (!id) {
		throw new WorkerError("bad_request:api", "Parameter id is required.");
	}

	if (!timestamp) {
		throw new WorkerError(
			"bad_request:api",
			"Parameter timestamp is required.",
		);
	}

	const session = await getSessionFromRequest(c);

	if (!session?.user) {
		throw new WorkerError("unauthorized:document");
	}

	const db = getDb(c);
	const documents = await db.select().from(document).where(eq(document.id, id));

	const [doc] = documents;

	if (!doc || doc.userId !== session.user.id) {
		throw new WorkerError("forbidden:document");
	}

	const deleted = await db
		.delete(document)
		.where(
			and(eq(document.id, id), gt(document.createdAt, new Date(timestamp))),
		)
		.returning();

	return c.json(deleted);
});

/**
 * POST /api/document/share?id={id}
 * Create share link for document
 */
documentRoutes.post("/share", async (c) => {
	const id = c.req.query("id");

	if (!id) {
		throw new WorkerError("bad_request:api", "Parameter id is required.");
	}

	const session = await getSessionFromRequest(c);

	if (!session?.user) {
		throw new WorkerError("unauthorized:document");
	}

	const db = getDb(c);
	const documents = await db.select().from(document).where(eq(document.id, id));

	if (documents.length === 0) {
		throw new WorkerError("not_found:document");
	}

	const [doc] = documents;

	if (doc.userId !== session.user.id) {
		throw new WorkerError("forbidden:document");
	}

	// Generate share link if it doesn't exist
	const shareId = doc.shareId ?? crypto.randomUUID();
	const shareToken = doc.shareToken ?? crypto.randomUUID().slice(0, 8);

	await db
		.update(document)
		.set({
			shareId,
			shareToken,
			isPublic: true,
		})
		.where(eq(document.id, id));

	return c.json({
		shareId,
		shareToken,
		shareUrl: `${new URL(c.req.url).origin}/share/${shareId}`,
	});
});

/**
 * DELETE /api/document/share?id={id}
 * Revoke share link for document
 */
documentRoutes.delete("/share", async (c) => {
	const id = c.req.query("id");

	if (!id) {
		throw new WorkerError("bad_request:api", "Parameter id is required.");
	}

	const session = await getSessionFromRequest(c);

	if (!session?.user) {
		throw new WorkerError("unauthorized:document");
	}

	const db = getDb(c);
	const documents = await db.select().from(document).where(eq(document.id, id));

	if (documents.length === 0) {
		throw new WorkerError("not_found:document");
	}

	const [doc] = documents;

	if (doc.userId !== session.user.id) {
		throw new WorkerError("forbidden:document");
	}

	await db
		.update(document)
		.set({
			shareId: null,
			shareToken: null,
			isPublic: false,
		})
		.where(eq(document.id, id));

	return c.json({ success: true });
});

/**
 * GET /api/share/:shareId
 * Get shared document (public, no auth required)
 */
shareRoutes.get("/:shareId", async (c) => {
	const shareId = c.req.param("shareId");

	if (!shareId) {
		throw new WorkerError("bad_request:api", "Parameter shareId is required.");
	}

	const db = getDb(c);
	const documents = await db
		.select()
		.from(document)
		.where(eq(document.shareId, shareId))
		.orderBy(document.createdAt);

	if (documents.length === 0) {
		throw new WorkerError("not_found:share");
	}

	const [doc] = documents;

	if (!doc.isPublic) {
		throw new WorkerError("forbidden:share");
	}

	return c.json(documents);
});
