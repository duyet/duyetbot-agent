# Memory MCP Integration Design

## Problem Statement

The current REST-based memory adapter causes `blockConcurrencyWhile` timeouts (30 seconds) when used with Cloudflare Durable Objects. This prevents conversation persistence in the Telegram and GitHub bots.

## Root Cause Analysis

### Cloudflare Durable Object Constraints

The Cloudflare Agents SDK uses `blockConcurrencyWhile` in the `Agent` constructor:

```javascript
void this.ctx.blockConcurrencyWhile(async () => {
  return this._tryCatch(async () => {
    this.sql`CREATE TABLE IF NOT EXISTS cf_agents_schedules (...)`;
    await this.alarm();
  });
});
```

**Key Constraints:**
- `blockConcurrencyWhile` has a **hard 30-second timeout**
- If exceeded, the Durable Object is **reset and the call is canceled**
- WebSocket operations inside `blockConcurrencyWhile` are **not supported**

### Why Memory Causes Timeout

The `ResilientMCPMemoryAdapter.checkAvailability()` makes network calls to the memory server:

```typescript
const response = await fetch(`${this.baseURL}/api/sessions/list`, {
  method: 'POST',
  // ...
});
```

When the memory MCP server is cold or slow, this blocks initialization.

## Architecture Solution

### Service Binding Pattern

Replace external REST calls with Cloudflare Service Bindings for sub-millisecond latency:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Telegram Bot Worker                               │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │           TelegramAgent (Durable Object)                    │    │
│  │  ┌─────────────────┐  ┌───────────────────────────┐        │    │
│  │  │  DO SQLite      │  │  LazyMemoryAdapter        │        │    │
│  │  │  (Fast Local)   │  │  (Non-blocking init)      │        │    │
│  │  │  - messages     │  │  - Deferred loading       │        │    │
│  │  │  - metadata     │  │  - Background sync        │        │    │
│  │  └────────┬────────┘  └──────────┬────────────────┘        │    │
│  │           │                      │                          │    │
│  │           │ Primary R/W          │ Async persist            │    │
│  │           ▼                      ▼                          │    │
│  │  ┌─────────────────────────────────────────────────────┐   │    │
│  │  │  MemorySyncManager (waitUntil)                      │   │    │
│  │  │  - Write-behind queue                               │   │    │
│  │  │  - Batch operations                                 │   │    │
│  │  └────────────────────────┬────────────────────────────┘   │    │
│  └───────────────────────────┼─────────────────────────────────┘    │
│                              │                                       │
│                              │ Service Binding (RPC)                 │
│                              ▼                                       │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │              Memory Worker (Same Account)                     │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │  │
│  │  │  D1 Database │  │  KV Cache   │  │  Vectorize  │           │  │
│  │  │  (Persistent) │  │  (Hot data) │  │  (Search)   │           │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘           │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Design Principles

1. **Non-blocking initialization** - NO network calls during DO construction
2. **Lazy loading** - Load memory data only when needed
3. **Write-behind pattern** - Queue saves for background execution via `waitUntil`
4. **Graceful degradation** - Bot works even if memory is unavailable

## Implementation Components

### 1. LazyMemoryAdapter

```typescript
export class LazyMemoryAdapter implements MemoryAdapter {
  private pendingOps: Array<() => Promise<void>> = [];

  constructor(private config: LazyMemoryConfig) {
    // NO initialization here - completely non-blocking
  }

  async getMemory(sessionId: string): Promise<MemoryData> {
    // Return empty on first call, schedule background fetch
    if (!this.initialized) {
      return { sessionId, messages: [], metadata: {} };
    }
    return this.serviceBinding.getMemory(sessionId);
  }

  async saveMemory(sessionId: string, messages: Message[]): Promise<SaveMemoryResult> {
    // Queue for background execution
    this.pendingOps.push(() => this.serviceBinding.saveMemory(sessionId, messages));
    return { sessionId, savedCount: messages.length, updatedAt: Date.now() };
  }

  async flush(): Promise<void> {
    const ops = this.pendingOps.splice(0);
    await Promise.allSettled(ops.map(op => op()));
  }
}
```

### 2. Service Binding Configuration

```toml
# apps/telegram-bot/wrangler.toml
[[services]]
binding = "MEMORY_SERVICE"
service = "duyetbot-memory"
```

### 3. Memory Service Interface

```typescript
export interface MemoryServiceBinding {
  getMemory(sessionId: string, options?: { limit?: number; offset?: number }): Promise<MemoryData>;
  saveMemory(sessionId: string, messages: Message[], metadata?: Record<string, unknown>): Promise<SaveMemoryResult>;
  searchMemory(query: string, options?: { limit?: number; sessionId?: string }): Promise<MemorySearchResult[]>;
}
```

### 4. Updated CloudflareAgentConfig

```typescript
export interface CloudflareAgentConfig<TEnv> {
  // ... existing fields

  /** Memory service binding (preferred over REST) */
  memoryService?: (env: TEnv) => MemoryServiceBinding | undefined;
}
```

## Migration Plan

### Phase 1: Infrastructure (Day 1)
- Add service binding to Telegram bot's wrangler.toml
- Export RPC interface from memory MCP worker
- Create TypeScript types for service binding

### Phase 2: Lazy Memory Adapter (Day 2)
- Implement `LazyMemoryAdapter` class
- Create `MemorySyncManager` for background operations
- Add tests for non-blocking behavior

### Phase 3: Update CloudflareChatAgent (Day 3)
- Add `memoryService` config option
- Implement service binding in `_ensureInitialized()`
- Add `flush()` call in background via `waitUntil`

### Phase 4: Update Bots (Day 4)
- Update Telegram bot to use service binding
- Update GitHub bot to use service binding
- Re-enable memory (`disableMemory: false`)

### Phase 5: Add Caching (Day 5)
- Add KV namespace to memory worker
- Implement `CachedD1Storage`
- 5-minute TTL with write-through invalidation

### Phase 6: Testing (Day 6)
- Unit tests for LazyMemoryAdapter
- Integration tests with Miniflare
- Load testing with concurrent sessions

## Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| DO initialization | <50ms | >30s (timeout) |
| Memory read latency | <100ms | N/A (disabled) |
| Memory write latency | <200ms | N/A (disabled) |
| Cache hit rate | >80% | N/A |

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Service binding unavailable | Graceful fallback to REST or disabled |
| Message loss during async save | Persist to DO storage first, sync async |
| KV cache staleness | Short TTL, invalidate on write |
| D1 rate limiting | Batch operations, exponential backoff |

## Alternative Approaches Considered

### 1. Direct D1 Binding
- **Pros**: No network calls, fast
- **Cons**: Requires D1 binding in each worker, complex migrations

### 2. Skip Availability Check
- **Pros**: Minimal code change
- **Cons**: Doesn't solve cold start latency

### 3. WebSocket MCP Transport
- **Pros**: True MCP protocol
- **Cons**: WebSocket not supported in `blockConcurrencyWhile`

## References

- [Durable Object State API](https://developers.cloudflare.com/durable-objects/api/state/)
- [Durable Objects Limits](https://developers.cloudflare.com/durable-objects/platform/limits/)
- [Service Bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/)
- [workerd WebSocket issue #1088](https://github.com/cloudflare/workerd/issues/1088)
