---
title: Batch Routing ✅
desc: Queue pendingBatch 500ms → activeBatch alarms. Dedup, heartbeats, 30s stuck auto-recovery.
sidebar_position: 10
keywords: [batching, alarms, dual-batch, dedup, stuck-recovery]
slug: /guides/workflows/batch-routing
---

<!-- i18n: en -->

# Batch Routing ✅

**TL;DR**: pendingBatch collects (non-blocking). 500ms alarm fires → activeBatch processes. 5s heartbeats. 30s no-heartbeat → recover.

## Table of Contents
- [Dual-Batch Pattern](#dual-batch-pattern)
- [Key Timings](#key-timings)
- [Stuck Detection & Recovery](#stuck-detection--recovery)
- [Code Snippets](#code-snippets)
- [Try It Yourself](#try-it-yourself)

## Dual-Batch Pattern

Non-blocking webhook → pending (mutable). Alarm promotes → active (immutable).

```mermaid
graph LR
  A[Webhook Msg] --> B[pendingBatch<br/>collecting]
  B --> C{500ms Alarm}
  C -->|Fire| D[activeBatch = pending<br/>pending = empty]
  D --> E[processBatch()]
  E --> F[5s Heartbeat Loop<br/>Edit Thinking...]
  F --> G[Response Ready<br/>Edit Final]
  H[New Msg] --> I{active stale?<br/>30s no-heartbeat}
  I -->|Yes| J[Clear active<br/>pending → active]
```

## Key Timings

| Event | Delay | Purpose |
|-------|-------|---------|
| `queueMessage` | T+0ms | Webhook 200 OK |
| `onBatchAlarm` | 500ms | Batch → 1 LLM call |
| Heartbeat | 5s loop | UX liveness |
| Stuck Check | 30s | Auto-recovery |

## Stuck Detection & Recovery

New msg checks `now - lastHeartbeat > 30s` → Clear stuck active → Promote pending.

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
├── activeBatch exists? → YES → Check stuck (30s)
│   ├── Stuck → Clear + process pending ✅
│   └── Not stuck → Add to pending
└── NO → Create pendingBatch + alarm(500ms)
```

**Quiz**: Why dual-batch?
- A: pending never blocks webhook ✅

## Try It Yourself

1. `bun run deploy:telegram`
2. Spam 5 msgs fast
3. Watch "Thinking..." → batched response!

**Related**: [Batching Alarms](../core-concepts/batching-alarms.md) | [Architecture](../architecture.md)