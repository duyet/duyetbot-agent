# Centralized Data Monitoring Architecture

## Overview

This document outlines the refactored data monitoring architecture that centralizes all data in two source-of-truth tables and uses SQL views for analytics.

## Problem Statement

The current schema has **data duplication**:

| Table | Purpose | Duplication Issue |
|-------|---------|-------------------|
| `observability_events` | Webhook events + agent chain | ✅ Source of truth |
| `chat_messages` | Simple message storage | ✅ Source of truth |
| `analytics_messages` | Rich message metadata | ❌ Duplicates `chat_messages` |
| `analytics_agent_steps` | Agent execution traces | ❌ Duplicates `observability_events.agents` JSON |
| `analytics_conversations` | Conversation metadata | ❌ Denormalized from messages |
| `analytics_token_aggregates` | Pre-computed aggregates | ❌ Duplicates computed data |

**Issues with current design:**
1. Data inconsistency risk between source and analytics tables
2. Double storage cost
3. Sync logic complexity
4. Potential data loss if sync fails

## Proposed Solution

### Single Source of Truth

Keep only two tables with ALL necessary fields:

```
┌─────────────────────────────────────────────────────────────────┐
│                     SOURCE TABLES (Persist)                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  observability_events (0001)         chat_messages (0002)        │
│  ├── event_id (PK)                   ├── id (PK)                │
│  ├── app_source                      ├── event_id (FK)          │
│  ├── user_id, username               ├── session_id             │
│  ├── classification_*                ├── message_id (NEW)       │
│  ├── agents (JSON)                   ├── role, content          │
│  ├── input/output_tokens             ├── platform (NEW)         │
│  ├── model                           ├── user_id (NEW)          │
│  └── metadata                        ├── visibility (NEW)       │
│                                      ├── is_archived (NEW)      │
│                                      └── input/output_tokens    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      VIEWS (Computed)                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  analytics_messages_view          analytics_agent_steps_view     │
│  ├── Based on chat_messages       ├── Based on observability_   │
│  ├── Enriched with event data     │   events.agents JSON        │
│  └── Visibility, archive status   └── Flattened step records    │
│                                                                  │
│  analytics_conversations_view     analytics_aggregates_view     │
│  ├── Aggregated from chat_msgs    ├── Daily/hourly aggregates   │
│  └── Per-session statistics       └── Token counts, costs       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Migration Strategy

#### Phase 1: Enhance Source Tables

**Enhance `chat_messages` (0002) with analytics fields:**

```sql
-- Add missing fields to chat_messages
ALTER TABLE chat_messages ADD COLUMN message_id TEXT UNIQUE;
ALTER TABLE chat_messages ADD COLUMN platform TEXT DEFAULT 'telegram';
ALTER TABLE chat_messages ADD COLUMN user_id TEXT;
ALTER TABLE chat_messages ADD COLUMN username TEXT;
ALTER TABLE chat_messages ADD COLUMN chat_id TEXT;
ALTER TABLE chat_messages ADD COLUMN visibility TEXT DEFAULT 'private';
ALTER TABLE chat_messages ADD COLUMN is_archived INTEGER DEFAULT 0;
ALTER TABLE chat_messages ADD COLUMN is_pinned INTEGER DEFAULT 0;
ALTER TABLE chat_messages ADD COLUMN cached_tokens INTEGER DEFAULT 0;
ALTER TABLE chat_messages ADD COLUMN reasoning_tokens INTEGER DEFAULT 0;
ALTER TABLE chat_messages ADD COLUMN model TEXT;
ALTER TABLE chat_messages ADD COLUMN metadata TEXT;
ALTER TABLE chat_messages ADD COLUMN updated_at INTEGER;

-- Backfill message_id for existing rows
UPDATE chat_messages SET message_id = lower(hex(randomblob(16))) WHERE message_id IS NULL;

-- Extract user_id and platform from session_id
UPDATE chat_messages
SET platform = substr(session_id, 1, instr(session_id, ':') - 1),
    user_id = substr(session_id, instr(session_id, ':') + 1)
