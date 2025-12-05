-- Migration: 0002_chat_messages.sql
-- Database: duyetbot
-- Description: Chat message history for conversation persistence and analytics.
-- Stores individual messages from conversations for replay after DO eviction.

-- Chat messages: One row per message in a conversation
CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Correlation
  event_id TEXT,                            -- Optional FK to observability_events (for webhook-triggered messages)
  session_id TEXT NOT NULL,                 -- Conversation session (format: "platform:userId:chatId")

  -- Message content
  sequence INTEGER NOT NULL,                -- Message order in conversation (0-indexed)
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,

  -- Token tracking (per-message granularity)
  input_tokens INTEGER DEFAULT 0,           -- Tokens used for this message as input
  output_tokens INTEGER DEFAULT 0,          -- Tokens generated (for assistant messages)

  -- Timing
  timestamp INTEGER NOT NULL,               -- When message was created
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),

  -- Optional: Link to observability event for cascade delete
  FOREIGN KEY (event_id) REFERENCES observability_events(event_id) ON DELETE SET NULL
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, sequence);
CREATE INDEX IF NOT EXISTS idx_chat_messages_event ON chat_messages(event_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON chat_messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_recent ON chat_messages(session_id, timestamp DESC);

-- Aggregation view: Message counts by session
CREATE VIEW IF NOT EXISTS chat_session_stats AS
SELECT
  session_id,
  COUNT(*) as message_count,
  SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) as user_messages,
  SUM(CASE WHEN role = 'assistant' THEN 1 ELSE 0 END) as assistant_messages,
  SUM(input_tokens) as total_input_tokens,
  SUM(output_tokens) as total_output_tokens,
  MIN(timestamp) as first_message_at,
  MAX(timestamp) as last_message_at
FROM chat_messages
GROUP BY session_id;

-- Aggregation view: Daily message metrics
CREATE VIEW IF NOT EXISTS chat_daily_metrics AS
SELECT
  date(timestamp / 1000, 'unixepoch') as date,
  COUNT(*) as total_messages,
  COUNT(DISTINCT session_id) as active_sessions,
  SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) as user_messages,
  SUM(CASE WHEN role = 'assistant' THEN 1 ELSE 0 END) as assistant_messages,
  SUM(input_tokens + output_tokens) as total_tokens
FROM chat_messages
GROUP BY date;
