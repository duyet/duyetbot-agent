-- Migration: 0005_analytics_aggregates.sql
-- Database: duyetbot
-- Description: Pre-computed aggregates for cost tracking and conversation management.
-- Includes token cost configuration, hourly/daily aggregates, and conversation metadata.
-- Used by: billing dashboard, cost attribution, cost forecasting, conversation search
-- Design: Aggregates computed offline/periodically; config is authoritative source for pricing

-- Token Cost Configuration: Model pricing by provider and time period
-- Used for: accurate cost calculation, pricing model management, historical cost tracking
CREATE TABLE IF NOT EXISTS analytics_cost_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Model & Provider identification
  model TEXT NOT NULL,                      -- e.g., 'claude-3-5-sonnet-20241022'
  provider TEXT NOT NULL,                   -- e.g., 'anthropic', 'openrouter', 'aws-bedrock'

  -- Pricing per 1000 tokens (industry standard)
  input_cost_per_1k REAL NOT NULL,          -- Cost per 1000 input tokens (USD)
  output_cost_per_1k REAL NOT NULL,         -- Cost per 1000 output tokens (USD)
  cached_cost_per_1k REAL DEFAULT 0,        -- Cost for cached tokens (usually 10% of input)
  reasoning_cost_per_1k REAL DEFAULT 0,     -- Cost for extended thinking (usually higher)

  -- Time-based versioning
  effective_from INTEGER NOT NULL,          -- When this pricing became active (unixepoch() * 1000)
  effective_to INTEGER,                     -- When this pricing expired (NULL = currently active)

  -- Metadata
  notes TEXT,                               -- e.g., "Claude 3.5 Sonnet v2 release"
  created_at INTEGER NOT NULL,              -- When this config was created
  created_by TEXT,                          -- User or system that created this config

  -- Uniqueness constraint: one active price per model per provider at any given time
  UNIQUE(model, provider, effective_from)
);

-- Indexes for cost lookup
-- Query 1: Get current pricing for a model
CREATE INDEX IF NOT EXISTS idx_cost_config_model_active
  ON analytics_cost_config(model, provider, effective_from DESC);

-- Query 2: Historical pricing lookups
CREATE INDEX IF NOT EXISTS idx_cost_config_effective
  ON analytics_cost_config(effective_from, effective_to);

-- Token Aggregates: Pre-computed token usage by various dimensions
-- Computed periodically (hourly/daily batch) for fast dashboard queries
CREATE TABLE IF NOT EXISTS analytics_token_aggregates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Aggregate dimension
  aggregate_type TEXT NOT NULL CHECK (aggregate_type IN (
    'user_hourly',        -- Per-user hourly breakdown
    'user_daily',         -- Per-user daily breakdown
    'platform_daily',     -- Per-platform daily breakdown
    'model_daily',        -- Per-model daily breakdown
    'agent_daily'         -- Per-agent daily breakdown
  )),

  -- Aggregate key (model: "claude-3-sonnet", user: "user-123", platform: "telegram", agent: "router")
  aggregate_key TEXT NOT NULL,

  -- Time period
  period_type TEXT NOT NULL CHECK (period_type IN ('hour', 'day', 'week', 'month')),
  period_start INTEGER NOT NULL,            -- unixepoch() * 1000 (start of period)
  period_end INTEGER NOT NULL,              -- unixepoch() * 1000 (end of period)

  -- Token counts
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  cached_tokens INTEGER DEFAULT 0,
  reasoning_tokens INTEGER DEFAULT 0,

  -- Message counts
  message_count INTEGER DEFAULT 0,
  user_message_count INTEGER DEFAULT 0,
  assistant_message_count INTEGER DEFAULT 0,
  event_count INTEGER DEFAULT 0,            -- From observability_events
  session_count INTEGER DEFAULT 0,          -- Unique sessions in period

  -- Success metrics
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,

  -- Duration metrics (milliseconds)
  total_duration_ms INTEGER DEFAULT 0,
  avg_duration_ms REAL DEFAULT 0,
  min_duration_ms INTEGER DEFAULT 2147483647,
  max_duration_ms INTEGER DEFAULT 0,
  p50_duration_ms INTEGER,
  p95_duration_ms INTEGER,
  p99_duration_ms INTEGER,

  -- Cost estimation
  estimated_cost_usd REAL DEFAULT 0,        -- Calculated using analytics_cost_config

  -- Metadata
  last_computed_at INTEGER,                 -- When this aggregate was computed
  computation_duration_ms INTEGER,          -- How long the computation took
  created_at INTEGER NOT NULL,              -- When this record was created

  -- Uniqueness: One aggregate per dimension per period
  UNIQUE(aggregate_type, aggregate_key, period_type, period_start)
);

