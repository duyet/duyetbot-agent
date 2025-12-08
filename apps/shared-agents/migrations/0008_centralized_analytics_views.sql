-- Migration: 0008_centralized_analytics_views.sql
-- Database: duyetbot
-- Description: Create views to replace analytics tables with computed data from source tables.
-- Source tables: observability_events (0001), chat_messages (0002 + 0007 enhancements)
-- Replaced tables: analytics_messages (0003), analytics_agent_steps (0004),
--                  analytics_conversations (0005), analytics_token_aggregates (0005)
-- Design principle: Single source of truth - all analytics computed from source data

-- ============================================================================
-- PHASE 1: Drop views that depended on old tables (will be recreated)
-- ============================================================================

-- Drop views from 0003 that will be superseded
DROP VIEW IF EXISTS analytics_session_messages;
DROP VIEW IF EXISTS analytics_user_daily;
DROP VIEW IF EXISTS analytics_hourly_messages;
DROP VIEW IF EXISTS analytics_visibility_stats;

-- Drop views from 0004 that will be superseded
DROP VIEW IF EXISTS analytics_agent_performance;
DROP VIEW IF EXISTS analytics_agent_hourly;
DROP VIEW IF EXISTS analytics_agent_errors;
DROP VIEW IF EXISTS analytics_tool_usage;

-- Drop views from 0005 that depended on analytics_token_aggregates
DROP VIEW IF EXISTS analytics_user_costs;
DROP VIEW IF EXISTS analytics_model_costs;
DROP VIEW IF EXISTS analytics_platform_costs;
DROP VIEW IF EXISTS analytics_agent_costs;
DROP VIEW IF EXISTS analytics_top_conversations;

-- ============================================================================
-- PHASE 2: Create analytics_messages_view (replaces analytics_messages table)
-- Source: chat_messages + observability_events
-- ============================================================================

CREATE VIEW IF NOT EXISTS analytics_messages_view AS
SELECT
  cm.id,
  cm.message_id,
  cm.session_id,
  -- Derive conversation_id from session_id
  cm.session_id as conversation_id,
  NULL as parent_message_id,
  cm.sequence,
  cm.role,
  cm.content,
  NULL as content_hash,
  COALESCE(cm.visibility, 'private') as visibility,
  COALESCE(cm.is_archived, 0) as is_archived,
  COALESCE(cm.is_pinned, 0) as is_pinned,
  cm.event_id,
  NULL as trigger_message_id,
  NULL as platform_message_id,
  COALESCE(cm.platform, 'telegram') as platform,
  cm.user_id,
  cm.username,
  cm.chat_id,
  oe.repo,
  COALESCE(cm.input_tokens, 0) as input_tokens,
  COALESCE(cm.output_tokens, 0) as output_tokens,
  COALESCE(cm.cached_tokens, 0) as cached_tokens,
  COALESCE(cm.reasoning_tokens, 0) as reasoning_tokens,
  COALESCE(cm.input_tokens, 0) + COALESCE(cm.output_tokens, 0) as total_tokens,
  cm.model,
  cm.timestamp as created_at,
  COALESCE(cm.updated_at, cm.timestamp) as updated_at,
  cm.metadata
FROM chat_messages cm
LEFT JOIN observability_events oe ON cm.event_id = oe.event_id;

-- ============================================================================
-- PHASE 3: Create analytics_agent_steps_view (replaces analytics_agent_steps table)
-- Source: observability_events.agents JSON array
-- ============================================================================

-- View that extracts agent steps from observability_events.agents JSON
-- Each agent in the JSON array becomes a row
CREATE VIEW IF NOT EXISTS analytics_agent_steps_view AS
SELECT
  oe.event_id || '-' || json_each.key as step_id,
  oe.event_id,
  NULL as message_id,
  NULL as parent_step_id,
  json_extract(json_each.value, '$.name') as agent_name,
  COALESCE(json_extract(json_each.value, '$.type'), 'agent') as agent_type,
  CAST(json_each.key AS INTEGER) as sequence,
  oe.triggered_at as started_at,
  oe.completed_at,
  COALESCE(json_extract(json_each.value, '$.duration_ms'), 0) as duration_ms,
  0 as queue_time_ms,
  CASE
    WHEN oe.status = 'success' THEN 'success'
    WHEN oe.status = 'error' THEN 'error'
    ELSE 'pending'
  END as status,
  COALESCE(json_extract(json_each.value, '$.input_tokens'), 0) as input_tokens,
  COALESCE(json_extract(json_each.value, '$.output_tokens'), 0) as output_tokens,
  COALESCE(json_extract(json_each.value, '$.cached_tokens'), 0) as cached_tokens,
  COALESCE(json_extract(json_each.value, '$.reasoning_tokens'), 0) as reasoning_tokens,
  COALESCE(json_extract(json_each.value, '$.model'), oe.model) as model,
  json_extract(json_each.value, '$.tools') as tools_used,
  COALESCE(json_extract(json_each.value, '$.tool_calls'), 0) as tool_calls_count,
  oe.error_type,
  oe.error_message,
  0 as retry_count,
  NULL as metadata,
  oe.created_at
