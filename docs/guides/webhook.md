---
title: Webhook Endpoint
desc: "POST /webhook - GitHub/Telegram events. HMAC sig auth, raw body parse. Returns 200 OK fast."
sidebar_position: 1
keywords: [webhook,hono,github,telegram,signature]
slug: /api-reference/hono-endpoints/webhook
---

<!-- i18n: en -->

# Webhook Endpoint

**TL;DR**: POST /webhook handles platform events. Verify sig → parse → queue. Always 200 <6ms.

## Table of Contents
- [Request](#request)
- [Headers](#headers)
- [Responses](#responses)
- [Errors](#errors)
- [Code Snippets](#code-snippets)

## Request

```http
POST /webhook
Content-Type: application/json
```

**Body**: Platform payload (GitHub event/Telegram update).

## Headers

| Header | Required | Desc | Example |
|--------|----------|------|---------|
| `X-Hub-Signature-256` | GitHub | HMAC-SHA256 sig | `sha256=6931...` |
| `X-GitHub-Event` | GitHub | Event type | `issue_comment` |
| `X-Telegram-Bot-Api-Secret-Token` | Telegram | Bot token | `12345:ABC...` |

## Responses

| Status | Body | Meaning |
|--------|------|---------|
| 200 | `"OK"` | Accepted |
| 401 | `{error: "Invalid signature"}` | Auth fail |

## Errors

| Code | Status | Desc |
|------|--------|-------------|
| INVALID_SIG | 401 | HMAC mismatch |
| MISSING_SIG | 401 | No sig header |
| AUTH_001 | 403 | Telegram user not allowed |

From [`signature.ts`](apps/github-bot/src/middlewares/signature.ts:40)

```typescript
export function verifySignature(payload: string, signature: string, secret: string): boolean {
  const hmac = createHmac('sha256', secret);
  const digest = `sha256=${hmac.update(payload).digest('hex')}`;
  return timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}
```

Telegram auth [`auth.ts`](apps/telegram-bot/src/middlewares/auth.ts:46)

```typescript
if (!isUserAuthorized(env, userId)) {
  c.set('unauthorized', true);
}
```

**Quiz**: Sig fail → ?
A: 401 + log warn ✅

## Integrate

```typescript
app.post('/webhook', signatureMiddleware, parser, auth, agentHandler);
```

**Deploy**: `bun run deploy:github` → GitHub webhook → Test sig!

**Related**: [Deployment](../deployment/github-bot.md) | [Health →](./health.md)