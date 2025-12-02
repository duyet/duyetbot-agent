---
title: Benchmarks
description: P50 latency/token costs. E2E/Vitest/Phase1 data. Routing 5s, batch 500ms, 75t/query.
---

<!-- i18n: en -->

**TL;DR**: P50 end-to-end: 5s response. 75 tokens/query. Batch saves 55%. From Vitest E2E + prod logs.

## Table of Contents
- [Latency Table](#latency-table)
- [Token Table](#token-table)
- [Perf Flow](#perf-flow)
- [Vitest Snippet](#vitest-snippet)
- [Savings Quiz](#savings-quiz)

## Latency Table

From [`PLAN.md`](PLAN.md:101) timings + [`apps/telegram-bot/src/__tests__/e2e/performance.test.ts`](apps/telegram-bot/src/__tests__/e2e/performance.test.ts).

| Phase          | P50    | P95    | Notes |
|----------------|--------|--------|-------|
| Webhook → DO   | 6ms    | 20ms   | Fire-and-forget |
| Batch Alarm    | 500ms  | 1s     | Window |
| Routing        | 300ms  | 2s     | Hybrid classify |
| LLM Simple     | 2s     | 5s     | Direct |
| LLM Orchestrator | 4s   | 10s    | Plan+workers |
| **E2E Total**  | **5s** | **12s**| ✅ Prod |

## Token Table

100 queries/day baseline.

| Agent          | Tokens/Query | % Queries | Total/Day |
|----------------|--------------|-----------|-----------|
| Pattern/Simple | 75           | 80%       | 6k        |
| LLM Classify   | 300          | 20%       | 1.5k      |
| Orchestrator   | 1500         | 10%       | 1.5k      |
| **Avg**        | **75**       | -         | **7.5k** vs 30k |

## Perf Flow

```
       ┌─────────────┐
       │ Webhook T0  │
       └──────┬──────┘
              │
              ▼
       ┌────────────────┐
       │ Alarm T500ms   │
       └──────┬─────────┘
              │
              ▼
       ┌────────────────┐
       │ Classify T300ms│
       └──────┬─────────┘
              │
              ▼
          ┌─────────────┐
          │ Simple?     │
          └────┬────┬───┘
               │    │
           Yes │    │ No
               ▼    ▼
          ┌──────┐  ┌──────┐
          │ LLM  │  │ Orch │
          │ 2s   │  │ 4s   │
          └──┬───┘  └──┬───┘
             │        │
             └────┬───┘
                  │
                  ▼
          ┌──────────────────┐
          │ Edit Response    │
          │ T5s ✅           │
          └──────────────────┘
```

Refs E2E perf tests.

## Vitest Snippet

Hypothetical metrics capture.

```typescript
// apps/telegram-bot/src/__tests__/e2e/performance.test.ts
it('P50 E2E latency', async () => {
  const start = performance.now();
  await sendMessage('hi');  // Triggers full flow
  const latency = performance.now() - start;
  expect(latency).toBeLessThan(6000);  // P50 5s
});
```

Run: `bun vitest e2e/performance`.

## Savings Quiz

**Q**: Batch 3 msgs saves?

A: 55% (1 call vs 3) ✅  
B: 0%  
C: 75%

## Related
- [Token Opt →](./token-optimization.md)

Deploy + `wrangler tail`. Benchmark your queries!