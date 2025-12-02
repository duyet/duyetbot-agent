# @duyetbot/hono-middleware

Shared Hono middleware and routes for Cloudflare Workers apps.

## Overview

This package provides a standardized way to create Hono-based Cloudflare Workers apps with consistent middleware, health checks, and error handling.

## Installation

```bash
pnpm add @duyetbot/hono-middleware
```

## Quick Start

```typescript
import { createBaseApp } from '@duyetbot/hono-middleware';

interface Env {
  // Your environment bindings
}

const app = createBaseApp<Env>({
  name: 'my-worker',
  version: '1.0.0',
  logger: true,
  rateLimit: { limit: 100, window: 60000 },
  health: true,
});

// Add your routes
app.post('/webhook', async (c) => {
  // Handle webhook
  return c.json({ ok: true });
});

export default app;
```

## API Reference

### `createBaseApp<TEnv>(options: AppOptions): Hono<{ Bindings: TEnv }>`

Creates a Hono app with standard middleware and routes.

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `name` | `string` | **required** | App name (shown in health check) |
| `version` | `string` | `'1.0.0'` | App version |
| `logger` | `boolean` | `true` | Enable request logging |
| `rateLimit` | `{ limit: number; window: number }` | `undefined` | Rate limiting config |
| `health` | `boolean` | `true` | Include health check routes |

### Included Middleware

#### Logger Middleware

Logs all requests with:
- Unique request ID
- Method and path
- Response time
- Status code

```typescript
// Automatically included when logger: true
// Logs: {"id":"abc123","method":"POST","path":"/webhook","status":200,"duration":45}
```

#### Rate Limiter

In-memory rate limiting per IP address.

```typescript
createBaseApp<Env>({
  name: 'my-app',
  rateLimit: {
    limit: 100,    // Max requests
    window: 60000, // Time window in ms
  },
});
```

Returns `429 Too Many Requests` when limit exceeded.

#### Error Handler

Consistent error response format:

```json
{
  "error": "Internal Server Error",
  "message": "Something went wrong"
}
```

### Included Routes

#### Health Routes

When `health: true` (default):

| Route | Description | Response |
|-------|-------------|----------|
| `GET /health` | Full health check | `{ status: 'ok', name, version, timestamp }` |
| `GET /health/live` | Liveness probe | `{ status: 'ok' }` |
| `GET /health/ready` | Readiness probe | `{ status: 'ok' }` |

## Composable Usage

For more control, use individual components:

```typescript
import { Hono } from 'hono';
import {
  createLogger,
  createRateLimiter,
  errorHandler,
  healthRoutes,
} from '@duyetbot/hono-middleware';

const app = new Hono<{ Bindings: Env }>();

// Add error handler
app.onError(errorHandler);

// Add specific middleware
app.use('*', createLogger());
app.use('/api/*', createRateLimiter({ limit: 50, window: 60000 }));

// Add health routes with custom config
app.route('/', healthRoutes('my-app', '2.0.0'));

export default app;
```

## Individual Exports

### `createLogger(options?: LoggerOptions)`

Creates logger middleware.

```typescript
app.use('*', createLogger({
  format: 'json', // or 'text'
  includeHeaders: false,
}));
```

### `createRateLimiter(options: RateLimitOptions)`

Creates rate limiter middleware.

```typescript
app.use('*', createRateLimiter({
  limit: 100,
  window: 60000,
  keyGenerator: (c) => c.req.header('x-user-id') || c.env.CF?.clientTrustScore,
}));
```

### `createAuth(options: AuthOptions)`

Creates authentication middleware.

```typescript
app.use('/api/*', createAuth({
  type: 'bearer',
  validate: async (token, c) => {
    // Validate token
    return { userId: '123' };
  },
}));

// For GitHub webhook signature verification
app.use('/webhook', createAuth({
  type: 'github-webhook',
  secret: 'your-webhook-secret',
}));
```

### `errorHandler`

Global error handler.

```typescript
app.onError(errorHandler);
```

### `healthRoutes(name: string, version?: string)`

Creates health check routes.

```typescript
app.route('/', healthRoutes('my-app', '1.0.0'));
```

## Usage in Platform Apps

### Telegram Bot