FROM observability_events oe,
     json_each(oe.agents)
WHERE oe.agents IS NOT NULL
  AND json_valid(oe.agents);

-- ============================================================================
-- PHASE 4: Create analytics_conversations_view (replaces analytics_conversations table)
-- Source: chat_messages aggregated by session_id
-- ============================================================================

CREATE VIEW IF NOT EXISTS analytics_conversations_view AS
SELECT
  cm.session_id as conversation_id,
  MAX(cm.user_id) as user_id,
  MAX(cm.platform) as platform,
  NULL as title,
  NULL as summary,
  MAX(cm.visibility) as visibility,
  MAX(cm.is_archived) as is_archived,
  0 as is_starred,
  COUNT(*) as message_count,
  1 as session_count,
  SUM(COALESCE(cm.input_tokens, 0) + COALESCE(cm.output_tokens, 0)) as total_tokens,
  MIN(cm.timestamp) as first_message_at,
  MAX(cm.timestamp) as last_message_at,
  MIN(cm.created_at) as created_at,
  MAX(COALESCE(cm.updated_at, cm.timestamp)) as updated_at,
  NULL as metadata
FROM chat_messages cm
WHERE COALESCE(cm.is_archived, 0) = 0
GROUP BY cm.session_id;

-- ============================================================================
-- PHASE 5: Create token aggregate views (replaces analytics_token_aggregates table)
-- Source: chat_messages and observability_events
-- ============================================================================

-- User daily aggregates
CREATE VIEW IF NOT EXISTS analytics_user_daily_view AS
SELECT
  'user_daily' as aggregate_type,
  cm.user_id as aggregate_key,
  'day' as period_type,
  CAST(strftime('%s', date(cm.timestamp/1000, 'unixepoch')) AS INTEGER) * 1000 as period_start,
  CAST(strftime('%s', date(cm.timestamp/1000, 'unixepoch'), '+1 day') AS INTEGER) * 1000 as period_end,
  SUM(COALESCE(cm.input_tokens, 0)) as input_tokens,
  SUM(COALESCE(cm.output_tokens, 0)) as output_tokens,
  SUM(COALESCE(cm.input_tokens, 0) + COALESCE(cm.output_tokens, 0)) as total_tokens,
  SUM(COALESCE(cm.cached_tokens, 0)) as cached_tokens,
  SUM(COALESCE(cm.reasoning_tokens, 0)) as reasoning_tokens,
  COUNT(*) as message_count,
  SUM(CASE WHEN cm.role = 'user' THEN 1 ELSE 0 END) as user_message_count,
  SUM(CASE WHEN cm.role = 'assistant' THEN 1 ELSE 0 END) as assistant_message_count,
  COUNT(DISTINCT cm.event_id) as event_count,
  COUNT(DISTINCT cm.session_id) as session_count,
  0 as estimated_cost_usd,
  MAX(cm.created_at) as last_computed_at,
  MAX(cm.created_at) as created_at
FROM chat_messages cm
WHERE COALESCE(cm.is_archived, 0) = 0
  AND cm.user_id IS NOT NULL
GROUP BY cm.user_id, date(cm.timestamp/1000, 'unixepoch');

-- Platform daily aggregates
CREATE VIEW IF NOT EXISTS analytics_platform_daily_view AS
SELECT
  'platform_daily' as aggregate_type,
  COALESCE(cm.platform, 'telegram') as aggregate_key,
  'day' as period_type,
  CAST(strftime('%s', date(cm.timestamp/1000, 'unixepoch')) AS INTEGER) * 1000 as period_start,
  CAST(strftime('%s', date(cm.timestamp/1000, 'unixepoch'), '+1 day') AS INTEGER) * 1000 as period_end,
  SUM(COALESCE(cm.input_tokens, 0)) as input_tokens,
  SUM(COALESCE(cm.output_tokens, 0)) as output_tokens,
  SUM(COALESCE(cm.input_tokens, 0) + COALESCE(cm.output_tokens, 0)) as total_tokens,
  COUNT(*) as message_count,
  COUNT(DISTINCT cm.user_id) as user_count,
  COUNT(DISTINCT cm.session_id) as session_count
