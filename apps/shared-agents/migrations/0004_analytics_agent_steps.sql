-- Migration: 0004_analytics_agent_steps.sql
-- Database: duyetbot
-- Description: Agent execution steps for fine-grained performance monitoring and cost analysis.
-- Tracks each agent and worker invocation with token consumption and timing data.
-- Used by: performance dashboards, cost attribution, agent debugging
-- Design: Immutable append-only log (never update, only insert)

-- Agent Steps: One row per agent/worker invocation
CREATE TABLE IF NOT EXISTS analytics_agent_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Unique identifier for this step
  step_id TEXT UNIQUE NOT NULL,             -- UUIDv7 format for unique reference

  -- Correlation with observability
  event_id TEXT NOT NULL,                   -- FK to observability_events.event_id (CASCADE delete)
  message_id TEXT,                          -- FK to analytics_messages.message_id (optional, SET NULL)

  -- Execution hierarchy
  parent_step_id TEXT,                      -- Parent step for nested worker executions (SET NULL on delete)
  agent_name TEXT NOT NULL,                 -- 'router', 'orchestrator', 'code-worker', etc
  agent_type TEXT NOT NULL CHECK (agent_type IN ('agent', 'worker')),

  -- Sequence within event
  sequence INTEGER NOT NULL,                -- Execution order within the event

  -- Execution timing (millisecond precision)
  started_at INTEGER,                       -- When this step started (unixepoch() * 1000)
  completed_at INTEGER,                     -- When this step completed
  duration_ms INTEGER DEFAULT 0,            -- Total execution time
  queue_time_ms INTEGER DEFAULT 0,          -- Time spent waiting in queue

  -- Execution status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'error', 'cancelled')),

  -- Error tracking
  error_type TEXT,                          -- Error class/category if failed
  error_message TEXT,                       -- Human-readable error message
  retry_count INTEGER DEFAULT 0,            -- Number of retries attempted

  -- Token accounting (granular per-step for cost allocation)
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cached_tokens INTEGER DEFAULT 0,          -- Tokens reused from cache
  reasoning_tokens INTEGER DEFAULT 0,       -- Extended thinking tokens

  -- Model information
  model TEXT,

  -- Tool invocations
  tools_used TEXT,                          -- JSON array of tool names: ["bash", "git", "github"]
  tool_calls_count INTEGER DEFAULT 0,       -- Total number of tool calls in this step

  -- Extensible metadata (JSON)
  metadata TEXT,                            -- {"retries": [...], "warnings": [...], "custom_fields": {...}}

  -- Timestamp
  created_at INTEGER NOT NULL,              -- When this record was written (unixepoch() * 1000)

  -- Foreign key constraints
  FOREIGN KEY (event_id) REFERENCES observability_events(event_id) ON DELETE CASCADE,
  FOREIGN KEY (message_id) REFERENCES analytics_messages(message_id) ON DELETE SET NULL,
  FOREIGN KEY (parent_step_id) REFERENCES analytics_agent_steps(step_id) ON DELETE SET NULL
);

-- Indexes for common query patterns
-- Query 1: Find all steps in an event for execution flow analysis
CREATE INDEX IF NOT EXISTS idx_analytics_steps_event_seq
  ON analytics_agent_steps(event_id, sequence);

-- Query 2: Agent performance metrics (duration, tokens, error rates)
CREATE INDEX IF NOT EXISTS idx_analytics_steps_agent_time
  ON analytics_agent_steps(agent_name, completed_at DESC);

-- Query 3: Find failed steps for error analysis
CREATE INDEX IF NOT EXISTS idx_analytics_steps_status
  ON analytics_agent_steps(status, completed_at DESC);

-- Query 4: Execution hierarchy traversal
CREATE INDEX IF NOT EXISTS idx_analytics_steps_parent
  ON analytics_agent_steps(parent_step_id);

-- Query 5: Link to messages
CREATE INDEX IF NOT EXISTS idx_analytics_steps_message
  ON analytics_agent_steps(message_id);

-- Query 6: Tool usage patterns
CREATE INDEX IF NOT EXISTS idx_analytics_steps_tools
  ON analytics_agent_steps(tools_used);

