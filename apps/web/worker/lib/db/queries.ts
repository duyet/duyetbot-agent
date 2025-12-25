/**
 * Database Query Functions
 *
 * Centralized database queries for sessions, settings, and documents.
 */

export interface Session {
  id: string;
  user_id: string;
  title: string | null;
  created_at: number;
  updated_at: number;
  visibility?: string;
  message_count?: number;
}

export interface Message {
  id: string;
  session_id: string;
  content: string;
  role: 'user' | 'assistant';
  created_at: number;
}

export interface UserSettings {
  user_id: string;
  default_model: string | null;
  enabled_tools: string | null; // JSON array
  theme: string | null;
  accent_color: string | null;
  updated_at: number;
}

export interface Document {
  id: string;
  user_id: string;
  title: string;
  content: string;
  kind: string;
  created_at: number;
  updated_at?: number;
}

/**
 * Session queries
 */

export async function getSessionsByUserId(
  db: D1Database,
  userId: string,
  limit = 50,
  startingAfter?: string,
  endingBefore?: string
): Promise<{ sessions: Session[]; hasMore: boolean }> {
  let query = `SELECT
                 s.id,
                 s.user_id,
                 s.title,
                 s.created_at,
                 s.updated_at,
                 s.visibility,
                 COUNT(m.id) as message_count
               FROM sessions s
               LEFT JOIN messages m ON s.id = m.session_id
               WHERE s.user_id = ?`;
  const params: (string | number)[] = [userId];

  if (startingAfter) {
    query += ` AND s.updated_at < (SELECT updated_at FROM sessions WHERE id = ?)`;
    params.push(startingAfter);
  } else if (endingBefore) {
    query += ` AND s.updated_at > (SELECT updated_at FROM sessions WHERE id = ?)`;
    params.push(endingBefore);
  }

  query += ` GROUP BY s.id, s.user_id, s.title, s.created_at, s.updated_at, s.visibility`;
  query += ` ORDER BY s.updated_at DESC LIMIT ?`;
  params.push(limit + 1); // Fetch one extra to check hasMore

  const result = await db
    .prepare(query)
    .bind(...params)
    .all();
  const sessions = (result.results || []) as unknown as Session[];

  return {
    sessions: sessions.slice(0, limit),
    hasMore: sessions.length > limit,
  };
}

export async function getSessionById(db: D1Database, sessionId: string): Promise<Session | null> {
  const result = await db
    .prepare(
      `SELECT id, user_id, title, created_at, updated_at, visibility FROM sessions WHERE id = ?`
    )
    .bind(sessionId)
    .first();
  return (result as unknown as Session) || null;
}

export async function getMessagesBySessionId(
  db: D1Database,
  sessionId: string
): Promise<Message[]> {
  const result = await db
    .prepare(
      `SELECT id, session_id, content, role, created_at FROM messages WHERE session_id = ? ORDER BY created_at ASC`
    )
    .bind(sessionId)
    .all();
  return (result.results || []) as unknown as Message[];
}

export async function deleteSessionsByUserId(db: D1Database, userId: string): Promise<number> {
  // Delete messages first (foreign key would handle this, but D1 doesn't support FK constraints yet)
  await db
    .prepare(`DELETE FROM messages WHERE session_id IN (SELECT id FROM sessions WHERE user_id = ?)`)
    .bind(userId)
    .run();

  const result = await db.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(userId).run();
  return result.meta?.changes || 0;
}

export async function deleteSessionById(db: D1Database, sessionId: string): Promise<number> {
  // Delete messages first
  await db.prepare(`DELETE FROM messages WHERE session_id = ?`).bind(sessionId).run();

  const result = await db.prepare(`DELETE FROM sessions WHERE id = ?`).bind(sessionId).run();
  return result.meta?.changes || 0;
}

// Alias for chat API compatibility
export async function deleteChatById(db: D1Database, id: string, userId: string): Promise<boolean> {
  // Verify ownership before deleting
  const session = await getSessionById(db, id);
  if (!session || session.user_id !== userId) {
    return false;
  }

  const changes = await deleteSessionById(db, id);
  return changes > 0;
}

// Alias for chat API compatibility
export async function deleteAllChatsByUserId(db: D1Database, userId: string): Promise<number> {
  return deleteSessionsByUserId(db, userId);
}

/**
 * Settings queries
 */

// Alias for chat API compatibility
export async function getChatsByUserId(
  db: D1Database,
  userId: string,
  limit?: number,
  startingAfter?: string,
  endingBefore?: string
): Promise<Session[]> {
  const result = await getSessionsByUserId(db, userId, limit, startingAfter, endingBefore);
  return result.sessions;
}

export async function updateUserSettings(
  db: D1Database,
  userId: string,
  settings: {
    defaultModel?: string;
    enabledTools?: string[];
    theme?: string;
    accentColor?: string;
  }
): Promise<void> {
  return upsertUserSettings(db, userId, settings);
}

