-- Migration: 008_oauth_states_mcp_tokens
-- Description: Create tables for OAuth state management and MCP token storage

-- OAuth state table for CSRF protection during OAuth flows
CREATE TABLE IF NOT EXISTS oauth_states (
  state TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  user_id TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_provider ON oauth_states(provider);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires_at ON oauth_states(expires_at);
CREATE INDEX IF NOT EXISTS idx_oauth_states_user_id ON oauth_states(user_id);

-- MCP tokens table for OAuth token storage (already in worker/schema.sql but included for migration)
CREATE TABLE IF NOT EXISTS mcp_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  user_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at INTEGER,
  scope TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mcp_token_unique ON mcp_tokens(provider, user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_expires_at ON mcp_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_mcp_user_id ON mcp_tokens(user_id);
