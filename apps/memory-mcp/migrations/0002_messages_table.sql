-- Migration: 0002_messages_table
-- Description: Add messages table to store LLM messages in D1 instead of KV

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  metadata TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Index for fetching messages by session (most common operation)
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, timestamp ASC);

-- Index for search operations
CREATE INDEX IF NOT EXISTS idx_messages_content ON messages(session_id, content);

-- Index for date range filtering
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
