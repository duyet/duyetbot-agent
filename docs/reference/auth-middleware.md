---
title: Auth Middleware
description: Bearer, API-key, GitHub sig flows. Secure Hono routes with validation.
---

<!-- i18n: en -->

**TL;DR**: Use `createAuth({type: 'bearer' | 'api-key'})`. Validate tokens. Return 401 on fail. GitHub sigs app-specific.

## Table of Contents
- [Auth Flows](#auth-flows)
- [Error Codes](#error-codes)
- [Hono Usage](#hono-usage)
- [GitHub Sigs](#github-sigs)
- [Mismatch Quiz](#mismatch-quiz)

## Auth Flows

Secure routes. Choose bearer or api-key.

From [`packages/hono-middleware/src/middleware/auth.ts`](packages/hono-middleware/src/middleware/auth.ts:4):

| Type     | Header              | Validate? | Flow |
|----------|---------------------|-----------|------|
| bearer   | Authorization: Bearer <token> | Optional | Extract token. Call validate(token). Set c.set('user') |
| api-key  | x-api-key: <key> (custom) | Optional | Extract key. Call validate(key). Set c.set('user') |

Imperative: Always validate in prod.

## Error Codes

Standard 401 responses.

| Scenario       | Response                          |
|----------------|-----------------------------------|
| No header      | {error: 'Unauthorized', message: 'Missing bearer token'} |
| Invalid token  | {error: 'Unauthorized', message: 'Invalid token'} |
| No api-key     | {error: 'Unauthorized', message: 'Missing API key'} |

## Hono Usage

Protect routes easily.

```typescript
// Example Hono app
import { createAuth } from '@duyetbot/hono-middleware';

const auth = createAuth({
  type: 'bearer',
  validate: async (token, c) => {
    // Your validation logic
    return { id: 'user123' }; // Or null
  }
});

app.use('/secure/*', auth);
app.get('/secure/data', (c) => {
  const user = c.get('user');
  return c.json({ data: 'secret', user });
});
```

Test: `curl -H "Authorization: Bearer invalid" http://localhost/secure/data`.

## GitHub Sigs

App-specific. See [`apps/github-bot/src/middlewares/signature.ts`](apps/github-bot/src/middlewares/signature.ts).

Verifies webhook payload HMAC. Rejects tampered requests.

Imperative: Enable for all webhook routes.

## Mismatch Quiz

**Q**: Bearer header wrong?

A: Slice(7), check startsWith('Bearer ') -> 401 ✅  
B: Accept anyway  
C: Use api-key fallback

## Related
- [Rate Limiting ->](./rate-limiting.md)
- [Hono Middleware ->](/docs/reference/hono-middleware)

Run `bun test --filter auth`. Verify 401 responses!