WHERE platform IS NULL;
```

#### Phase 2: Create Views Instead of Tables

**Replace `analytics_messages` with a view:**

```sql
CREATE VIEW analytics_messages_view AS
SELECT
  cm.id,
  cm.message_id,
  cm.session_id,
  -- Derive conversation_id from session
  cm.session_id as conversation_id,
  NULL as parent_message_id,
  cm.sequence,
  cm.role,
  cm.content,
  NULL as content_hash,
  cm.visibility,
  cm.is_archived,
  cm.is_pinned,
  cm.event_id,
  NULL as trigger_message_id,
  NULL as platform_message_id,
  cm.platform,
  cm.user_id,
  cm.username,
  cm.chat_id,
  oe.repo,
  cm.input_tokens,
  cm.output_tokens,
  cm.cached_tokens,
  cm.reasoning_tokens,
  cm.model,
  cm.timestamp as created_at,
  COALESCE(cm.updated_at, cm.timestamp) as updated_at,
  cm.metadata
FROM chat_messages cm
LEFT JOIN observability_events oe ON cm.event_id = oe.event_id;
```

**Replace `analytics_agent_steps` with a view:**

```sql
-- View that extracts agent steps from observability_events.agents JSON
CREATE VIEW analytics_agent_steps_view AS
WITH RECURSIVE agent_extract AS (
  -- Extract top-level agents
  SELECT
    oe.event_id,
    json_extract(agent.value, '$.name') as agent_name,
    json_extract(agent.value, '$.type') as agent_type,
    agent.key as sequence,
    NULL as parent_step_id,
    oe.event_id || '-' || agent.key as step_id,
    json_extract(agent.value, '$.duration_ms') as duration_ms,
    json_extract(agent.value, '$.input_tokens') as input_tokens,
    json_extract(agent.value, '$.output_tokens') as output_tokens,
    json_extract(agent.value, '$.cached_tokens') as cached_tokens,
    json_extract(agent.value, '$.reasoning_tokens') as reasoning_tokens,
    json_extract(agent.value, '$.model') as model,
    json_extract(agent.value, '$.tools') as tools_used,
    json_extract(agent.value, '$.tool_calls') as tool_calls_count,
    oe.status,
    oe.triggered_at as started_at,
    oe.completed_at,
    json_extract(agent.value, '$.workers') as workers_json,
    oe.created_at
  FROM observability_events oe,
       json_each(oe.agents) agent
  WHERE oe.agents IS NOT NULL
)
SELECT
  step_id,
  event_id,
  NULL as message_id,
  parent_step_id,
  agent_name,
  agent_type,
  CAST(sequence AS INTEGER) as sequence,
  started_at,
  completed_at,
  COALESCE(duration_ms, 0) as duration_ms,
  0 as queue_time_ms,
  CASE WHEN status = 'success' THEN 'success' ELSE 'error' END as status,
  COALESCE(input_tokens, 0) as input_tokens,
  COALESCE(output_tokens, 0) as output_tokens,
  COALESCE(cached_tokens, 0) as cached_tokens,
  COALESCE(reasoning_tokens, 0) as reasoning_tokens,
  model,
  tools_used,
  COALESCE(tool_calls_count, 0) as tool_calls_count,
  NULL as error_type,
  NULL as error_message,
  0 as retry_count,
  NULL as metadata,
  created_at
FROM agent_extract;
```

**Replace `analytics_conversations` with a view:**

```sql
CREATE VIEW analytics_conversations_view AS
SELECT
  session_id as conversation_id,
  MAX(user_id) as user_id,
  MAX(platform) as platform,
  NULL as title,
  NULL as summary,
  MAX(visibility) as visibility,
  MAX(is_archived) as is_archived,
  0 as is_starred,
  COUNT(*) as message_count,
  1 as session_count,
  SUM(input_tokens + output_tokens) as total_tokens,
  MIN(timestamp) as first_message_at,
  MAX(timestamp) as last_message_at,
  MIN(created_at) as created_at,
  MAX(COALESCE(updated_at, timestamp)) as updated_at,
  NULL as metadata
