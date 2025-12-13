# Memory Integration Plan

## Overview

Integrate memory-mcp with the agentic loop to provide **short-term** and **long-term memory** capabilities for AI agents. This enables agents to remember context within sessions (short-term) and across sessions (long-term).

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Agent Execution                              │
│  ┌──────────────────┐   ┌──────────────────┐   ┌─────────────────┐ │
│  │  Short-Term      │   │  Long-Term       │   │  Semantic       │ │
│  │  Memory          │   │  Memory          │   │  Search         │ │
│  │  (Session KV)    │   │  (D1 Database)   │   │  (D1 FTS)       │ │
│  └────────┬─────────┘   └────────┬─────────┘   └────────┬────────┘ │
│           │                      │                      │          │
│           └──────────────────────┼──────────────────────┘          │
│                                  │                                  │
│                    ┌─────────────▼─────────────┐                   │
│                    │     Memory Service        │                   │
│                    │     (memory-mcp)          │                   │
│                    └─────────────┬─────────────┘                   │
│                                  │                                  │
│           ┌──────────────────────┼──────────────────────┐          │
│           │                      │                      │          │
│  ┌────────▼─────────┐   ┌────────▼─────────┐   ┌───────▼────────┐ │
│  │  memory_save     │   │  memory_recall   │   │  memory_search │ │
│  │  (Loop Tool)     │   │  (Loop Tool)     │   │  (Loop Tool)   │ │
│  └──────────────────┘   └──────────────────┘   └────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

## Memory Types

### 1. Short-Term Memory (Session-Scoped)
- **Storage**: Cloudflare KV with TTL
- **Scope**: Current session only
- **TTL**: 24 hours (configurable)
- **Use Cases**:
  - Working context during task execution
  - Temporary notes and scratchpad
  - Task-specific state (current step, variables)
  - Recent tool results cache

### 2. Long-Term Memory (Persistent)
- **Storage**: D1 Database
- **Scope**: Cross-session, per-user
- **TTL**: Permanent (with optional cleanup)
- **Use Cases**:
  - User preferences and settings
  - Important facts learned about user
  - Successful task patterns
  - Key decisions and rationale

### 3. Semantic Memory (Searchable)
- **Storage**: D1 with FTS5 (Full-Text Search)
- **Scope**: Cross-session, searchable
- **Use Cases**:
  - Finding relevant past conversations
  - Retrieving similar problems solved before
  - Knowledge base queries

## Database Schema Changes

### New Tables for memory-mcp

```sql
-- Short-term memory (KV-backed, but tracked in D1 for listing)
CREATE TABLE memory_short_term (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(session_id, key)
);
CREATE INDEX idx_short_term_session ON memory_short_term(session_id);
CREATE INDEX idx_short_term_expires ON memory_short_term(expires_at);

-- Long-term memory (facts, preferences, patterns)
CREATE TABLE memory_long_term (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  category TEXT NOT NULL,  -- 'fact', 'preference', 'pattern', 'decision'
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  importance INTEGER DEFAULT 5,  -- 1-10 scale
  source_session_id TEXT,
  metadata TEXT,  -- JSON
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  accessed_at INTEGER NOT NULL,
  access_count INTEGER DEFAULT 1,
  UNIQUE(user_id, category, key)
);
CREATE INDEX idx_long_term_user ON memory_long_term(user_id);
CREATE INDEX idx_long_term_category ON memory_long_term(user_id, category);
CREATE INDEX idx_long_term_importance ON memory_long_term(user_id, importance DESC);

-- Semantic search index (FTS5)
CREATE VIRTUAL TABLE memory_search USING fts5(
  memory_id,
  user_id UNINDEXED,
  content,
  category UNINDEXED,
  tokenize='porter unicode61'
);
```

## API Endpoints

### New Endpoints for memory-mcp

```typescript
// Short-term memory
POST /api/memory/short-term/set
  { session_id, key, value, ttl_seconds? }
  → { success, expires_at }

POST /api/memory/short-term/get
  { session_id, key }
  → { value, expires_at } | null

POST /api/memory/short-term/list
  { session_id }
  → { items: [{ key, value, expires_at }] }

POST /api/memory/short-term/delete
  { session_id, key }
  → { success }

// Long-term memory
POST /api/memory/long-term/save
  { category, key, value, importance?, metadata? }
  → { id, created }

POST /api/memory/long-term/get
  { category?, key? }
  → { items: [{ id, category, key, value, importance, metadata }] }

POST /api/memory/long-term/update
  { id, value?, importance?, metadata? }
  → { success }

POST /api/memory/long-term/delete
  { id }
  → { success }

// Semantic search
POST /api/memory/search
  { query, categories?, limit? }
  → { results: [{ id, content, category, score }] }
```

## Agentic Loop Tools

### Tool 1: memory_save
```typescript
const memorySaveTool: LoopTool = {
  name: 'memory_save',
  description: 'Save information to memory for later recall. Use short-term for session-specific data, long-term for important facts/preferences.',
  parameters: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['short_term', 'long_term'],
        description: 'Memory type: short_term (session, 24h TTL) or long_term (persistent)'
      },
      category: {
        type: 'string',
        enum: ['fact', 'preference', 'pattern', 'decision', 'note'],
        description: 'Category for long-term memory (required for long_term)'
      },
      key: {
        type: 'string',
        description: 'Unique key for this memory item'
      },
      value: {
        type: 'string',
        description: 'The information to remember'
      },
      importance: {
        type: 'number',
        minimum: 1,
        maximum: 10,
        description: 'Importance score 1-10 (for long_term only)'
      }
    },
    required: ['type', 'key', 'value']
  }
};
```

