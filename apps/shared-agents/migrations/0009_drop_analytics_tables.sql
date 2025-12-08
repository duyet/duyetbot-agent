-- Migration: 0009_drop_analytics_tables.sql
-- Database: duyetbot
-- Description: Drop deprecated analytics tables after views are verified working.
-- IMPORTANT: Run this ONLY after:
--   1. Migration 0007 (enhance chat_messages) is applied and verified
--   2. Migration 0008 (centralized views) is applied and verified
--   3. Storage classes updated to use views instead of tables
--   4. Dashboard tested with new views
--
-- This migration is IRREVERSIBLE. Data in analytics tables will be lost.
-- However, all data can be reconstructed from source tables:
--   - observability_events (0001)
--   - chat_messages (0002 + 0007)

-- ============================================================================
-- WARNING: Verify views are working before running this migration!
-- ============================================================================

-- Test queries to run before dropping tables:
-- SELECT COUNT(*) FROM analytics_messages_view;
-- SELECT COUNT(*) FROM analytics_agent_steps_view;
-- SELECT COUNT(*) FROM analytics_conversations_view;
-- SELECT COUNT(*) FROM analytics_session_stats;

-- ============================================================================
-- PHASE 1: Drop analytics_messages table
-- Data source: Now computed from chat_messages via analytics_messages_view
-- ============================================================================

DROP TABLE IF EXISTS analytics_messages;

-- ============================================================================
-- PHASE 2: Drop analytics_agent_steps table
-- Data source: Now computed from observability_events.agents via analytics_agent_steps_view
-- ============================================================================

DROP TABLE IF EXISTS analytics_agent_steps;

-- ============================================================================
-- PHASE 3: Drop analytics_conversations table
-- Data source: Now computed from chat_messages via analytics_conversations_view
-- ============================================================================

DROP TABLE IF EXISTS analytics_conversations;

-- ============================================================================
-- PHASE 4: Drop analytics_token_aggregates table
-- Data source: Now computed on-demand via daily/hourly views
-- ============================================================================

DROP TABLE IF EXISTS analytics_token_aggregates;

-- ============================================================================
-- PHASE 5: Keep analytics_cost_config (it's configuration, not duplicated data)
-- ============================================================================

-- analytics_cost_config is retained as it stores pricing configuration
-- This is not derived from other data - it's authoritative configuration

-- ============================================================================
-- PHASE 6: Create compatibility aliases for gradual migration
-- ============================================================================

-- Create aliases so old code still works while being migrated
CREATE VIEW IF NOT EXISTS analytics_messages AS SELECT * FROM analytics_messages_view;
CREATE VIEW IF NOT EXISTS analytics_agent_steps AS SELECT * FROM analytics_agent_steps_view;
CREATE VIEW IF NOT EXISTS analytics_conversations AS SELECT * FROM analytics_conversations_view;

-- Note: analytics_token_aggregates was pre-computed and doesn't have a direct 1:1 view replacement.
-- Use the specific daily views instead:
--   - analytics_user_daily_view
--   - analytics_platform_daily_view
--   - analytics_model_daily_view
--   - analytics_agent_daily_view

-- ============================================================================
-- SUMMARY
-- ============================================================================

-- Tables dropped:
--   - analytics_messages (data in chat_messages)
--   - analytics_agent_steps (data in observability_events.agents)
--   - analytics_conversations (computed from chat_messages)
--   - analytics_token_aggregates (computed on-demand from source tables)

-- Tables retained:
--   - observability_events (source of truth for events)
--   - chat_messages (source of truth for messages)
--   - analytics_cost_config (pricing configuration)

-- Views created as aliases:
--   - analytics_messages → analytics_messages_view
--   - analytics_agent_steps → analytics_agent_steps_view
--   - analytics_conversations → analytics_conversations_view
