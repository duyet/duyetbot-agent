-- Migration: 0003_analytics_messages.sql
-- Database: duyetbot
-- Description: Persistent message storage with global message IDs for cross-session retrieval.
-- Extends chat_messages with rich metadata, visibility controls, and soft-delete semantics.
-- Used by: analytics dashboard, message search, conversation replay
-- Design principle: NEVER hard-delete messages (soft-delete via is_archived flag)

-- Analytics Messages: One row per message with global UUID for persistent reference
CREATE TABLE IF NOT EXISTS analytics_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Global message ID (UUIDv7) - unique across all sessions and platforms
  message_id TEXT UNIQUE NOT NULL,

  -- Session & Conversation context
  session_id TEXT NOT NULL,                 -- Conversation session (format: "platform:userId:chatId")
  conversation_id TEXT,                     -- Optional: logical grouping across sessions
  parent_message_id TEXT,                   -- Optional: for threading and context reconstruction

  -- Message sequencing
  sequence INTEGER NOT NULL,                -- Message order within session (0-indexed)

  -- Message content
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,
  content_hash TEXT,                        -- SHA256 for deduplication detection

  -- Visibility & Archival (NEVER hard-delete)
  visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'public', 'unlisted')),
  is_archived INTEGER DEFAULT 0,            -- Soft-delete flag: 1=archived, 0=active
  is_pinned INTEGER DEFAULT 0,              -- User-pinned message for quick access

  -- Correlation with observability
  event_id TEXT,                            -- FK to observability_events.event_id
  trigger_message_id TEXT,                  -- Which user message triggered this response

  -- Platform-specific identifiers
  platform_message_id TEXT,                 -- Telegram message_id or GitHub comment ID
  platform TEXT NOT NULL CHECK (platform IN ('telegram', 'github', 'cli', 'api')),

  -- User context
  user_id TEXT NOT NULL,
  username TEXT,
  chat_id TEXT,                             -- Telegram chat_id or GitHub repo+issue context
  repo TEXT,                                -- GitHub repo (e.g., "owner/repo")

  -- Token accounting (per-message granularity for cost tracking)
  input_tokens INTEGER DEFAULT 0,           -- Tokens used for this message as input
  output_tokens INTEGER DEFAULT 0,          -- Tokens generated
  cached_tokens INTEGER DEFAULT 0,          -- Cached tokens (if using prompt caching)
  reasoning_tokens INTEGER DEFAULT 0,       -- Extended thinking tokens

  -- Model information
  model TEXT,

  -- Timestamps (millisecond precision for correlation with observability)
  created_at INTEGER NOT NULL,              -- unixepoch() * 1000
  updated_at INTEGER NOT NULL,              -- Last modification (archive, edit, etc)

  -- Extensible metadata (JSON)
  metadata TEXT,                            -- {"editing_count": 2, "reactions": {...}, ...}

  -- Foreign key constraint
  FOREIGN KEY (event_id) REFERENCES observability_events(event_id) ON DELETE SET NULL
);

-- Indexes for common query patterns
-- Query 1: Retrieve all messages in a session in order
CREATE INDEX IF NOT EXISTS idx_analytics_msg_session_seq
  ON analytics_messages(session_id, sequence);

-- Query 2: Find all messages by user for daily/monthly analytics
CREATE INDEX IF NOT EXISTS idx_analytics_msg_user_time
  ON analytics_messages(user_id, created_at DESC);

-- Query 3: Hourly/daily metrics by platform
CREATE INDEX IF NOT EXISTS idx_analytics_msg_platform_time
  ON analytics_messages(platform, created_at DESC);

-- Query 4: Find archived messages for retention policies
CREATE INDEX IF NOT EXISTS idx_analytics_msg_visibility
  ON analytics_messages(visibility, is_archived);

-- Query 5: Link to observability events
CREATE INDEX IF NOT EXISTS idx_analytics_msg_event
  ON analytics_messages(event_id);

