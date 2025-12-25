/**
 * Documents API Routes
 *
 * Handles document CRUD operations for saving and retrieving user documents.
 */

import { Hono } from 'hono';
import { getUser, requireAuth } from '../lib/auth-middleware';
import { deleteDocument, getDocumentById, saveDocument } from '../lib/db/queries';

type Bindings = {
  DB: D1Database;
};

const documentsRouter = new Hono<{ Bindings: Bindings }>();

interface DocumentSaveRequest {
  id?: string;
  title: string;
  content: string;
  kind: string;
}

/**
 * GET /api/v1/documents?id=xxx
 * Get document by id
 */
documentsRouter.get('/', requireAuth, async (c) => {
  const db = c.env.DB;
  const user = getUser(c);
  const documentId = c.req.query('id');

  if (!documentId) {
    return c.json({ error: 'Missing document id' }, 400);
  }

  try {
    const document = await getDocumentById(db, documentId);

    if (!document) {
      return c.json({ error: 'Document not found' }, 404);
    }

    // Verify ownership
    if (document.user_id !== user.id) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    return c.json({
      id: document.id,
      title: document.title,
      content: document.content,
      kind: document.kind,
      createdAt: document.created_at,
      updatedAt: document.updated_at,
    });
  } catch (error) {
    console.error('[Documents API] Error fetching document:', error);
    return c.json({ error: 'Failed to fetch document' }, 500);
  }
});

/**
 * POST /api/v1/documents
 * Save document (create or update)
 *
 * Body:
 * - id: string (optional, for updates)
 * - title: string
 * - content: string
 * - kind: string
 */
documentsRouter.post('/', requireAuth, async (c) => {
  const db = c.env.DB;
  const user = getUser(c);

  try {
    const body = (await c.req.json()) as DocumentSaveRequest;

    // Validate request body
    if (!body.title || typeof body.title !== 'string') {
      return c.json({ error: 'Invalid or missing title' }, 400);
    }

    if (!body.content || typeof body.content !== 'string') {
      return c.json({ error: 'Invalid or missing content' }, 400);
    }

    if (!body.kind || typeof body.kind !== 'string') {
      return c.json({ error: 'Invalid or missing kind' }, 400);
    }

    const document = await saveDocument(db, {
      id: body.id,
      userId: user.id,
      title: body.title,
      content: body.content,
      kind: body.kind,
    });

    return c.json({
      id: document.id,
      title: document.title,
      content: document.content,
      kind: document.kind,
      createdAt: document.created_at,
      updatedAt: document.updated_at,
    });
  } catch (error) {
    console.error('[Documents API] Error saving document:', error);
    return c.json({ error: 'Failed to save document' }, 500);
  }
});

/**
 * DELETE /api/v1/documents?id=xxx&timestamp=xxx
 * Delete document after timestamp (for optimistic concurrency control)
 */
documentsRouter.delete('/', requireAuth, async (c) => {
  const db = c.env.DB;
  const user = getUser(c);
  const documentId = c.req.query('id');
  const timestamp = c.req.query('timestamp');

  if (!documentId) {
    return c.json({ error: 'Missing document id' }, 400);
  }

  if (!timestamp) {
    return c.json({ error: 'Missing timestamp' }, 400);
  }

  const timestampNum = Number(timestamp);
  if (Number.isNaN(timestampNum)) {
    return c.json({ error: 'Invalid timestamp' }, 400);
  }

  try {
    // Verify ownership before deleting
    const document = await getDocumentById(db, documentId);

    if (!document) {
      return c.json({ error: 'Document not found' }, 404);
    }

    if (document.user_id !== user.id) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const deletedCount = await deleteDocument(db, documentId, timestampNum);

    if (deletedCount === 0) {
      return c.json({ error: 'Document was modified by another client', conflict: true }, 409);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('[Documents API] Error deleting document:', error);
    return c.json({ error: 'Failed to delete document' }, 500);
  }
});

export { documentsRouter };
