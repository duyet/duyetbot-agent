---
title: Cloudflare Deployment
description: Deploy duyetbot-agent locally or via Cloudflare Builds CI/CD. Complete guide for monorepo deployment.
---

# Cloudflare Deployment

Two deployment methods: local (manual) and Cloudflare Builds (CI/CD on push).

## Local Deploy

Deploy from your machine with full turbo orchestration. Requires `CLOUDFLARE_API_TOKEN` via `wrangler login`.

### Prerequisites

```bash
bun install
bunx wrangler login
```

### Commands

```bash
# Deploy all bots + agents + memory
bun run deploy

# Deploy specific apps
bun run deploy:telegram       # Telegram bot (deploys shared-agents first)
bun run deploy:github         # GitHub bot (deploys shared-agents first)
bun run deploy:shared-agents  # 8 shared Durable Objects
bun run deploy:memory-mcp     # D1 memory service
bun run deploy:docs           # Documentation site
```

### Dependency Chain

Local deploy uses turbo's dependency chain automatically:

```
@duyetbot/shared-agents#deploy  ← deploys first
         ↓
@duyetbot/telegram-bot#deploy   ← waits for shared-agents
@duyetbot/github-bot#deploy     ← waits for shared-agents
```

### Build Only (No Deploy)

```bash
bun run build:telegram    # Build dependencies + app
bun run check             # Lint + type-check before deploy
```

### Secrets Configuration

```bash
# Auto-configure secrets
bun run config:telegram
bun run config:github
bun run config:shared-agents

# Or manually
cd apps/telegram-bot
bunx wrangler secret put TELEGRAM_BOT_TOKEN
bunx wrangler secret put OPENROUTER_API_KEY
```

---

## Cloudflare Builds (CI/CD)

Auto-deploy on git push. Each Worker is configured independently in Cloudflare dashboard.

### Dashboard Configuration

Configure each Worker in [Cloudflare Dashboard](https://dash.cloudflare.com) → Workers & Pages → Settings → Builds:

| Worker | Root Directory | Build Command | Deploy Command |
|--------|----------------|---------------|----------------|
| `duyetbot-shared-agents` | `apps/shared-agents` | `cd ../.. && bun install && turbo run build --filter=@duyetbot/shared-agents...` | `npx wrangler deploy` |
| `duyetbot-telegram` | `apps/telegram-bot` | `cd ../.. && bun install && turbo run build --filter=@duyetbot/telegram-bot...` | `npx wrangler deploy` |
| `duyetbot-github` | `apps/github-bot` | `cd ../.. && bun install && turbo run build --filter=@duyetbot/github-bot...` | `npx wrangler deploy` |
| `duyetbot-memory` | `apps/memory-mcp` | `cd ../.. && bun install && turbo run build --filter=@duyetbot/memory-mcp...` | `npx wrangler deploy` |
| `duyetbot-safety-kernel` | `apps/safety-kernel` | `cd ../.. && bun install && turbo run build --filter=@duyetbot/safety-kernel...` | `npx wrangler deploy` |
| `duyetbot-docs` | `apps/docs` | `cd ../.. && bun install && turbo run build --filter=@duyetbot/docs` | `npx wrangler pages deploy out --project-name=duyetbot-docs` |

### Step-by-Step Setup

1. Go to Cloudflare Dashboard → Workers & Pages
2. Select your Worker (e.g., `duyetbot-telegram`)
3. Go to **Settings** → **Builds**
4. Connect your GitHub repository
5. Set **Root directory** to the app folder
6. Set **Build command** (copies from table above)
7. Set **Deploy command**: `npx wrangler deploy`

### Deployment Order

Deploy `duyetbot-shared-agents` FIRST before other bots (cross-worker DO references):

```
1. duyetbot-shared-agents  ← MUST deploy first
2. duyetbot-telegram       ← References shared-agents DOs
3. duyetbot-github         ← References shared-agents DOs
4. duyetbot-memory         ← Independent
5. duyetbot-safety-kernel  ← Independent
6. duyetbot-docs           ← Independent (Pages)
```

### Build Watch Paths (Optional)

Optimize builds by only triggering on relevant changes:

| Worker | Watch Paths |
|--------|-------------|
| `duyetbot-shared-agents` | `apps/shared-agents/**`, `packages/**` |
| `duyetbot-telegram` | `apps/telegram-bot/**`, `apps/shared-agents/**`, `packages/**` |
| `duyetbot-github` | `apps/github-bot/**`, `apps/shared-agents/**`, `packages/**` |

### Copy-Paste Commands

**Shared Agents:**
```
Root: apps/shared-agents
Build: cd ../.. && bun install && turbo run build --filter=@duyetbot/shared-agents...
Deploy: npx wrangler deploy
```

**Telegram Bot:**
```
Root: apps/telegram-bot
Build: cd ../.. && bun install && turbo run build --filter=@duyetbot/telegram-bot...
Deploy: npx wrangler deploy
```

**GitHub Bot:**
```
Root: apps/github-bot
Build: cd ../.. && bun install && turbo run build --filter=@duyetbot/github-bot...
Deploy: npx wrangler deploy
```

---

## Monitoring & Rollback

```bash
# Tail logs
bunx wrangler tail --format pretty

# Filter errors
bunx wrangler tail --filter error

# List deployments
bunx wrangler deployments list

# Rollback to previous
bunx wrangler rollback [DEPLOYMENT_ID]
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `CLOUDFLARE_API_TOKEN required` | Build command should not run `wrangler deploy` |
| Cross-worker DO not found | Deploy `shared-agents` first |
| Package deps not built | Use `--filter=@duyetbot/app...` (with `...` suffix) |
| Secrets not loading | `bunx wrangler secret list` then re-set |
| Deployment fails | Run `bun run check` then retry |

## Related

- [Deployment Overview](/guides/deployment)
- [Cloudflare Workers Builds Docs](https://developers.cloudflare.com/workers/ci-cd/builds/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