-- Query 6: Conversation reconstruction
CREATE INDEX IF NOT EXISTS idx_analytics_msg_conversation
  ON analytics_messages(conversation_id, sequence);

-- Query 7: Deduplication check
CREATE INDEX IF NOT EXISTS idx_analytics_msg_content_hash
  ON analytics_messages(content_hash);

-- Query 8: Message threading
CREATE INDEX IF NOT EXISTS idx_analytics_msg_parent
  ON analytics_messages(parent_message_id);

-- Query 9: Find user messages (for response triggers)
CREATE INDEX IF NOT EXISTS idx_analytics_msg_role_time
  ON analytics_messages(role, created_at DESC);

-- Query 10: Platform-specific lookups
CREATE INDEX IF NOT EXISTS idx_analytics_msg_platform_ref
  ON analytics_messages(platform, platform_message_id);

-- Aggregation View: Message stats by session
-- Used for: conversation size, duration, token usage per session
CREATE VIEW IF NOT EXISTS analytics_session_messages AS
SELECT
  session_id,
  conversation_id,
  platform,
  user_id,
  COUNT(*) as message_count,
  SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) as user_message_count,
  SUM(CASE WHEN role = 'assistant' THEN 1 ELSE 0 END) as assistant_message_count,
  SUM(CASE WHEN is_archived = 0 THEN 1 ELSE 0 END) as active_message_count,
  SUM(input_tokens) as total_input_tokens,
  SUM(output_tokens) as total_output_tokens,
  SUM(cached_tokens) as total_cached_tokens,
  SUM(reasoning_tokens) as total_reasoning_tokens,
  MIN(created_at) as first_message_at,
  MAX(created_at) as last_message_at,
  MAX(created_at) - MIN(created_at) as session_duration_ms
FROM analytics_messages
WHERE is_archived = 0
GROUP BY session_id;

-- Aggregation View: Daily user activity
-- Used for: DAU, MAU, engagement metrics
CREATE VIEW IF NOT EXISTS analytics_user_daily AS
SELECT
  date(created_at / 1000, 'unixepoch') as date,
  user_id,
  platform,
  COUNT(*) as message_count,
  COUNT(DISTINCT session_id) as session_count,
  SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) as user_messages,
  SUM(CASE WHEN role = 'assistant' THEN 1 ELSE 0 END) as assistant_messages,
  SUM(input_tokens + output_tokens) as total_tokens,
  COUNT(DISTINCT model) as model_count
FROM analytics_messages
WHERE is_archived = 0
GROUP BY date, user_id, platform;

-- Aggregation View: Hourly metrics for real-time dashboards
-- Used for: real-time monitoring, traffic patterns
CREATE VIEW IF NOT EXISTS analytics_hourly_messages AS
SELECT
  strftime('%Y-%m-%d %H:00', created_at / 1000, 'unixepoch') as hour,
  platform,
  COUNT(*) as message_count,
  COUNT(DISTINCT session_id) as session_count,
  COUNT(DISTINCT user_id) as user_count,
  SUM(input_tokens) as input_tokens,
  SUM(output_tokens) as output_tokens,
  SUM(cached_tokens) as cached_tokens,
  SUM(reasoning_tokens) as reasoning_tokens
FROM analytics_messages
WHERE is_archived = 0
GROUP BY hour, platform;

-- Aggregation View: Message visibility distribution
-- Used for: understanding public vs private usage patterns
CREATE VIEW IF NOT EXISTS analytics_visibility_stats AS
SELECT
  date(created_at / 1000, 'unixepoch') as date,
  platform,
  visibility,
  COUNT(*) as message_count,
  COUNT(DISTINCT user_id) as user_count,
  COUNT(DISTINCT session_id) as session_count
FROM analytics_messages
WHERE is_archived = 0
GROUP BY date, platform, visibility;
