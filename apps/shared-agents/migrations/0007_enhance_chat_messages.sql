-- Migration: 0007_enhance_chat_messages.sql
-- Database: duyetbot
-- Description: Enhance chat_messages table to become single source of truth for messages.
-- This migration adds columns from analytics_messages to chat_messages, enabling
-- views to replace the analytics_messages table (eliminating data duplication).
-- Design principle: NEVER hard-delete messages (use is_archived flag)

-- ============================================================================
-- PHASE 1: Add new columns to chat_messages
-- Note: SQLite cannot add UNIQUE columns when rows exist, so we add it plain first
-- then create a UNIQUE index after populating data in Phase 2
-- ============================================================================

-- Global message ID (UUIDv7) - unique across all sessions and platforms
-- UNIQUE constraint added via index after data population
ALTER TABLE chat_messages ADD COLUMN message_id TEXT;

-- Platform and user context (previously only in analytics_messages)
ALTER TABLE chat_messages ADD COLUMN platform TEXT DEFAULT 'telegram';
ALTER TABLE chat_messages ADD COLUMN user_id TEXT;
ALTER TABLE chat_messages ADD COLUMN username TEXT;
ALTER TABLE chat_messages ADD COLUMN chat_id TEXT;

-- Visibility and archival (NEVER hard-delete)
ALTER TABLE chat_messages ADD COLUMN visibility TEXT DEFAULT 'private';
ALTER TABLE chat_messages ADD COLUMN is_archived INTEGER DEFAULT 0;
ALTER TABLE chat_messages ADD COLUMN is_pinned INTEGER DEFAULT 0;

-- Extended token tracking
ALTER TABLE chat_messages ADD COLUMN cached_tokens INTEGER DEFAULT 0;
ALTER TABLE chat_messages ADD COLUMN reasoning_tokens INTEGER DEFAULT 0;

-- Model information
ALTER TABLE chat_messages ADD COLUMN model TEXT;

-- Extensible metadata (JSON)
ALTER TABLE chat_messages ADD COLUMN metadata TEXT;

-- Updated timestamp for tracking modifications
ALTER TABLE chat_messages ADD COLUMN updated_at INTEGER;

-- ============================================================================
-- PHASE 2: Backfill data from session_id pattern
-- session_id format: "platform:userId:chatId" (e.g., "telegram:123456:789012")
-- ============================================================================

-- Generate UUIDv4-style message_id for existing rows (SQLite compatible)
UPDATE chat_messages
SET message_id = lower(hex(randomblob(4))) || '-' ||
                 lower(hex(randomblob(2))) || '-' ||
                 '4' || substr(lower(hex(randomblob(2))), 2) || '-' ||
                 substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' ||
                 lower(hex(randomblob(6)))
WHERE message_id IS NULL;

-- Extract platform from session_id (first segment before ':')
UPDATE chat_messages
SET platform = CASE
  WHEN instr(session_id, ':') > 0 THEN substr(session_id, 1, instr(session_id, ':') - 1)
  ELSE 'telegram'
END
WHERE platform IS NULL OR platform = 'telegram';

-- Extract user_id from session_id (second segment)
UPDATE chat_messages
SET user_id = CASE
  WHEN instr(session_id, ':') > 0 THEN
    CASE
      WHEN instr(substr(session_id, instr(session_id, ':') + 1), ':') > 0 THEN
        substr(substr(session_id, instr(session_id, ':') + 1), 1,
               instr(substr(session_id, instr(session_id, ':') + 1), ':') - 1)
      ELSE substr(session_id, instr(session_id, ':') + 1)
    END
  ELSE session_id
END
WHERE user_id IS NULL;

-- Set updated_at to created_at for existing rows
UPDATE chat_messages
SET updated_at = created_at
WHERE updated_at IS NULL;

-- ============================================================================
-- PHASE 3: Create additional indexes for new query patterns
-- ============================================================================

-- Index for user queries (user activity, message history)
CREATE INDEX IF NOT EXISTS idx_chat_msg_user_time
  ON chat_messages(user_id, timestamp DESC);

-- Index for platform filtering
CREATE INDEX IF NOT EXISTS idx_chat_msg_platform_time
  ON chat_messages(platform, timestamp DESC);

-- Index for visibility filtering (public messages for sharing)
CREATE INDEX IF NOT EXISTS idx_chat_msg_visibility
  ON chat_messages(visibility);

-- Index for archived messages (retention, cleanup)
CREATE INDEX IF NOT EXISTS idx_chat_msg_archived
  ON chat_messages(is_archived);

-- UNIQUE index for message_id (enforces uniqueness after data population)
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_msg_message_id
  ON chat_messages(message_id);

-- ============================================================================
-- PHASE 4: Drop old views that will be replaced
-- ============================================================================

-- Drop existing views from 0002 that will be superseded by 0008
DROP VIEW IF EXISTS chat_session_stats;
DROP VIEW IF EXISTS chat_daily_metrics;
