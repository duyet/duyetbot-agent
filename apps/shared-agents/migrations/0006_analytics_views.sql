-- Migration: 0006_analytics_views.sql
-- Database: duyetbot
-- Description: SQL views for common analytics queries, reporting, and dashboard rendering.
-- Provides unified interface for frontend analytics and monitoring tools.
-- Used by: dashboards, reports, real-time monitoring, scheduled aggregations
-- Design: Views are materialized periodically via ETL jobs (via monitoring/observability service)

-- ============================================================================
-- Session Analytics Views
-- ============================================================================

-- Session stats with all metrics in one place for dashboard cards
CREATE VIEW IF NOT EXISTS analytics_session_stats AS
SELECT
  am.session_id,
  am.conversation_id,
  am.platform,
  am.user_id,
  am.username,
  COUNT(*) as total_messages,
  SUM(CASE WHEN am.role = 'user' THEN 1 ELSE 0 END) as user_messages,
  SUM(CASE WHEN am.role = 'assistant' THEN 1 ELSE 0 END) as assistant_messages,
  SUM(am.input_tokens) as input_tokens,
  SUM(am.output_tokens) as output_tokens,
  SUM(am.cached_tokens) as cached_tokens,
  SUM(am.reasoning_tokens) as reasoning_tokens,
  SUM(am.input_tokens + am.output_tokens + am.cached_tokens + am.reasoning_tokens) as total_tokens,
  MIN(am.created_at) as session_start,
  MAX(am.created_at) as session_end,
  MAX(am.created_at) - MIN(am.created_at) as session_duration_ms,
  COUNT(DISTINCT am.event_id) as event_count,
  COUNT(DISTINCT am.model) as model_variants,
  SUM(CASE WHEN am.is_pinned = 1 THEN 1 ELSE 0 END) as pinned_messages
FROM analytics_messages am
WHERE am.is_archived = 0
GROUP BY am.session_id;

-- ============================================================================
-- User Analytics Views
-- ============================================================================

-- Daily user activity with engagement metrics
CREATE VIEW IF NOT EXISTS analytics_user_daily AS
SELECT
  date(am.created_at / 1000, 'unixepoch') as activity_date,
  am.user_id,
  am.platform,
  COUNT(*) as message_count,
  COUNT(DISTINCT am.session_id) as session_count,
  COUNT(DISTINCT am.conversation_id) as conversation_count,
  SUM(CASE WHEN am.role = 'user' THEN 1 ELSE 0 END) as user_messages,
  SUM(CASE WHEN am.role = 'assistant' THEN 1 ELSE 0 END) as assistant_messages,
  SUM(am.input_tokens) as input_tokens,
  SUM(am.output_tokens) as output_tokens,
  SUM(am.cached_tokens) as cached_tokens,
  SUM(am.reasoning_tokens) as reasoning_tokens,
  COUNT(DISTINCT am.model) as unique_models,
  MIN(am.created_at) as first_activity,
  MAX(am.created_at) as last_activity
FROM analytics_messages am
WHERE am.is_archived = 0
GROUP BY activity_date, am.user_id, am.platform;

-- Weekly user activity rollup
CREATE VIEW IF NOT EXISTS analytics_user_weekly AS
SELECT
  strftime('%Y-W%W', am.created_at / 1000, 'unixepoch') as week,
  am.user_id,
  am.platform,
  COUNT(*) as message_count,
  COUNT(DISTINCT am.session_id) as session_count,
  SUM(am.input_tokens + am.output_tokens) as total_tokens,
  COUNT(DISTINCT date(am.created_at / 1000, 'unixepoch')) as active_days,
  COUNT(DISTINCT am.model) as unique_models
FROM analytics_messages am
WHERE am.is_archived = 0
GROUP BY week, am.user_id, am.platform;

-- Monthly user activity rollup
CREATE VIEW IF NOT EXISTS analytics_user_monthly AS
SELECT
  strftime('%Y-%m', am.created_at / 1000, 'unixepoch') as month,
  am.user_id,
  am.platform,
  COUNT(*) as message_count,
  COUNT(DISTINCT am.session_id) as session_count,
  COUNT(DISTINCT am.conversation_id) as conversation_count,
  SUM(am.input_tokens + am.output_tokens) as total_tokens,
  COUNT(DISTINCT date(am.created_at / 1000, 'unixepoch')) as active_days,
  COUNT(DISTINCT am.model) as unique_models
FROM analytics_messages am
WHERE am.is_archived = 0
GROUP BY month, am.user_id, am.platform;

