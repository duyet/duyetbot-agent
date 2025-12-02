-- Migration: 0001_observability.sql
-- Database: duyetbot
-- Description: Observability schema for tracking webhook events, agent executions, and token usage.
-- Used by: telegram-bot, github-bot (via OBSERVABILITY_DB binding)

-- Events: One row per webhook request with embedded agent chain
CREATE TABLE IF NOT EXISTS observability_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT UNIQUE NOT NULL,
  request_id TEXT,

  -- Source
  app_source TEXT NOT NULL,          -- 'telegram-webhook', 'github-webhook'
  event_type TEXT NOT NULL,          -- 'message', 'callback_query', 'issue_comment', 'pr_review'

  -- Trigger context
  user_id TEXT,
  username TEXT,
  chat_id TEXT,
  repo TEXT,

  -- Timing
  triggered_at INTEGER NOT NULL,
  completed_at INTEGER,
  duration_ms INTEGER,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'processing', 'success', 'error'
  error_type TEXT,
  error_message TEXT,

  -- Full content (for debugging and analysis)
  input_text TEXT,                   -- Full user input
  response_text TEXT,                -- Full response text

  -- Classification (from router)
  classification_type TEXT,          -- 'simple', 'complex', 'tool_confirmation'
  classification_category TEXT,      -- 'general', 'code', 'research', 'github', 'duyet'
  classification_complexity TEXT,    -- 'low', 'medium', 'high'

  -- Agent chain (JSON array - full execution path with embedded tokens)
  -- Format: [
  --   {"name":"router","type":"agent","duration_ms":50,"input_tokens":100,"output_tokens":20},
  --   {"name":"orchestrator","type":"agent","duration_ms":200,"input_tokens":300,"output_tokens":80,"workers":[
  --     {"name":"code-worker","type":"worker","duration_ms":150,"input_tokens":500,"output_tokens":100}
  --   ]}
  -- ]
  agents TEXT,

  -- Token totals (aggregated across all agents for quick queries)
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  cached_tokens INTEGER DEFAULT 0,
  reasoning_tokens INTEGER DEFAULT 0,

  -- Model info
  model TEXT,

  -- Extensible metadata (JSON)
  metadata TEXT,

  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

-- Indexes for dashboard queries
CREATE INDEX IF NOT EXISTS idx_obs_events_source ON observability_events(app_source, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_obs_events_user ON observability_events(user_id, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_obs_events_status ON observability_events(status, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_obs_events_date ON observability_events(triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_obs_events_category ON observability_events(classification_category, triggered_at DESC);

-- Aggregation Views
CREATE VIEW IF NOT EXISTS observability_daily_metrics AS
SELECT
  date(triggered_at / 1000, 'unixepoch') as date,
  app_source,
  COUNT(*) as total_events,
  SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
  SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as failed,
  AVG(duration_ms) as avg_duration_ms,
  SUM(total_tokens) as total_tokens,
  SUM(input_tokens) as input_tokens,
  SUM(output_tokens) as output_tokens
FROM observability_events
GROUP BY date, app_source;

CREATE VIEW IF NOT EXISTS observability_hourly_metrics AS
SELECT
  strftime('%Y-%m-%d %H:00', triggered_at / 1000, 'unixepoch') as hour,
  app_source,
  COUNT(*) as total_events,
  SUM(total_tokens) as total_tokens,
  AVG(duration_ms) as avg_duration_ms
FROM observability_events
GROUP BY hour, app_source;

CREATE VIEW IF NOT EXISTS observability_category_stats AS
SELECT
  classification_category,
  COUNT(*) as total,
  AVG(duration_ms) as avg_duration_ms,
  SUM(total_tokens) as total_tokens
FROM observability_events
WHERE triggered_at > (unixepoch() * 1000 - 7 * 24 * 60 * 60 * 1000)
GROUP BY classification_category;
