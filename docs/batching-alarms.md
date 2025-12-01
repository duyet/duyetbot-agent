---
title: Batching & Alarms
desc: Dual-batch prevents blocking. 500ms window collects msgs. 5s heartbeat rotations. 30s stuck → auto-recovery.
sidebar_position: 7
keywords: [batching, alarms, dual-batch, heartbeat, stuck-detection, recovery]
slug: /core-concepts/batching-alarms
---

<!-- i18n: en -->

# Batching & Alarms ✅

**TL;DR**: pendingBatch collects (non-blocking). 500ms alarm → activeBatch processes. 5s heartbeats. 30s no-beat → recover.

## Table of Contents
- [Dual-Batch](#dual-batch)
- [Timings](#timings)
- [Stuck Recovery](#stuck-recovery)
- [Flow](#flow)

## Dual-Batch

```mermaid
graph LR
  A[Webhook Msg] --> B[pendingBatch<br/>collecting]
  B --> C{500ms Alarm}
  C -->|Fire| D[activeBatch = pending<br/>pending = empty]
  D --> E[processBatch()]
  E --> F[5s Heartbeat Loop<br/>Edit "Thinking..."]
  F --> G[Response Ready<br/>Edit Final]
  H[New Msg] --> I{active stale?<br/>30s no heartbeat}
  I -->|Yes| J[Clear active<br/>pending → active]
```

## Timings

| Event | Delay | Purpose |
|-------|-------|---------|
| queueMessage | T+0ms | Webhook returns 200 |
| onBatchAlarm | 500ms | Batch msgs → 1 LLM |
| Heartbeat | 5s loop | Liveness + UX |
| Stuck Check | 30s | Auto-recovery |

**Webhook <6ms exit!** DO independent.

## Stuck Recovery

New msg checks: `now - lastHeartbeat > 30s` → Clear stuck → Process new.

## Code Snippet

From [`docs/architecture.md`](docs/architecture.md:349)
```
pendingBatch: collecting (always open)
activeBatch: processing (immutable)
Stuck? → pending promotes automatically
```

**Quiz**: Why dual-batch?  
A: pending never blocks new msgs ✅

**Related**: [Architecture →](../architecture.md) | [DOs →](./durable-objects.md)

**Deploy**: `bun run deploy:telegram` → Spam msgs → See batching!