-- Indexes for aggregate queries
-- Query 1: User daily activity
CREATE INDEX IF NOT EXISTS idx_token_agg_user_daily
  ON analytics_token_aggregates(aggregate_type, aggregate_key, period_start DESC)
  WHERE aggregate_type IN ('user_daily', 'user_hourly');

-- Query 2: Platform trends
CREATE INDEX IF NOT EXISTS idx_token_agg_platform
  ON analytics_token_aggregates(aggregate_type, period_start DESC)
  WHERE aggregate_type = 'platform_daily';

-- Query 3: Model cost tracking
CREATE INDEX IF NOT EXISTS idx_token_agg_model
  ON analytics_token_aggregates(aggregate_type, aggregate_key, period_start DESC)
  WHERE aggregate_type = 'model_daily';

-- Query 4: Agent performance
CREATE INDEX IF NOT EXISTS idx_token_agg_agent
  ON analytics_token_aggregates(aggregate_type, aggregate_key, period_start DESC)
  WHERE aggregate_type = 'agent_daily';

-- Query 5: Time-based range queries
CREATE INDEX IF NOT EXISTS idx_token_agg_period
  ON analytics_token_aggregates(period_type, period_start DESC);

-- Conversations: High-level conversation metadata and statistics
-- Denormalizes common queries for fast dashboard rendering
CREATE TABLE IF NOT EXISTS analytics_conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Unique identifier
  conversation_id TEXT UNIQUE NOT NULL,     -- UUIDv7 or "platform:userId:chatId"

  -- Context
  user_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('telegram', 'github', 'cli', 'api')),

  -- Metadata
  title TEXT,                               -- Optional: user-provided or generated title
  summary TEXT,                             -- Optional: auto-generated conversation summary

  -- Visibility & Organization
  visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'public', 'unlisted')),
  is_archived INTEGER DEFAULT 0,            -- Soft-delete for storage retention
  is_starred INTEGER DEFAULT 0,             -- User-starred for quick access

  -- Denormalized statistics (updated on each message)
  message_count INTEGER DEFAULT 0,          -- Total messages in conversation
  session_count INTEGER DEFAULT 0,          -- Number of distinct sessions
  total_tokens INTEGER DEFAULT 0,           -- Sum of all tokens used

  -- Timing
  first_message_at INTEGER,                 -- Timestamp of first message
  last_message_at INTEGER,                  -- Timestamp of last message
  created_at INTEGER NOT NULL,              -- When conversation was created
  updated_at INTEGER NOT NULL,              -- Last modification

  -- Extensible metadata (JSON)
  metadata TEXT                             -- {"tags": [...], "custom_fields": {...}}
);

-- Indexes for conversation queries
-- Query 1: User's conversations
CREATE INDEX IF NOT EXISTS idx_conversations_user
  ON analytics_conversations(user_id, updated_at DESC);

-- Query 2: Active conversations
CREATE INDEX IF NOT EXISTS idx_conversations_active
  ON analytics_conversations(is_archived, updated_at DESC);

-- Query 3: Search by platform
CREATE INDEX IF NOT EXISTS idx_conversations_platform
  ON analytics_conversations(platform, updated_at DESC);

-- Query 4: Starred for quick access
CREATE INDEX IF NOT EXISTS idx_conversations_starred
  ON analytics_conversations(is_starred, updated_at DESC);

