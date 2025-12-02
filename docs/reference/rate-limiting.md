---
title: Rate Limiting
description: Middleware config. IP-based in-memory limits. Headers + 429 responses.
sidebar_position: 2
keywords: [rate-limit, middleware, quotas]
slug: /advanced/security/rate-limiting
---

<!-- i18n: en -->

# Rate Limiting ✅

**TL;DR**: Use `createRateLimiter({limit:100, window:60000})`. IP-keyed. In-memory store. Upgrade D1/KV for prod.

## Table of Contents
- [Config Table](#config-table)
- [How It Works](#how-it-works)
- [Headers](#headers)
- [Caveats](#caveats)
- [Reset Quiz](#reset-quiz)

## Config Table

Tune limits per route.

| Param     | Default | Example     | Purpose |
|-----------|---------|-------------|---------|
| limit     | -       | 100         | Requests/window |
| window    | -       | 60000ms     | Sliding window |
| keyGen    | IP      | custom(c)   | Identifier |

From [`packages/hono-middleware/src/middleware/rate-limit.ts`](packages/hono-middleware/src/middleware/rate-limit.ts:42).

## How It Works

In-memory Map. Resets on window expiry.

```typescript
// packages/hono-middleware/src/middleware/rate-limit.ts
const store = new Map();  // key → {count, resetAt}

const key = keyGenerator(c);  // cf-connecting-ip
entry.count++;
if (entry.count > limit) 429;
```

Imperative: Set headers always.

## Headers

Standard rate limit headers.

| Header              | Value Example |
|---------------------|---------------|
| X-RateLimit-Limit   | 100           |
| X-RateLimit-Remaining | 99         |
| X-RateLimit-Reset   | 1738280000    |

## Caveats

In-memory only. Worker restart resets.

**Upgrade paths**:
- Durable Objects: Per-session limits
- KV/D1: Persistent counters

Test: `bun test --filter rate-limit`.

## Reset Quiz

**Q**: Entry expires when?

A: now > resetAt ✅  
B: count > limit  
C: Manual clear

## Related
- [Auth Middleware →](./auth-middleware.md)

Run `clearRateLimitStore()` in tests. Spam requests. See 429!