FROM chat_messages
WHERE is_archived = 0
GROUP BY session_id;
```

**Replace `analytics_token_aggregates` with views:**

```sql
-- User daily aggregates
CREATE VIEW analytics_user_daily_view AS
SELECT
  'user_daily' as aggregate_type,
  user_id as aggregate_key,
  'day' as period_type,
  strftime('%s', date(timestamp/1000, 'unixepoch')) * 1000 as period_start,
  strftime('%s', date(timestamp/1000, 'unixepoch'), '+1 day') * 1000 as period_end,
  SUM(input_tokens) as input_tokens,
  SUM(output_tokens) as output_tokens,
  SUM(input_tokens + output_tokens) as total_tokens,
  SUM(cached_tokens) as cached_tokens,
  SUM(reasoning_tokens) as reasoning_tokens,
  COUNT(*) as message_count,
  SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) as user_message_count,
  SUM(CASE WHEN role = 'assistant' THEN 1 ELSE 0 END) as assistant_message_count,
  COUNT(DISTINCT event_id) as event_count,
  COUNT(DISTINCT session_id) as session_count,
  0 as estimated_cost_usd,
  MAX(created_at) as last_computed_at,
  MAX(created_at) as created_at
FROM chat_messages
WHERE is_archived = 0
GROUP BY user_id, date(timestamp/1000, 'unixepoch');

-- Platform daily aggregates
CREATE VIEW analytics_platform_daily_view AS
SELECT
  'platform_daily' as aggregate_type,
  platform as aggregate_key,
  'day' as period_type,
  strftime('%s', date(timestamp/1000, 'unixepoch')) * 1000 as period_start,
  strftime('%s', date(timestamp/1000, 'unixepoch'), '+1 day') * 1000 as period_end,
  SUM(input_tokens) as input_tokens,
  SUM(output_tokens) as output_tokens,
  SUM(input_tokens + output_tokens) as total_tokens,
  COUNT(*) as message_count,
  COUNT(DISTINCT user_id) as user_count,
  COUNT(DISTINCT session_id) as session_count
FROM chat_messages
WHERE is_archived = 0
GROUP BY platform, date(timestamp/1000, 'unixepoch');
```

#### Phase 3: Update Storage Classes

The storage classes in `packages/analytics/` need to be updated to query from views instead of tables:

```typescript
// Before: Query analytics_messages table
const result = await this.first<AnalyticsMessage>(
  'SELECT * FROM analytics_messages WHERE message_id = ?',
  [messageId]
);

// After: Query analytics_messages_view
const result = await this.first<AnalyticsMessage>(
  'SELECT * FROM analytics_messages_view WHERE message_id = ?',
  [messageId]
);
```

#### Phase 4: Drop Deprecated Tables

After migration is complete and views are working:

```sql
-- Migration: 0007_drop_analytics_tables.sql
DROP TABLE IF EXISTS analytics_messages;
DROP TABLE IF EXISTS analytics_agent_steps;
DROP TABLE IF EXISTS analytics_conversations;
DROP TABLE IF EXISTS analytics_token_aggregates;
```

## Data Flow

### Write Path (No Change to Sources)

```
User Message
    │
    ▼
CloudflareChatAgent
    │
    ├─► observability_events  (INSERT: event with agents JSON)
    │
    └─► chat_messages         (INSERT: individual messages)
```

### Read Path (Views Instead of Tables)

```
Dashboard Query
    │
    ▼
API Route Handler
    │
    ├─► analytics_messages_view        (SELECT from view)
    │       └── Joins chat_messages + observability_events
    │
    ├─► analytics_agent_steps_view     (SELECT from view)
    │       └── Extracts from observability_events.agents JSON
    │
    ├─► analytics_conversations_view   (SELECT from view)
    │       └── Aggregates from chat_messages
    │
    └─► analytics_*_daily_view         (SELECT from view)
            └── Aggregates from chat_messages/observability_events