export async function getUserSettings(
  db: D1Database,
  userId: string
): Promise<UserSettings | null> {
  const result = await db
    .prepare(
      `SELECT user_id, default_model, enabled_tools, theme, accent_color, updated_at
       FROM user_settings
       WHERE user_id = ?`
    )
    .bind(userId)
    .first();
  return (result as unknown as UserSettings) || null;
}

export async function upsertUserSettings(
  db: D1Database,
  userId: string,
  settings: {
    defaultModel?: string | null;
    enabledTools?: string[] | null;
    theme?: string | null;
    accentColor?: string | null;
  }
): Promise<void> {
  const existing = await getUserSettings(db, userId);

  if (existing) {
    // Update existing settings
    const updates: string[] = [];
    const params: (string | number | null)[] = [];

    if (settings.defaultModel !== undefined) {
      updates.push('default_model = ?');
      params.push(settings.defaultModel);
    }
    if (settings.enabledTools !== undefined) {
      updates.push('enabled_tools = ?');
      params.push(JSON.stringify(settings.enabledTools));
    }
    if (settings.theme !== undefined) {
      updates.push('theme = ?');
      params.push(settings.theme);
    }
    if (settings.accentColor !== undefined) {
      updates.push('accent_color = ?');
      params.push(settings.accentColor);
    }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      params.push(Date.now());
      params.push(userId);

      const query = `UPDATE user_settings SET ${updates.join(', ')} WHERE user_id = ?`;
      await db
        .prepare(query)
        .bind(...params)
        .run();
    }
  } else {
    // Insert new settings
    await db
      .prepare(
        `INSERT INTO user_settings (user_id, default_model, enabled_tools, theme, accent_color, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(
        userId,
        settings.defaultModel ?? null,
        settings.enabledTools ? JSON.stringify(settings.enabledTools) : null,
        settings.theme ?? null,
        settings.accentColor ?? null,
        Date.now()
      )
      .run();
  }
}

/**
 * Document queries
 */

export async function getDocumentById(
  db: D1Database,
  documentId: string
): Promise<Document | null> {
  const result = await db
    .prepare(
      `SELECT id, user_id, title, content, kind, created_at, updated_at FROM documents WHERE id = ?`
    )
    .bind(documentId)
    .first();
  return (result as unknown as Document) || null;
}

export async function saveDocument(
  db: D1Database,
  document: {
    id?: string;
    userId: string;
    title: string;
    content: string;
    kind: string;
  }
): Promise<Document> {
  const existingId = document.id;
  const now = Date.now();

  if (existingId) {
    // Check if document exists and belongs to user
    const existing = await getDocumentById(db, existingId);
    if (existing && existing.user_id === document.userId) {
      // Update existing document
      await db
        .prepare(
          `UPDATE documents SET title = ?, content = ?, kind = ?, updated_at = ? WHERE id = ?`
        )
        .bind(document.title, document.content, document.kind, now, existingId)
        .run();

      return {
        id: existingId,
        user_id: document.userId,
        title: document.title,
        content: document.content,
        kind: document.kind,
        created_at: existing.created_at,
        updated_at: now,
      };
    }
  }

  // Create new document
  const newId = document.id || crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO documents (id, user_id, title, content, kind, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(newId, document.userId, document.title, document.content, document.kind, now, now)
    .run();

  return {
    id: newId,
    user_id: document.userId,
    title: document.title,
    content: document.content,
    kind: document.kind,
    created_at: now,
    updated_at: now,
  };
}

export async function deleteDocument(
  db: D1Database,
  documentId: string,
  timestamp: number
): Promise<number> {
  const result = await db
    .prepare(`DELETE FROM documents WHERE id = ? AND updated_at <= ?`)
    .bind(documentId, timestamp)
    .run();
  return result.meta?.changes || 0;
}

export async function getDocumentsByUserId(
  db: D1Database,
  userId: string,
  kind?: string
): Promise<Document[]> {
  let query = `SELECT id, user_id, title, content, kind, created_at, updated_at
               FROM documents WHERE user_id = ?`;
  const params: (string | number)[] = [userId];

  if (kind) {
    query += ` AND kind = ?`;
    params.push(kind);
  }

  query += ` ORDER BY updated_at DESC`;

  const result = await db
    .prepare(query)
    .bind(...params)
    .all();
  return (result.results || []) as unknown as Document[];
}

/**
 * Document queries for RAG context
 */

// Get documents by ID (plural for compatibility with multiple IDs pattern)
export async function getDocumentsById(db: D1Database, id: string): Promise<Document[]> {
  const result = await db
    .prepare(
      `SELECT id, user_id, title, content, kind, created_at
       FROM documents
       WHERE id = ?`
    )
    .bind(id)
    .all();

  return (result.results || []) as unknown as Document[];
}

// Delete documents by ID after timestamp (for stale document cleanup)
export async function deleteDocumentsByIdAfterTimestamp(
  db: D1Database,
  id: string,
  timestamp: number
): Promise<number> {
  const result = await db
    .prepare(`DELETE FROM documents WHERE id = ? AND created_at > ?`)
    .bind(id, timestamp)
    .run();

  return result.meta?.changes || 0;
}
