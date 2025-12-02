-- Migration: 0004_rename_with_prefix.sql
-- Database: duyetbot-memory
-- Description: Rename memory tables with memory_ prefix and remove observability tables
--              (observability moved to duyetbot database in shared-agents)

-- Step 1: Rename existing tables with memory_ prefix
ALTER TABLE users RENAME TO memory_users;
ALTER TABLE sessions RENAME TO memory_sessions;
ALTER TABLE session_tokens RENAME TO memory_session_tokens;
ALTER TABLE messages RENAME TO memory_messages;

-- Step 2: Recreate indexes with new names (SQLite doesn't rename indexes automatically)
-- Users indexes
DROP INDEX IF EXISTS idx_users_github;
CREATE INDEX IF NOT EXISTS idx_memory_users_github ON memory_users(github_id);

-- Sessions indexes
DROP INDEX IF EXISTS idx_sessions_user;
CREATE INDEX IF NOT EXISTS idx_memory_sessions_user ON memory_sessions(user_id, updated_at DESC);

DROP INDEX IF EXISTS idx_sessions_state;
CREATE INDEX IF NOT EXISTS idx_memory_sessions_state ON memory_sessions(user_id, state);

-- Session tokens indexes
DROP INDEX IF EXISTS idx_tokens_user;
CREATE INDEX IF NOT EXISTS idx_memory_tokens_user ON memory_session_tokens(user_id);

DROP INDEX IF EXISTS idx_tokens_expires;
CREATE INDEX IF NOT EXISTS idx_memory_tokens_expires ON memory_session_tokens(expires_at);

-- Messages indexes
DROP INDEX IF EXISTS idx_messages_session;
CREATE INDEX IF NOT EXISTS idx_memory_messages_session ON memory_messages(session_id, timestamp ASC);

DROP INDEX IF EXISTS idx_messages_content;
CREATE INDEX IF NOT EXISTS idx_memory_messages_content ON memory_messages(session_id, content);

DROP INDEX IF EXISTS idx_messages_timestamp;
CREATE INDEX IF NOT EXISTS idx_memory_messages_timestamp ON memory_messages(timestamp);

-- Step 3: Drop observability tables (moved to duyetbot database)
-- Drop views first (they depend on the events table)
DROP VIEW IF EXISTS category_stats;
DROP VIEW IF EXISTS hourly_metrics;
DROP VIEW IF EXISTS daily_metrics;

-- Drop observability indexes
DROP INDEX IF EXISTS idx_events_source;
DROP INDEX IF EXISTS idx_events_user;
DROP INDEX IF EXISTS idx_events_status;
DROP INDEX IF EXISTS idx_events_date;
DROP INDEX IF EXISTS idx_events_category;

-- Drop the events table
DROP TABLE IF EXISTS events;