-- User engagement score (activity metric)
CREATE VIEW IF NOT EXISTS analytics_user_engagement AS
SELECT
  am.user_id,
  am.platform,
  COUNT(*) as lifetime_messages,
  COUNT(DISTINCT am.session_id) as lifetime_sessions,
  COUNT(DISTINCT date(am.created_at / 1000, 'unixepoch')) as active_days,
  ROUND(COUNT(*) / NULLIF(COUNT(DISTINCT date(am.created_at / 1000, 'unixepoch')), 0), 1) as messages_per_active_day,
  SUM(am.input_tokens + am.output_tokens) as lifetime_tokens,
  MIN(am.created_at) as first_message_at,
  MAX(am.created_at) as last_message_at,
  ROUND((MAX(am.created_at) - MIN(am.created_at)) / 1000 / 60 / 60 / 24, 0) as days_since_first_message,
  ROUND((unixepoch() * 1000 - MAX(am.created_at)) / 1000 / 60 / 60 / 24, 0) as days_since_last_activity
FROM analytics_messages am
WHERE am.is_archived = 0
GROUP BY am.user_id, am.platform;

-- ============================================================================
-- Agent Performance Views
-- ============================================================================

-- Daily agent performance with error tracking
CREATE VIEW IF NOT EXISTS analytics_agent_daily AS
SELECT
  date(aas.completed_at / 1000, 'unixepoch') as date,
  aas.agent_name,
  aas.agent_type,
  COUNT(*) as invocations,
  SUM(CASE WHEN aas.status = 'success' THEN 1 ELSE 0 END) as successful,
  SUM(CASE WHEN aas.status = 'error' THEN 1 ELSE 0 END) as failed,
  SUM(CASE WHEN aas.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
  ROUND(100.0 * SUM(CASE WHEN aas.status = 'success' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) as success_rate,
  ROUND(AVG(aas.duration_ms), 0) as avg_duration_ms,
  MIN(aas.duration_ms) as min_duration_ms,
  MAX(aas.duration_ms) as max_duration_ms,
  SUM(aas.input_tokens) as input_tokens,
  SUM(aas.output_tokens) as output_tokens,
  SUM(aas.tool_calls_count) as tool_calls,
  COUNT(DISTINCT aas.model) as model_variants
FROM analytics_agent_steps aas
WHERE aas.status IN ('success', 'error', 'cancelled')
  AND aas.completed_at IS NOT NULL
GROUP BY date, aas.agent_name, aas.agent_type;

-- Real-time agent status (last 24 hours)
CREATE VIEW IF NOT EXISTS analytics_agent_realtime AS
SELECT
  aas.agent_name,
  aas.agent_type,
  COUNT(*) as invocations_24h,
  SUM(CASE WHEN aas.status = 'success' THEN 1 ELSE 0 END) as success_24h,
  SUM(CASE WHEN aas.status = 'error' THEN 1 ELSE 0 END) as errors_24h,
  ROUND(100.0 * SUM(CASE WHEN aas.status = 'success' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) as success_rate,
  ROUND(AVG(aas.duration_ms), 0) as avg_duration_ms,
  ROUND(AVG(aas.queue_time_ms), 0) as avg_queue_time_ms,
  MAX(aas.completed_at) as last_invocation
FROM analytics_agent_steps aas
WHERE aas.completed_at > (unixepoch() * 1000 - 24 * 60 * 60 * 1000)
  AND aas.status IN ('success', 'error')
GROUP BY aas.agent_name, aas.agent_type;

-- Agent error details for debugging
CREATE VIEW IF NOT EXISTS analytics_agent_error_details AS
SELECT
  aas.agent_name,
  aas.error_type,
  COUNT(*) as error_count,
  ROUND(100.0 * COUNT(*) / (
    SELECT COUNT(*) FROM analytics_agent_steps s2
    WHERE s2.agent_name = aas.agent_name
      AND s2.status IN ('success', 'error')
  ), 2) as error_rate,
  MIN(aas.completed_at) as first_error,
  MAX(aas.completed_at) as last_error,
  AVG(aas.retry_count) as avg_retries,
  MAX(aas.retry_count) as max_retries
FROM analytics_agent_steps aas
WHERE aas.status = 'error'
GROUP BY aas.agent_name, aas.error_type
ORDER BY error_count DESC;

-- ============================================================================
-- Platform Analytics Views
-- ============================================================================

-- Platform usage trends (hourly)
CREATE VIEW IF NOT EXISTS analytics_platform_hourly AS
SELECT
  strftime('%Y-%m-%d %H:00', am.created_at / 1000, 'unixepoch') as hour,
  am.platform,
  COUNT(*) as message_count,
  COUNT(DISTINCT am.session_id) as session_count,
  COUNT(DISTINCT am.user_id) as user_count,
  SUM(am.input_tokens) as input_tokens,
  SUM(am.output_tokens) as output_tokens,
  SUM(am.cached_tokens) as cached_tokens,
  SUM(CASE WHEN am.role = 'user' THEN 1 ELSE 0 END) as user_messages,
  SUM(CASE WHEN am.role = 'assistant' THEN 1 ELSE 0 END) as assistant_messages
FROM analytics_messages am
WHERE am.is_archived = 0
  AND am.created_at > (unixepoch() * 1000 - 24 * 60 * 60 * 1000)
GROUP BY hour, am.platform;

-- Platform daily stats
CREATE VIEW IF NOT EXISTS analytics_platform_daily AS
SELECT
  date(am.created_at / 1000, 'unixepoch') as date,
  am.platform,
  COUNT(*) as message_count,
  COUNT(DISTINCT am.session_id) as session_count,
  COUNT(DISTINCT am.user_id) as active_users,
  COUNT(DISTINCT am.conversation_id) as conversation_count,
  SUM(am.input_tokens) as input_tokens,
  SUM(am.output_tokens) as output_tokens,
  SUM(am.cached_tokens) as cached_tokens,
  SUM(am.reasoning_tokens) as reasoning_tokens
FROM analytics_messages am
WHERE am.is_archived = 0
GROUP BY date, am.platform;

-- ============================================================================
-- Model Usage Views
-- ============================================================================

-- Model usage and cost analysis
CREATE VIEW IF NOT EXISTS analytics_model_usage AS
SELECT
  am.model,
  COUNT(*) as message_count,
  COUNT(DISTINCT am.session_id) as session_count,
  COUNT(DISTINCT am.user_id) as user_count,
  SUM(am.input_tokens) as input_tokens,
  SUM(am.output_tokens) as output_tokens,
  SUM(am.cached_tokens) as cached_tokens,
  SUM(am.reasoning_tokens) as reasoning_tokens,
  SUM(am.input_tokens + am.output_tokens + am.cached_tokens + am.reasoning_tokens) as total_tokens,
  MIN(am.created_at) as first_use,
  MAX(am.created_at) as last_use
FROM analytics_messages am
WHERE am.is_archived = 0
  AND am.model IS NOT NULL
GROUP BY am.model;

-- Model daily usage
CREATE VIEW IF NOT EXISTS analytics_model_daily AS
SELECT
  date(am.created_at / 1000, 'unixepoch') as date,
  am.model,
  COUNT(*) as message_count,
  COUNT(DISTINCT am.session_id) as session_count,
  SUM(am.input_tokens) as input_tokens,
  SUM(am.output_tokens) as output_tokens,
  SUM(am.cached_tokens) as cached_tokens
FROM analytics_messages am
WHERE am.is_archived = 0
  AND am.model IS NOT NULL
GROUP BY date, am.model;

-- ============================================================================
-- Conversation Analytics Views
-- ============================================================================

-- Conversation quality metrics
CREATE VIEW IF NOT EXISTS analytics_conversation_quality AS
SELECT
  ac.conversation_id,
  ac.user_id,
  ac.platform,
  ac.message_count,
  ac.session_count,
  ac.total_tokens,
  ROUND(ac.total_tokens / NULLIF(ac.message_count, 0), 0) as avg_tokens_per_message,
  ROUND((ac.last_message_at - ac.first_message_at) / 1000 / 60, 0) as duration_minutes,
  CASE
    WHEN ac.message_count < 5 THEN 'brief'
    WHEN ac.message_count < 20 THEN 'short'
    WHEN ac.message_count < 50 THEN 'medium'
    ELSE 'long'
  END as conversation_length,
  ac.is_starred,
  ac.is_archived
FROM analytics_conversations ac;

-- Trending conversations (most recent activity)
CREATE VIEW IF NOT EXISTS analytics_trending_conversations AS
SELECT
  conversation_id,
  user_id,
  platform,
  title,
  message_count,
  last_message_at,
  ROUND((unixepoch() * 1000 - last_message_at) / 1000 / 60, 0) as minutes_since_last_message,
  total_tokens,
  is_starred
FROM analytics_conversations
WHERE is_archived = 0
  AND last_message_at > (unixepoch() * 1000 - 7 * 24 * 60 * 60 * 1000)
ORDER BY last_message_at DESC;

-- ============================================================================
-- Cost & Token Views
-- ============================================================================

-- Hourly token usage trend (last 7 days)
CREATE VIEW IF NOT EXISTS analytics_hourly_tokens AS
SELECT
  strftime('%Y-%m-%d %H:00', am.created_at / 1000, 'unixepoch') as hour,
  COUNT(*) as message_count,
  SUM(am.input_tokens) as input_tokens,
  SUM(am.output_tokens) as output_tokens,
  SUM(am.cached_tokens) as cached_tokens,
  SUM(am.reasoning_tokens) as reasoning_tokens,
  SUM(am.input_tokens + am.output_tokens + am.cached_tokens + am.reasoning_tokens) as total_tokens,
  ROUND(AVG(am.input_tokens + am.output_tokens), 0) as avg_tokens_per_message
FROM analytics_messages am
WHERE am.created_at > (unixepoch() * 1000 - 7 * 24 * 60 * 60 * 1000)
  AND am.is_archived = 0
GROUP BY hour
ORDER BY hour DESC;

-- Token consumption by role
CREATE VIEW IF NOT EXISTS analytics_tokens_by_role AS
SELECT
  am.role,
  COUNT(*) as message_count,
  SUM(am.input_tokens) as input_tokens,
  SUM(am.output_tokens) as output_tokens,
  SUM(am.cached_tokens) as cached_tokens,
  SUM(am.reasoning_tokens) as reasoning_tokens,
  ROUND(AVG(am.input_tokens + am.output_tokens), 0) as avg_tokens_per_message
FROM analytics_messages am
WHERE am.is_archived = 0
GROUP BY am.role;

-- Cache hit analysis
CREATE VIEW IF NOT EXISTS analytics_cache_efficiency AS
SELECT
  date(am.created_at / 1000, 'unixepoch') as date,
  COUNT(*) as message_count,
  SUM(am.input_tokens) as input_tokens,
  SUM(am.cached_tokens) as cached_tokens,
  ROUND(100.0 * SUM(am.cached_tokens) / NULLIF(SUM(am.input_tokens), 0), 1) as cache_hit_rate_pct,
  SUM(am.input_tokens + am.cached_tokens) as total_tokens_with_cache,
  ROUND(100.0 * SUM(am.cached_tokens) / NULLIF(SUM(am.input_tokens + am.cached_tokens), 0), 1) as cached_ratio_pct
FROM analytics_messages am
WHERE am.is_archived = 0
  AND (am.input_tokens > 0 OR am.cached_tokens > 0)
GROUP BY date;

-- ============================================================================
-- System Health & Monitoring Views
-- ============================================================================

-- System overview (last 24 hours)
CREATE VIEW IF NOT EXISTS analytics_system_overview_24h AS
SELECT
  COUNT(DISTINCT am.user_id) as active_users,
  COUNT(DISTINCT am.session_id) as active_sessions,
  COUNT(*) as total_messages,
  COUNT(DISTINCT am.platform) as platforms_active,
  SUM(am.input_tokens + am.output_tokens) as total_tokens,
  SUM(CASE WHEN am.role = 'user' THEN 1 ELSE 0 END) as user_messages,
  SUM(CASE WHEN am.role = 'assistant' THEN 1 ELSE 0 END) as assistant_messages,
  COUNT(DISTINCT aas.agent_name) as agents_invoked,
  SUM(CASE WHEN aas.status = 'error' THEN 1 ELSE 0 END) as agent_errors
FROM analytics_messages am
LEFT JOIN analytics_agent_steps aas ON am.event_id = aas.event_id
WHERE am.created_at > (unixepoch() * 1000 - 24 * 60 * 60 * 1000)
  AND am.is_archived = 0;

-- Recent errors (last 24 hours)
CREATE VIEW IF NOT EXISTS analytics_recent_errors AS
SELECT
  aas.completed_at,
  aas.agent_name,
  aas.error_type,
  aas.error_message,
  aas.retry_count,
  oe.event_type,
  oe.user_id,
  oe.app_source
FROM analytics_agent_steps aas
LEFT JOIN observability_events oe ON aas.event_id = oe.event_id
WHERE aas.status = 'error'
  AND aas.completed_at > (unixepoch() * 1000 - 24 * 60 * 60 * 1000)
ORDER BY aas.completed_at DESC;