FROM chat_messages cm
WHERE COALESCE(cm.is_archived, 0) = 0
GROUP BY COALESCE(cm.platform, 'telegram'), date(cm.timestamp/1000, 'unixepoch');

-- Model daily aggregates (from observability_events)
CREATE VIEW IF NOT EXISTS analytics_model_daily_view AS
SELECT
  'model_daily' as aggregate_type,
  oe.model as aggregate_key,
  'day' as period_type,
  CAST(strftime('%s', date(oe.triggered_at/1000, 'unixepoch')) AS INTEGER) * 1000 as period_start,
  CAST(strftime('%s', date(oe.triggered_at/1000, 'unixepoch'), '+1 day') AS INTEGER) * 1000 as period_end,
  SUM(COALESCE(oe.input_tokens, 0)) as input_tokens,
  SUM(COALESCE(oe.output_tokens, 0)) as output_tokens,
  SUM(COALESCE(oe.total_tokens, 0)) as total_tokens,
  SUM(COALESCE(oe.cached_tokens, 0)) as cached_tokens,
  SUM(COALESCE(oe.reasoning_tokens, 0)) as reasoning_tokens,
  COUNT(*) as event_count,
  SUM(CASE WHEN oe.status = 'success' THEN 1 ELSE 0 END) as success_count,
  SUM(CASE WHEN oe.status = 'error' THEN 1 ELSE 0 END) as error_count,
  AVG(oe.duration_ms) as avg_duration_ms,
  0 as estimated_cost_usd
FROM observability_events oe
WHERE oe.model IS NOT NULL
GROUP BY oe.model, date(oe.triggered_at/1000, 'unixepoch');

-- Agent daily aggregates (from analytics_agent_steps_view)
CREATE VIEW IF NOT EXISTS analytics_agent_daily_view AS
SELECT
  'agent_daily' as aggregate_type,
  asv.agent_name as aggregate_key,
  'day' as period_type,
  CAST(strftime('%s', date(asv.created_at/1000, 'unixepoch')) AS INTEGER) * 1000 as period_start,
  CAST(strftime('%s', date(asv.created_at/1000, 'unixepoch'), '+1 day') AS INTEGER) * 1000 as period_end,
  SUM(asv.input_tokens) as input_tokens,
  SUM(asv.output_tokens) as output_tokens,
  SUM(asv.input_tokens + asv.output_tokens) as total_tokens,
  SUM(asv.cached_tokens) as cached_tokens,
  SUM(asv.reasoning_tokens) as reasoning_tokens,
  COUNT(*) as invocation_count,
  SUM(CASE WHEN asv.status = 'success' THEN 1 ELSE 0 END) as success_count,
  SUM(CASE WHEN asv.status = 'error' THEN 1 ELSE 0 END) as error_count,
  SUM(asv.duration_ms) as total_duration_ms,
  AVG(asv.duration_ms) as avg_duration_ms,
  SUM(asv.tool_calls_count) as total_tool_calls
FROM analytics_agent_steps_view asv
GROUP BY asv.agent_name, date(asv.created_at/1000, 'unixepoch');

-- ============================================================================
-- PHASE 6: Recreate session stats view (enhanced from 0002)
-- Source: chat_messages
-- ============================================================================

CREATE VIEW IF NOT EXISTS analytics_session_stats AS
SELECT
  cm.session_id,
  MAX(cm.platform) as platform,
  MAX(cm.user_id) as user_id,
  MAX(cm.username) as username,
  cm.session_id as conversation_id,
  COUNT(*) as message_count,
  SUM(CASE WHEN cm.role = 'user' THEN 1 ELSE 0 END) as user_messages,
  SUM(CASE WHEN cm.role = 'assistant' THEN 1 ELSE 0 END) as assistant_messages,
  SUM(COALESCE(cm.input_tokens, 0)) as total_input_tokens,
  SUM(COALESCE(cm.output_tokens, 0)) as total_output_tokens,
  SUM(COALESCE(cm.cached_tokens, 0)) as total_cached_tokens,
  SUM(COALESCE(cm.input_tokens, 0) + COALESCE(cm.output_tokens, 0)) as total_tokens,
  MIN(cm.timestamp) as first_message_at,
  MAX(cm.timestamp) as last_message_at,
  MAX(cm.timestamp) - MIN(cm.timestamp) as session_duration_ms
