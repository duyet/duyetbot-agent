-- Migration: 0005_memory_types
-- Description: Add short-term and long-term memory tables with semantic search
-- Dependencies: 0004_rename_with_prefix.sql (tables must have memory_ prefix)

-- Short-term memory (Session-scoped, KV-like storage with TTL)
-- Used for temporary context during task execution
CREATE TABLE IF NOT EXISTS memory_short_term (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(session_id, key),
  FOREIGN KEY (user_id) REFERENCES memory_users(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES memory_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_memory_short_term_session ON memory_short_term(session_id);
CREATE INDEX IF NOT EXISTS idx_memory_short_term_expires ON memory_short_term(expires_at);
CREATE INDEX IF NOT EXISTS idx_memory_short_term_user_session ON memory_short_term(user_id, session_id);

-- Long-term memory (Persistent facts, preferences, patterns)
-- Used for cross-session information retention
CREATE TABLE IF NOT EXISTS memory_long_term (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  category TEXT NOT NULL,  -- 'fact', 'preference', 'pattern', 'decision', 'note'
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  importance INTEGER DEFAULT 5,  -- 1-10 scale
  source_session_id TEXT,
  metadata TEXT,  -- JSON string
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  accessed_at INTEGER NOT NULL,
  access_count INTEGER DEFAULT 1,
  UNIQUE(user_id, category, key),
  FOREIGN KEY (user_id) REFERENCES memory_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_memory_long_term_user ON memory_long_term(user_id);
CREATE INDEX IF NOT EXISTS idx_memory_long_term_category ON memory_long_term(user_id, category);
CREATE INDEX IF NOT EXISTS idx_memory_long_term_importance ON memory_long_term(user_id, importance DESC);
CREATE INDEX IF NOT EXISTS idx_memory_long_term_accessed ON memory_long_term(user_id, accessed_at DESC);

-- Semantic search index (FTS5)
-- Full-text search across memory content for natural language queries
-- Note: If FTS5 is not available, fallback to LIKE queries with trigram filtering
CREATE VIRTUAL TABLE IF NOT EXISTS memory_search USING fts5(
  memory_id UNINDEXED,
  user_id UNINDEXED,
  content,
  category UNINDEXED,
  tokenize='porter unicode61'
);