### Tool 2: memory_recall
```typescript
const memoryRecallTool: LoopTool = {
  name: 'memory_recall',
  description: 'Recall information from memory. Retrieves specific items by key or lists available memories.',
  parameters: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['short_term', 'long_term', 'both'],
        description: 'Which memory type to recall from'
      },
      key: {
        type: 'string',
        description: 'Specific key to recall (optional, lists all if omitted)'
      },
      category: {
        type: 'string',
        description: 'Filter by category (for long_term)'
      }
    },
    required: ['type']
  }
};
```

### Tool 3: memory_search
```typescript
const memorySearchTool: LoopTool = {
  name: 'memory_search',
  description: 'Search memory for relevant information using natural language query.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Natural language search query'
      },
      categories: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter by categories'
      },
      limit: {
        type: 'number',
        default: 5,
        description: 'Maximum results to return'
      }
    },
    required: ['query']
  }
};
```

## Implementation Phases

### Phase 1: Memory-MCP Refactoring
**Files to modify:**
- `apps/memory-mcp/migrations/0005_memory_types.sql` (new)
- `apps/memory-mcp/src/storage/d1.ts`
- `apps/memory-mcp/src/types.ts`
- `apps/memory-mcp/src/tools/short-term-memory.ts` (new)
- `apps/memory-mcp/src/tools/long-term-memory.ts` (new)
- `apps/memory-mcp/src/tools/memory-search.ts` (new)
- `apps/memory-mcp/src/index.ts`
- `apps/memory-mcp/src/rpc-entrypoint.ts`

**Tasks:**
1. Add new database tables via migration
2. Implement short-term memory storage (KV + D1 tracking)
3. Implement long-term memory storage (D1)
4. Implement FTS5 semantic search
5. Add new API endpoints
6. Update RPC entrypoint for service binding calls
7. Add tests for new functionality

### Phase 2: Agentic Loop Memory Tools
**Files to create/modify:**
- `packages/cloudflare-agent/src/agentic-loop/tools/memory.ts` (new)
- `packages/cloudflare-agent/src/agentic-loop/tools/index.ts`

**Tasks:**
1. Create memory_save tool
2. Create memory_recall tool
3. Create memory_search tool
4. Register tools in core tools factory
5. Add tests for memory tools

### Phase 3: Agent Integration
**Files to modify:**
- `packages/cloudflare-agent/src/execution/context.ts`
- `packages/cloudflare-agent/src/mcp-memory-adapter.ts`
- `packages/cloudflare-agent/src/base/base-agent.ts`

**Tasks:**
1. Add memory service client to ExecutionContext
2. Update MCPMemoryAdapter with new endpoints
3. Add automatic memory loading at agent start
4. Add memory context to system prompts
5. Add tests for integration

### Phase 4: Testing & Deployment
**Tasks:**
1. Write integration tests
2. Test with Telegram bot
3. Deploy memory-mcp updates
4. Deploy cloudflare-agent updates
5. Verify end-to-end functionality

## Execution Context Changes

```typescript
interface ExecutionContext {
  // ... existing fields ...

  // Memory service access
  memory: {
    shortTerm: ShortTermMemoryClient;
    longTerm: LongTermMemoryClient;
    search: MemorySearchClient;
  };

  // Preloaded memory context
  memoryContext?: {
    shortTermItems: MemoryItem[];
    relevantLongTerm: MemoryItem[];
    userPreferences: Record<string, string>;
  };
}
```

## System Prompt Integration

Add memory context to agent system prompts:

```typescript
function getMemoryContextSection(ctx: ExecutionContext): string {
  if (!ctx.memoryContext) return '';

  const sections: string[] = [];

  if (ctx.memoryContext.userPreferences) {
    sections.push(`<user_preferences>
${Object.entries(ctx.memoryContext.userPreferences)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join('\n')}
</user_preferences>`);
  }

  if (ctx.memoryContext.relevantLongTerm.length > 0) {
    sections.push(`<relevant_memory>
${ctx.memoryContext.relevantLongTerm
  .map(m => `- [${m.category}] ${m.key}: ${m.value}`)
  .join('\n')}
</relevant_memory>`);
  }

  return sections.join('\n\n');
}
```

## Parallel Implementation Assignment

### Engineer 1: Memory-MCP Backend
- Database migrations
- D1 storage implementation
- API endpoints
- RPC entrypoint updates

### Engineer 2: Agentic Loop Tools
- memory_save tool
- memory_recall tool
- memory_search tool
- Tool registration

### Engineer 3: Agent Integration
- ExecutionContext updates
- MCPMemoryAdapter updates
- System prompt integration
- Automatic memory loading

## Success Criteria

1. **Short-term memory**: Agent can save/recall session-specific data with 24h TTL
2. **Long-term memory**: Agent can persist important facts across sessions
3. **Semantic search**: Agent can find relevant past information via natural language
4. **Auto-loading**: Relevant memory automatically included in agent context
5. **Tool access**: All three memory tools available in agentic loop
6. **Performance**: Memory operations complete within 100ms
7. **Tests**: 90%+ test coverage for new code

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| FTS5 not available in D1 | Use LIKE fallback with trigram indexing |
| Memory bloat | Implement cleanup jobs, importance-based pruning |
| Slow memory loading | Lazy loading, pagination, relevance filtering |
| Service unavailability | Graceful degradation, cached fallbacks |

## Timeline

- Phase 1: 2-3 hours (Memory-MCP refactoring)
- Phase 2: 1-2 hours (Agentic loop tools)
- Phase 3: 1-2 hours (Agent integration)
- Phase 4: 1 hour (Testing & deployment)

**Total: ~6-8 hours**