-- Query 7: Model usage tracking
CREATE INDEX IF NOT EXISTS idx_analytics_steps_model
  ON analytics_agent_steps(model, created_at DESC);

-- Query 8: Step duration analysis
CREATE INDEX IF NOT EXISTS idx_analytics_steps_duration
  ON analytics_agent_steps(duration_ms DESC);

-- Aggregation View: Agent performance statistics
-- Used for: agent reliability, speed, cost per agent
CREATE VIEW IF NOT EXISTS analytics_agent_performance AS
SELECT
  agent_name,
  agent_type,
  model,
  COUNT(*) as total_invocations,
  SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_invocations,
  SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as failed_invocations,
  ROUND(100.0 * SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate_pct,
  ROUND(AVG(duration_ms), 0) as avg_duration_ms,
  MIN(duration_ms) as min_duration_ms,
  MAX(duration_ms) as max_duration_ms,
  SUM(CASE WHEN duration_ms > 0 THEN 1 ELSE 0 END) > 0
    AND (SELECT CAST(SUBSTR(JSON_EXTRACT(JSON_ARRAY(duration_ms), '$[*]'), 1, CAST(COUNT(*) * 0.5 AS INTEGER)) AS INTEGER) IS NOT NULL)
    AS p50_duration_placeholder,
  SUM(input_tokens) as total_input_tokens,
  SUM(output_tokens) as total_output_tokens,
  SUM(cached_tokens) as total_cached_tokens,
  SUM(reasoning_tokens) as total_reasoning_tokens,
  ROUND(AVG(input_tokens), 0) as avg_input_tokens,
  ROUND(AVG(output_tokens), 0) as avg_output_tokens,
  SUM(tool_calls_count) as total_tool_calls,
  ROUND(AVG(tool_calls_count), 1) as avg_tools_per_step,
  SUM(retry_count) as total_retries
FROM analytics_agent_steps
WHERE status IN ('success', 'error')
GROUP BY agent_name, agent_type, model;

-- Aggregation View: Hourly agent metrics for real-time monitoring
-- Used for: real-time dashboards, rate limiting, capacity planning
CREATE VIEW IF NOT EXISTS analytics_agent_hourly AS
SELECT
  strftime('%Y-%m-%d %H:00', completed_at / 1000, 'unixepoch') as hour,
  agent_name,
  COUNT(*) as invocations,
  SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
  SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count,
  AVG(duration_ms) as avg_duration_ms,
  SUM(input_tokens) as input_tokens,
  SUM(output_tokens) as output_tokens,
  SUM(cached_tokens) as cached_tokens
FROM analytics_agent_steps
WHERE completed_at IS NOT NULL
GROUP BY hour, agent_name;

-- Aggregation View: Error analysis by agent
-- Used for: debugging, reliability improvement, alerting
CREATE VIEW IF NOT EXISTS analytics_agent_errors AS
SELECT
  agent_name,
  error_type,
  COUNT(*) as error_count,
  MIN(completed_at) as first_occurrence,
  MAX(completed_at) as last_occurrence,
  ROUND(100.0 * COUNT(*) / (
    SELECT COUNT(*) FROM analytics_agent_steps s2
    WHERE s2.agent_name = analytics_agent_steps.agent_name
      AND s2.status IN ('success', 'error')
  ), 2) as error_rate_pct
FROM analytics_agent_steps
WHERE status = 'error'
GROUP BY agent_name, error_type
ORDER BY error_count DESC;

-- Aggregation View: Tool usage across agents
-- Used for: tool popularity, bottleneck identification
CREATE VIEW IF NOT EXISTS analytics_tool_usage AS
SELECT
  agent_name,
  COUNT(*) as invocations_using_tool,
  SUM(tool_calls_count) as total_tool_calls,
  AVG(tool_calls_count) as avg_calls_per_invocation,
  SUM(duration_ms) as total_duration_ms,
  AVG(duration_ms) as avg_duration_per_invocation
FROM analytics_agent_steps
WHERE tool_calls_count > 0
  AND status = 'success'
GROUP BY agent_name
ORDER BY total_tool_calls DESC;
