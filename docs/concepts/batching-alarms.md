---
title: Batching & Alarms
description: Dual-batch prevents blocking. 500ms window collects msgs. 5s heartbeat rotations. 30s stuck → auto-recovery.
---

<!-- i18n: en -->

**TL;DR**: pendingBatch collects (non-blocking). 500ms alarm → activeBatch processes. 5s heartbeats. 30s no-beat → recover.

## Table of Contents
- [Dual-Batch](#dual-batch)
- [Timings](#timings)
- [Stuck Recovery](#stuck-recovery)
- [Flow](#flow)

## Dual-Batch

```
┌────────────────┐
│ Webhook Msg    │
└────────┬───────┘
         │
         ▼
┌──────────────────────┐
│ pendingBatch         │
│ collecting           │
└────────┬─────────────┘
         │
         ▼
┌────────────────────┐
│ 500ms Alarm?       │
└────┬────────────┬──┘
     │ Fire       │ No
     ▼            │ (stays pending)
┌──────────────────────┐
│ activeBatch =        │
│ pending              │
│ pending = empty      │
└────────┬─────────────┘
         │
         ▼
┌────────────────────┐
│ processBatch()     │
└────────┬───────────┘
         │
         ▼
┌──────────────────────┐
│ 5s Heartbeat Loop    │
│ Edit "Thinking..."   │
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│ Response Ready       │
│ Edit Final           │
└──────────────────────┘

┌──────────────────┐
│ New Msg          │
└──────┬───────────┘
       │
       ▼
┌────────────────────────┐
│ active stale?          │
│ 30s no heartbeat?      │
└───┬────────────────┬───┘
    │ Yes            │ No
    ▼                │
┌────────────────────────┐
│ Clear active           │
│ pending → active       │
└────────────────────────┘
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

From [`architecture.md`](/docs/architecture)
```
pendingBatch: collecting (always open)
activeBatch: processing (immutable)
Stuck? → pending promotes automatically
```

**Quiz**: Why dual-batch?  
A: pending never blocks new msgs ✅

**Related**: [Architecture →](../architecture.md) | [DOs →](./durable-objects.md)

**Deploy**: `bun run deploy:telegram` → Spam msgs → See batching!