FROM chat_messages cm
WHERE COALESCE(cm.is_archived, 0) = 0
GROUP BY cm.session_id;

-- ============================================================================
-- PHASE 7: Recreate agent performance views
-- Source: analytics_agent_steps_view
-- ============================================================================

CREATE VIEW IF NOT EXISTS analytics_agent_performance_view AS
SELECT
  asv.agent_name,
  asv.agent_type,
  asv.model,
  COUNT(*) as total_invocations,
  SUM(CASE WHEN asv.status = 'success' THEN 1 ELSE 0 END) as successful_invocations,
  SUM(CASE WHEN asv.status = 'error' THEN 1 ELSE 0 END) as failed_invocations,
  ROUND(100.0 * SUM(CASE WHEN asv.status = 'success' THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate_pct,
  ROUND(AVG(asv.duration_ms), 0) as avg_duration_ms,
  MIN(asv.duration_ms) as min_duration_ms,
  MAX(asv.duration_ms) as max_duration_ms,
  SUM(asv.input_tokens) as total_input_tokens,
  SUM(asv.output_tokens) as total_output_tokens,
  SUM(asv.cached_tokens) as total_cached_tokens,
  SUM(asv.reasoning_tokens) as total_reasoning_tokens,
  ROUND(AVG(asv.input_tokens), 0) as avg_input_tokens,
  ROUND(AVG(asv.output_tokens), 0) as avg_output_tokens,
  SUM(asv.tool_calls_count) as total_tool_calls,
  ROUND(AVG(asv.tool_calls_count), 1) as avg_tools_per_step
FROM analytics_agent_steps_view asv
WHERE asv.status IN ('success', 'error')
GROUP BY asv.agent_name, asv.agent_type, asv.model;

-- ============================================================================
-- PHASE 8: Recreate hourly metrics views for real-time dashboards
-- Source: chat_messages and observability_events
-- ============================================================================

CREATE VIEW IF NOT EXISTS analytics_hourly_messages_view AS
SELECT
  strftime('%Y-%m-%d %H:00', cm.timestamp / 1000, 'unixepoch') as hour,
  COALESCE(cm.platform, 'telegram') as platform,
  COUNT(*) as message_count,
  COUNT(DISTINCT cm.session_id) as session_count,
  COUNT(DISTINCT cm.user_id) as user_count,
  SUM(COALESCE(cm.input_tokens, 0)) as input_tokens,
  SUM(COALESCE(cm.output_tokens, 0)) as output_tokens,
  SUM(COALESCE(cm.cached_tokens, 0)) as cached_tokens,
  SUM(COALESCE(cm.reasoning_tokens, 0)) as reasoning_tokens
FROM chat_messages cm
WHERE COALESCE(cm.is_archived, 0) = 0
GROUP BY hour, COALESCE(cm.platform, 'telegram');

-- Daily metrics view for dashboard
CREATE VIEW IF NOT EXISTS analytics_daily_metrics_view AS
SELECT
  date(cm.timestamp / 1000, 'unixepoch') as date,
  COALESCE(cm.platform, 'telegram') as platform,
  COUNT(*) as total_messages,
  COUNT(DISTINCT cm.session_id) as active_sessions,
  COUNT(DISTINCT cm.user_id) as active_users,
  SUM(CASE WHEN cm.role = 'user' THEN 1 ELSE 0 END) as user_messages,
  SUM(CASE WHEN cm.role = 'assistant' THEN 1 ELSE 0 END) as assistant_messages,
  SUM(COALESCE(cm.input_tokens, 0) + COALESCE(cm.output_tokens, 0)) as total_tokens
FROM chat_messages cm
WHERE COALESCE(cm.is_archived, 0) = 0
GROUP BY date, COALESCE(cm.platform, 'telegram');

-- ============================================================================
-- PHASE 9: Create compatibility aliases (optional - for gradual migration)
-- These can be dropped after storage classes are updated
-- ============================================================================

-- Alias for backwards compatibility with code using old table names
-- DROP VIEW IF EXISTS analytics_messages;
-- CREATE VIEW analytics_messages AS SELECT * FROM analytics_messages_view;

-- Note: The above aliases are commented out to avoid conflicts with existing tables.
-- Uncomment after running 0009 to drop the old tables.
