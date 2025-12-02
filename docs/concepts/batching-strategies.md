---
title: Batching Strategies
description: Optimize window, trim history, cap maxMsgs. Reduce LLM calls 55%.
sidebar_position: 2
keywords: [batching, trim-history, window-opt]
slug: /advanced/scaling/batching-strategies
---

<!-- i18n: en -->

# Batching Strategies ✅

**TL;DR**: Set windowMs:500. Trim history to 10 msgs. Cap maxMessages:10. Recover stuck via heartbeats.

## Table of Contents
- [Config Table](#config-table)
- [Trim History](#trim-history)
- [Window Tuning](#window-tuning)
- [Decision Tree](#decision-tree)
- [Stuck Quiz](#stuck-quiz)

## Config Table

Tune [`batch-types.ts`](packages/chat-agent/src/batch-types.ts:76) defaults.

| Config       | Default | Fast UX | Max Savings | Impact |
|--------------|---------|---------|-------------|--------|
| windowMs     | 500     | 100     | 1000        | Latency vs batch size |
| maxWindowMs  | 5000    | 2000    | 10000       | Max collection time |
| maxMessages  | 10      | 5       | 20          | Prevent overload |

Test impacts: `bun test --filter batch`.

## Trim History

Keep recent messages. Use [`history.ts`](packages/chat-agent/src/history.ts:10).

```typescript
// packages/chat-agent/src/history.ts
export function trimHistory(messages: Message[], maxLength: number): Message[] {
  if (messages.length <= maxLength) {
    return messages;
  }
  return messages.slice(-maxLength);  // Keep last N
}
```

Call before LLM: `trimHistory(state.messages, 10)`.

## Window Tuning

Short window: Fast replies, less batching.

Long window: More savings, higher latency.

Imperative: Start with 500ms. Measure batch sizes in logs.

From [`batch-types.ts`](packages/chat-agent/src/batch-types.ts:165):

```typescript
// Check if ready to process
if (shouldProcessImmediately(state, config)) {
  // Promote pending → active
}
```

## Decision Tree

```
┌──────────┐
│ New Msg  │
└────┬─────┘
     │
     ▼
 ┌──────────────┐
 │ activeBatch? │
 └────┬──────┬──┘
      │      │
    Yes     No
      │      │
      ▼      ▼
 ┌──────────────┐  ┌──────────────┐
 │ Stuck 30s?   │  │ Start pending│
 └──┬────────┬──┘  │ Alarm 500ms  │
    │        │     └────────┬─────┘
   Yes      No            │
    │        │            ▼
    ▼        ▼      ┌──────────────┐
 ┌────────┐ ┌─────────────┐   │ onBatchAlarm:  │
 │ Clear  │ │ Add to      │   │ pending → active
 │ active │ │ pending     │   └────────┬─────┘
 └────────┘ └─────────────┘            │
                                       ▼
                                 ┌──────────────┐
                                 │ Process LLM  │
                                 └──────────────┘
```

Integrates [`batching-alarms.md`](/core-concepts/batching-alarms).

## Stuck Quiz

**Q**: Recover stuck batch when?

A: Heartbeat >30s stale ✅  
B: Always retry  
C: Manual only

## Related
- [DO Limits →](./do-limits.md)
- [Token Opt →](/advanced/performance/token-optimization.md)

Run `bun run deploy:telegram`. Send rapid msgs. Check logs for batch sizes!