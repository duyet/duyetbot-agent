/**
 * Document routes for Hono worker
 * GET /api/document?id={id} - Get document
 * POST /api/document?id={id} - Save document
 * DELETE /api/document?id={id}&timestamp={ts} - Delete document after timestamp
 */

import { and, eq, gt } from "drizzle-orm";
import { Hono } from "hono";
import { document } from "../../lib/db/schema";
import { getSessionFromRequest } from "../lib/auth-helpers";
import { getDb } from "../lib/context";
import { WorkerError } from "../lib/errors";
import type { Env } from "../types";

export const documentRoutes = new Hono<{ Bindings: Env }>();

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
      "Parameter timestamp is required."
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
      and(eq(document.id, id), gt(document.createdAt, new Date(timestamp)))
    )
    .returning();

  return c.json(deleted);
});