```

## Schema Changes Summary

### Tables to Keep (Enhanced)

| Table | Changes |
|-------|---------|
| `observability_events` | No changes (already complete) |
| `chat_messages` | Add: `message_id`, `platform`, `user_id`, `visibility`, `is_archived`, `cached_tokens`, `reasoning_tokens`, `model`, `metadata` |
| `analytics_cost_config` | Keep as-is (configuration, not data) |

### Tables to Replace with Views

| Table | Replacement View |
|-------|------------------|
| `analytics_messages` | `analytics_messages_view` |
| `analytics_agent_steps` | `analytics_agent_steps_view` |
| `analytics_conversations` | `analytics_conversations_view` |
| `analytics_token_aggregates` | `analytics_user_daily_view`, `analytics_platform_daily_view`, etc. |

## Benefits

1. **Single Source of Truth**: All data in `observability_events` and `chat_messages`
2. **No Data Loss**: Source tables are never deleted
3. **Always Consistent**: Views compute from source data
4. **Reduced Storage**: No duplicate data
5. **Simpler Sync**: No background jobs to sync tables
6. **Faster Writes**: Insert only to source tables

## Performance Considerations

### View Performance

Views are computed on-read, which may be slower than pre-computed tables. Mitigations:

1. **Indexes on source tables**: Ensure proper indexes exist
2. **Materialized views**: D1 doesn't support materialized views, but we can use scheduled workers to refresh aggregate views periodically
3. **Caching**: Use Cloudflare KV or Workers cache for frequently-accessed aggregates

### Recommended Indexes

```sql
-- chat_messages
CREATE INDEX idx_chat_msg_user_time ON chat_messages(user_id, timestamp DESC);
CREATE INDEX idx_chat_msg_platform_time ON chat_messages(platform, timestamp DESC);
CREATE INDEX idx_chat_msg_session ON chat_messages(session_id, sequence);
CREATE INDEX idx_chat_msg_visibility ON chat_messages(visibility) WHERE visibility = 'public';

-- observability_events (already has good indexes)
CREATE INDEX idx_obs_agents ON observability_events(agents) WHERE agents IS NOT NULL;
```

## Migration Plan

1. **Week 1**: Create migration `0007_enhance_chat_messages.sql` with new columns
2. **Week 1**: Backfill data from `analytics_messages` to `chat_messages`
3. **Week 2**: Create views in `0008_analytics_views.sql`
4. **Week 2**: Update storage classes to use views
5. **Week 3**: Test thoroughly
6. **Week 3**: Create `0009_drop_analytics_tables.sql` (run after verification)

## Rollback Plan

If issues arise:
1. Views can be dropped without data loss
2. Original tables can be recreated from source data
3. Storage classes can be reverted to query original tables

## Implementation Status (Updated: 2025-12-08)

### Completed Migrations

| Migration | Status | Description |
|-----------|--------|-------------|
| `0007_enhance_chat_messages.sql` | ✅ Applied | Added columns: `message_id`, `platform`, `user_id`, `visibility`, etc. |
| `0008_centralized_analytics_views.sql` | ✅ Applied | Created views: `analytics_messages_view`, `analytics_conversations_view`, etc. |
| `0009_drop_analytics_tables.sql` | ⏳ Pending | Will drop deprecated tables after storage class updates |

### Verified Views

| View | Count | Source |
|------|-------|--------|
| `analytics_messages_view` | 24 rows | `chat_messages` + `observability_events` |
| `analytics_conversations_view` | 3 rows | Aggregated from `chat_messages` |
| `analytics_agent_steps_view` | 0 rows | Extracted from `observability_events.agents` JSON |

### Remaining Tasks

1. [x] Create migration `0007_enhance_chat_messages.sql`
2. [x] Create migration `0008_centralized_analytics_views.sql`
3. [x] Update `packages/analytics/src/storage/` to use views
   - `message-storage.ts`: Writes to `chat_messages`, reads from `analytics_messages` view
   - `agent-step-storage.ts`: Updates `agents` JSON in `observability_events`, reads from view
   - `conversation-storage.ts`: Writes to `chat_messages`, reads from `analytics_conversations` view
   - `aggregate-storage.ts`: Computes aggregates on-demand from `chat_messages`
4. [x] Test dashboard with new views (TypeScript compiles, API routes use storage classes correctly)
5. [x] Create migration `0009_drop_analytics_tables.sql`
6. [ ] Apply migration 0009 after deployment verification
7. [ ] Deploy and monitor
