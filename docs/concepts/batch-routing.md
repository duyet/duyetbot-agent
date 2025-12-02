---
title: Batch Routing ✅
description: Queue pendingBatch 500ms -> activeBatch alarms. Dedup, heartbeats, 30s stuck auto-recovery.
---

<!-- i18n: en -->

**TL;DR**: pendingBatch collects (non-blocking). 500ms alarm fires -> activeBatch processes. 5s heartbeats. 30s no-heartbeat -> recover.

## Table of Contents
- [Dual-Batch Pattern](#dual-batch-pattern)
- [Key Timings](#key-timings)
- [Stuck Detection & Recovery](#stuck-detection--recovery)
- [Code Snippets](#code-snippets)
- [Try It Yourself](#try-it-yourself)

## Dual-Batch Pattern

Non-blocking webhook -> pending (mutable). Alarm promotes -> active (immutable).

```
Webhook Msg               New Msg
    |                       |
    v                       v
pendingBatch          Check: active stale?
(collecting)          (30s no-heartbeat)
    |                       |
    v                   +----+------+
500ms Alarm?            |           |
    |                YES |           |NO
    v                   v           |
Fire!              Clear active     |
    |              pending->active   |
    v                   |           |
activeBatch=            +----+------+
pending               Add to pending
pending=empty              |
    |                      |
    v◄---------------------+
processBatch()
    |
    v
5s Heartbeat Loop
(Edit Thinking...)
    |
    v
Response Ready
(Edit Final)
```

## Key Timings

| Event | Delay | Purpose |
|-------|-------|---------|
| `queueMessage` | T+0ms | Webhook 200 OK |
| `onBatchAlarm` | 500ms | Batch -> 1 LLM call |
| Heartbeat | 5s loop | UX liveness |
| Stuck Check | 30s | Auto-recovery |

## Stuck Detection & Recovery

New msg checks `now - lastHeartbeat > 30s` -> Clear stuck active -> Promote pending.

**Error**: `BatchStuckError` (handled silently).

## Code Snippets

State from [`cloudflare-agent.ts`](packages/chat-agent/src/cloudflare-agent.ts:56)

```typescript
interface CloudflareAgentState {
  activeBatch?: BatchState;  // processing (IMMUTABLE)
  pendingBatch?: BatchState; // collecting (MUTABLE)
  processedRequestIds?: string[]; // dedup
}
```

Batch types [`batch-types.ts`](packages/chat-agent/src/batch-types.ts:17)

```typescript
type BatchStatus = 'idle' | 'collecting' | 'processing' | 'completed' | 'failed';
```

**Decision Tree**:
```
New msg?
+-- activeBatch exists? -> YES -> Check stuck (30s)
|   +-- Stuck -> Clear + process pending ✅
|   +-- Not stuck -> Add to pending
+-- NO -> Create pendingBatch + alarm(500ms)
```

**Quiz**: Why dual-batch?
- A: pending never blocks webhook ✅

## Try It Yourself

1. `bun run deploy:telegram`
2. Spam 5 msgs fast
3. Watch "Thinking..." -> batched response!

**Related**: [Batching Alarms](../core-concepts/batching-alarms.md) | [Architecture](../architecture.md)