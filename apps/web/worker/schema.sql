-- D1 Database Schema for duyetbot-agent Web App
-- This schema stores query forwarding tracking and OAuth tokens

-- =============================================================================
-- Table: duyet_forwarded_queries
-- Purpose: Track queries forwarded to Telegram bot for analytics and debugging
-- =============================================================================
CREATE TABLE IF NOT EXISTS duyet_forwarded_queries (
    -- Primary key
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Query details
    query TEXT NOT NULL,              -- Original user query
    session_id TEXT,                  -- Web session identifier
    telegram_message_id INTEGER,      -- Reference to Telegram message (if forwarded)

    -- Classification tracking (for analytics)
    detected_mode TEXT,               -- Mode classified by router ('duyet_mcp', 'web_search', 'agent')
    confidence REAL,                  -- Classification confidence score (0.0 - 1.0)

    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_forwarded_session ON duyet_forwarded_queries(session_id);
CREATE INDEX IF NOT EXISTS idx_forwarded_created_at ON duyet_forwarded_queries(created_at);
CREATE INDEX IF NOT EXISTS idx_forwarded_mode ON duyet_forwarded_queries(detected_mode);

-- =============================================================================
-- Table: mcp_tokens
-- Purpose: OAuth token storage for MCP integrations (GitHub, Google, etc.)
-- =============================================================================
CREATE TABLE IF NOT EXISTS mcp_tokens (
    -- Primary key
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- OAuth details
    provider TEXT NOT NULL,           -- 'github', 'google', etc.
    user_id TEXT NOT NULL,            -- Session ID or authenticated user ID

    -- Token storage
    access_token TEXT NOT NULL,       -- Current access token
    refresh_token TEXT,               -- Refresh token (if provider supports it)
    expires_at DATETIME,              -- Token expiration timestamp
    scope TEXT,                       -- Granted OAuth scopes

    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Unique constraint: one active token per provider per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_mcp_token_unique
    ON mcp_tokens(provider, user_id);

-- Index for token cleanup queries
CREATE INDEX IF NOT EXISTS idx_mcp_expires_at ON mcp_tokens(expires_at);

-- =============================================================================
-- Table: oauth_states
-- Purpose: Temporary storage for OAuth state parameters (CSRF protection)
-- =============================================================================
CREATE TABLE IF NOT EXISTS oauth_states (
    -- Primary key
    state TEXT PRIMARY KEY,           -- Random state parameter

    -- OAuth details
    provider TEXT NOT NULL,           -- 'github', 'google', etc.
    user_id TEXT,                     -- Session ID (optional for initial auth)

    -- Expiration
    expires_at INTEGER NOT NULL,      -- Unix timestamp when state expires

    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_oauth_expires_at ON oauth_states(expires_at);

-- =============================================================================
-- Triggers for automatic timestamp updates
-- =============================================================================

-- Update updated_at timestamp on token changes
CREATE TRIGGER IF NOT EXISTS update_mcp_token_timestamp
    AFTER UPDATE ON mcp_tokens
    FOR EACH ROW
    BEGIN
        UPDATE mcp_tokens SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;
