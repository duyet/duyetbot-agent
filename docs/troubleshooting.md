---
title: Troubleshooting
desc: Stuck batch? Auth fail? Decision trees for common Phase1 failures: alarms/heartbeats/auth middleware.
sidebar_position: 1
keywords: [troubleshoot, stuck, batch, auth, fail, alarm, heartbeat]
slug: community/troubleshooting
---

<!-- i18n: en -->

# Troubleshooting

**TL;DR**: Stuck? Check heartbeats/alarms. Auth 401? Verify tokens. Decision trees below. ✅ Recover fast.

## Table of Contents
- [Stuck Batch](#stuck-batch)
- [Auth Fail](#auth-fail)
- [Common Errors](#common-errors)

## Stuck Batch

From [`PLAN.md`](PLAN.md:322) batch/heartbeat:

```mermaid
flowchart TD
    A[No response >30s?] --> B{Heartbeat?}
    B -->|No| C[Watchdog clears]
    B -->|Yes| D[Processing]
    D --> E{Alarm fired?}
    E -->|No| F[Resend message]
    E -->|Yes| G[Wait response]
```

## Auth Fail

From [`auth.ts`](packages/hono-middleware/src/middleware/auth.ts:19):

```mermaid
flowchart TD
    A[401 Unauthorized?] --> B{Token valid?}
    B -->|No| C[Set env: TELEGRAM_BOT_TOKEN/GITHUB_TOKEN]
    B -->|Bearer?| D[AI_GATEWAY_API_KEY]
    C --> E[Deploy: bun run config]
    D --> E
```

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| Batch stuck | No heartbeat | Resend query |
| 401 Auth | Missing token | `bun scripts/config.ts` |
| Tests fail | Lint error | `bun run check` |
| Deploy fail | Wrangler login | `bunx wrangler login` |

**Quiz**: Stuck >30s?  
A: Watchdog recovers ✅

**Pro Tip** ✅: Logs in Cloudflare dashboard.

**CTA**: Share fix → [Feedback](feedback.md) | [Issues](https://github.com/duyet/duyetbot-agent/issues)

**Contrib**: "Fixed X via Y!"