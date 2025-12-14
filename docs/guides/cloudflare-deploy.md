---
title: Cloudflare Deploy
description: Deploy agents to Cloudflare Workers. Local commands with dependencies, CI commands for Cloudflare Dashboard.
---

# Cloudflare Deploy

Deploy edge AI agents to Cloudflare Workers + Durable Objects. Fire-and-forget global deployment.

## Quick Reference

| Scenario | Command | Includes Dependencies |
|----------|---------|----------------------|
| Local development | `bun run deploy:telegram` | Yes (deploys dependencies) |
| Cloudflare Dashboard CI | `bun run ci:deploy:telegram` | No (single app only) |

## Deployment Models

| Type | Runtime | Best For | Guide |
|------|---------|----------|-------|
| **Cloudflare Agent** | Workers + DO | Webhooks, serverless, global edge | [Telegram Bot](#telegram-bot), [GitHub Bot](#github-bot) |
| **Claude Code Agent** | VM, Docker | Long sessions, code execution | [Claude Code Agent](#claude-code-agent) |

## Local Deployment

Local commands include dependencies via Turbo:

```bash
bun run deploy              # All apps
bun run deploy:telegram     # Telegram bot + dependencies
bun run deploy:github       # GitHub bot + dependencies
```

**Live in 60s!** Global edge network.

## CI Deployment (Single App)

For Cloudflare Workers Dashboard, use CI commands that deploy single apps:

```bash
bun run ci:deploy:telegram       # Deploy telegram only
bun run ci:deploy:github         # Deploy github only
```

## Cloudflare Workers Dashboard Setup

Configure build commands in Cloudflare Dashboard → Workers & Pages → Your Worker → Settings → Builds.

### Build Configuration

**telegram-bot:**
- Build command: `bun run ci:build:telegram`
- Deploy command: `bun run ci:deploy:telegram`
- Branch deploy: `bun run ci:deploy-version:telegram`

**github-bot:**
- Build command: `bun run ci:build:github`
- Deploy command: `bun run ci:deploy:github`
- Branch deploy: `bun run ci:deploy-version:github`

## Prerequisites

- [ ] Env setup: [Env Setup](/getting-started/env-setup)
- [ ] `bun install`
- [ ] `bunx wrangler login`
- [ ] Secrets configured: `bun scripts/config.ts <app>`

## Deploy Flow

1. **Build**: `bun run build` (turbo)
2. **Secrets**: `bun scripts/config.ts <app>`
3. **Deploy**: `bun run deploy:<app>` or `bun run ci:deploy:<app>`
4. **Verify**: Check Cloudflare dashboard

## Secrets Configuration

### Via Script (Recommended)

```bash
bun run config              # Configure all apps
bun run config:telegram     # Telegram secrets
bun run config:github       # GitHub secrets
```

### Manual Secret Setup

**Telegram Bot:**
```bash
cd apps/telegram-bot
bunx wrangler secret put TELEGRAM_BOT_TOKEN
bunx wrangler secret put OPENROUTER_API_KEY
```

**GitHub Bot:**
```bash
cd apps/github-bot
bunx wrangler secret put GITHUB_TOKEN
bunx wrangler secret put GITHUB_WEBHOOK_SECRET
bunx wrangler secret put OPENROUTER_API_KEY
```


## Monitoring

```bash
# Stream live logs
npx wrangler tail --name duyetbot-telegram
npx wrangler tail --name duyetbot-github

# Filter for errors
npx wrangler tail --filter error

# List deployments
npx wrangler deployments list
```

## Rollback

```bash
# List deployments
npx wrangler deployments list

# Rollback to previous
npx wrangler rollback [DEPLOYMENT_ID]
```

## Durable Objects

Each bot deploys a single Durable Object implementing [Cloudflare Agent Patterns](https://developers.cloudflare.com/agents/patterns/):

- CloudflareChatAgent (loop-based agent with tool iterations)
- Built-in tools: bash, git, github, research, plan
- MCP integration: duyet-mcp, github-mcp

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Secrets not loading | `bunx wrangler secret list` then re-set |
| DO timeout | Check logs, delete stuck instance if needed |
| High latency | Check AI Gateway, review token usage |
| Deployment fails | `bun run check` then retry |

## Platform Comparison

| Platform | Difficulty | Cost | Best For |
|----------|------------|------|----------|
| Cloudflare Agents | Easy | Free-$5/mo | Stateful agents, global edge |
| Railway | Easy | $5/mo | Beginners, quick setup |
| Fly.io | Easy | Free-$5/mo | Free tier, good defaults |
| Render | Easy | Free-$7/mo | Simple Docker deploys |
| AWS ECS/Fargate | Advanced | $10-15/mo | Full control, enterprise |
| Docker Compose | Medium | VPS cost | Self-hosted |

## Next Steps

- [Telegram Bot Setup](#telegram-bot) - Telegram bot configuration
- [GitHub Bot Setup](#github-bot) - GitHub bot configuration
- [Getting Started](/getting-started/checklists) - Deployment checklists
- [External Docs](https://developers.cloudflare.com/workers/) - Cloudflare Workers documentation