-- Aggregation View: Daily token cost by user
-- Used for: billing, cost tracking, per-user cost analysis
CREATE VIEW IF NOT EXISTS analytics_user_costs AS
SELECT
  date(period_start / 1000, 'unixepoch') as date,
  aggregate_key as user_id,
  SUM(input_tokens) as input_tokens,
  SUM(output_tokens) as output_tokens,
  SUM(cached_tokens) as cached_tokens,
  SUM(reasoning_tokens) as reasoning_tokens,
  SUM(estimated_cost_usd) as total_cost_usd
FROM analytics_token_aggregates
WHERE aggregate_type = 'user_daily'
  AND period_type = 'day'
GROUP BY date, aggregate_key
ORDER BY date DESC, total_cost_usd DESC;

-- Aggregation View: Model cost breakdown
-- Used for: model-level cost analysis, ROI per model
CREATE VIEW IF NOT EXISTS analytics_model_costs AS
SELECT
  date(period_start / 1000, 'unixepoch') as date,
  aggregate_key as model,
  SUM(input_tokens) as input_tokens,
  SUM(output_tokens) as output_tokens,
  SUM(message_count) as message_count,
  SUM(estimated_cost_usd) as total_cost_usd,
  ROUND(SUM(estimated_cost_usd) / NULLIF(SUM(message_count), 0), 4) as cost_per_message
FROM analytics_token_aggregates
WHERE aggregate_type = 'model_daily'
  AND period_type = 'day'
GROUP BY date, aggregate_key
ORDER BY date DESC, total_cost_usd DESC;

-- Aggregation View: Platform usage and cost
-- Used for: platform comparison, channel ROI
CREATE VIEW IF NOT EXISTS analytics_platform_costs AS
SELECT
  date(period_start / 1000, 'unixepoch') as date,
  aggregate_key as platform,
  SUM(input_tokens) as input_tokens,
  SUM(output_tokens) as output_tokens,
  SUM(message_count) as message_count,
  SUM(session_count) as session_count,
  SUM(estimated_cost_usd) as total_cost_usd,
  ROUND(SUM(estimated_cost_usd) / NULLIF(SUM(session_count), 0), 2) as cost_per_session
FROM analytics_token_aggregates
WHERE aggregate_type = 'platform_daily'
  AND period_type = 'day'
GROUP BY date, aggregate_key
ORDER BY date DESC, total_cost_usd DESC;

-- Aggregation View: Agent cost attribution
-- Used for: agent efficiency, optimization prioritization
CREATE VIEW IF NOT EXISTS analytics_agent_costs AS
SELECT
  date(period_start / 1000, 'unixepoch') as date,
  aggregate_key as agent_name,
  SUM(input_tokens) as input_tokens,
  SUM(output_tokens) as output_tokens,
  SUM(total_duration_ms) as total_duration_ms,
  ROUND(AVG(avg_duration_ms), 0) as avg_duration_ms,
  SUM(estimated_cost_usd) as total_cost_usd,
  SUM(event_count) as event_count,
  ROUND(SUM(estimated_cost_usd) / NULLIF(SUM(event_count), 0), 4) as cost_per_event
FROM analytics_token_aggregates
WHERE aggregate_type = 'agent_daily'
  AND period_type = 'day'
GROUP BY date, aggregate_key
ORDER BY date DESC, total_cost_usd DESC;

-- Aggregation View: Top conversations by token usage
-- Used for: identifying expensive conversations, usage patterns
CREATE VIEW IF NOT EXISTS analytics_top_conversations AS
SELECT
  conversation_id,
  user_id,
  platform,
  message_count,
  session_count,
  total_tokens,
  first_message_at,
  last_message_at,
  ROUND((last_message_at - first_message_at) / 1000 / 60, 0) as duration_minutes,
  ROUND(total_tokens / NULLIF(message_count, 0), 0) as avg_tokens_per_message
FROM analytics_conversations
WHERE is_archived = 0
ORDER BY total_tokens DESC;
