---
title: Health Checks
desc: "GET /health, /live, /ready. K8s probes + full status (name/version/timestamp)."
sidebar_position: 2
keywords: [health,liveness,readiness,k8s,hono]
slug: /api-reference/hono-endpoints/health
---

<!-- i18n: en -->

# Health Checks

**TL;DR**: Standard probes. /health full info. Always 200 on healthy.

## Table of Contents
- [Endpoints](#endpoints)
- [Responses](#responses)
- [Integration](#integration)
- [Code](#code)

## Endpoints

| Method | Path | Purpose | K8s |
|--------|------|---------|-----|
| GET | /health | Full status | - |
| GET | /health/live | Liveness probe | ✅ |
| GET | /health/ready | Readiness probe | ✅ |

## Responses

**GET /health** [`routes/health.ts`](packages/hono-middleware/src/routes/health.ts:10)

```json
{
  "status": "ok",
  "name": "telegram-bot",
  "version": "1.0.0",
  "timestamp": "2025-12-01T15:30:00Z"
}
```

**/live, /ready**:

```json
{"status": "ok"}
```

## Errors

Always 200 on healthy. 500 → middleware error.

## Code

From [`hono-middleware`](packages/hono-middleware/src/routes/health.ts:6)

```typescript
routes.get('/health', (c) => c.json({
  status: 'ok',
  name,
  version,
  timestamp: new Date().toISOString(),
}));
```

**createBaseApp** auto-includes (`health: true`).

**Quiz**: /ready fail → ?
A: Pods not receive traffic ✅

## Integrate

```typescript
const app = createBaseApp({ name: 'my-app', health: true });
```

**Deploy**: `curl https://your-worker/health` → Verify!

**Related**: [Hono Middleware](../hono-middleware.md) | [Webhook ←](./webhook.md)