```typescript
// apps/telegram-bot/src/index.ts
import { createBaseApp } from '@duyetbot/hono-middleware';
import type { Env } from './types.js';

const app = createBaseApp<Env>({
  name: 'telegram-bot',
  version: '1.0.0',
  logger: true,
  rateLimit: { limit: 100, window: 60000 },
  health: true,
});

app.post('/webhook', async (c) => {
  // Telegram webhook handling
  const update = await c.req.json();
  // Process update...
  return c.text('OK');
});

export default app;
```

### GitHub Bot

```typescript
// apps/github-bot/src/index.ts
import { createBaseApp, createAuth } from '@duyetbot/hono-middleware';
import type { Env } from './types.js';

const app = createBaseApp<Env>({
  name: 'github-bot',
  version: '1.0.0',
  logger: true,
  rateLimit: { limit: 50, window: 60000 },
  health: true,
});

// Add GitHub webhook signature verification
app.use('/webhook', createAuth({
  type: 'github-webhook',
  secret: (c) => c.env.GITHUB_WEBHOOK_SECRET,
}));

app.post('/webhook', async (c) => {
  // GitHub webhook handling
  const event = await c.req.json();
  // Process event...
  return c.text('OK');
});

export default app;
```

## Architecture Decision

### Why Separate Apps with Shared Middleware?

We chose **separate platform apps** (telegram-bot, github-bot) over a **unified API gateway** because:

| Factor | Unified Gateway | Separate Apps |
|--------|----------------|---------------|
| **Fault Isolation** | One bug affects all | Failures don't cascade |
| **Scaling** | Scale everything together | Scale independently |
| **Bundle Size** | Large (all platforms) | Small (one platform) |
| **Cold Start** | Slower | Faster |
| **Secrets** | All mixed together | Isolated per app |
| **Deployment** | All or nothing | Independent deploys |

The shared middleware package provides the benefits of code reuse without the drawbacks of a monolithic gateway.

### Cloudflare Workers Considerations

- **Billing**: Per-request pricing favors smaller, focused workers
- **Cold starts**: Smaller bundles = faster response times
- **Limits**: Each worker has its own CPU/memory limits

## Development

### Testing

```typescript
import { describe, it, expect } from 'vitest';
import { createBaseApp } from '@duyetbot/hono-middleware';

describe('health routes', () => {
  it('returns ok status', async () => {
    const app = createBaseApp({ name: 'test-app', health: true });

    const res = await app.request('/health');
    const json = await res.json();

    expect(json.status).toBe('ok');
    expect(json.name).toBe('test-app');
  });
});
```

### Local Development

```bash
# Build the package
cd packages/hono-middleware
pnpm build

# Run tests
pnpm test

# Type check
pnpm type-check
```

## Migration Guide

### From Custom Middleware

Before:
```typescript
// apps/telegram-bot/src/index.ts
const app = new Hono();

app.use('*', async (c, next) => {
  const start = Date.now();
  await next();
  console.log(`${c.req.method} ${c.req.path} ${Date.now() - start}ms`);
});

app.get('/health', (c) => c.json({ status: 'ok' }));
```

After:
```typescript
import { createBaseApp } from '@duyetbot/hono-middleware';

const app = createBaseApp({
  name: 'telegram-bot',
  logger: true,
  health: true,
});
```

### From apps/api

The `apps/api` package is deprecated. Migrate to:

1. Use `@duyetbot/hono-middleware` for shared middleware
2. Keep platform-specific logic in respective apps
3. Remove `apps/api` from the monorepo

## Package Structure

```
packages/hono-middleware/
├── src/
│   ├── index.ts              # Main exports
│   ├── factory.ts            # createBaseApp()
│   ├── middleware/
│   │   ├── index.ts
│   │   ├── logger.ts
│   │   ├── rate-limit.ts
│   │   ├── auth.ts
│   │   └── error-handler.ts
│   ├── routes/
│   │   ├── index.ts
│   │   └── health.ts
│   └── types.ts
├── __tests__/
│   ├── factory.test.ts
│   ├── logger.test.ts
│   ├── rate-limit.test.ts
│   └── health.test.ts
├── package.json
├── tsconfig.json
└── README.md
```

## Dependencies

- `hono` - Web framework
- `@duyetbot/types` (peer) - Shared types
