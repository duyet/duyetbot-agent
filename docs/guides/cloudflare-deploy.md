---
title: Cloudflare Deploy
description: Deploy agents to Cloudflare Workers. Local commands with dependencies, CI commands for Cloudflare Dashboard.
---

# Cloudflare Deploy

Deploy edge AI agents to Cloudflare Workers + Durable Objects. Fire-and-forget global deployment.

## Quick Reference

| Scenario | Command | Includes Dependencies |
|----------|---------|----------------------|
| Local development | `bun run deploy:telegram` | Yes (deploys shared-agents too) |
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
bun run deploy:telegram     # Telegram + shared-agents
bun run deploy:github       # GitHub + shared-agents
bun run deploy:shared-agents # Shared agents only
bun run deploy:memory-mcp   # Memory MCP server
```

**Live in 60s!** Global edge network.

## CI Deployment (Single App)

For Cloudflare Workers Dashboard, use CI commands that deploy single apps:

```bash
bun run ci:deploy:shared-agents  # Deploy shared-agents only
bun run ci:deploy:telegram       # Deploy telegram only
bun run ci:deploy:github         # Deploy github only
bun run ci:deploy:memory-mcp     # Deploy memory-mcp only
bun run ci:deploy:safety-kernel  # Deploy safety-kernel only
```

## Cloudflare Workers Dashboard Setup

Configure build commands in Cloudflare Dashboard → Workers & Pages → Your Worker → Settings → Builds.

### Build Configuration

**shared-agents:**
- Build command: `bun run ci:build:shared-agents`
- Deploy command: `bun run ci:deploy:shared-agents`
- Branch deploy: `bun run ci:deploy-version:shared-agents`

**telegram-bot:**
- Build command: `bun run ci:build:telegram`
- Deploy command: `bun run ci:deploy:telegram`
- Branch deploy: `bun run ci:deploy-version:telegram`

**github-bot:**
- Build command: `bun run ci:build:github`
- Deploy command: `bun run ci:deploy:github`
- Branch deploy: `bun run ci:deploy-version:github`

**memory-mcp:**
- Build command: `bun run ci:build:memory-mcp`
- Deploy command: `bun run ci:deploy:memory-mcp`
- Branch deploy: `bun run ci:deploy-version:memory-mcp`

**safety-kernel:**
- Build command: `bun run ci:build:safety-kernel`
- Deploy command: `bun run ci:deploy:safety-kernel`
- Branch deploy: `bun run ci:deploy-version:safety-kernel`

### Important: Deploy Order

When deploying via Cloudflare Dashboard GitHub integration:

1. **Deploy shared-agents FIRST** - it owns all shared Durable Objects
2. Then deploy telegram-bot, github-bot (they reference shared-agents DOs via `script_name`)
3. Then deploy memory-mcp, safety-kernel (independent)

If you deploy telegram-bot before shared-agents, it will fail to bind to the shared DOs.

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
bun run config:shared-agents # Shared agents secrets
bun run config:memory-mcp   # Memory MCP secrets
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

### Routing Debug

```bash
# Enable debug logs for routing decisions
bunx wrangler secret put ROUTER_DEBUG --text "true"
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

Each bot deploys Durable Objects implementing [Cloudflare Agent Patterns](https://developers.cloudflare.com/agents/patterns/):

- TelegramAgent/GitHubAgent
- RouterAgent
- SimpleAgent, HITLAgent, OrchestratorAgent
- CodeWorker, ResearchWorker, GitHubWorker

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Secrets not loading | `bunx wrangler secret list` then re-set |
| DO timeout | Check logs, delete stuck instance if needed |
| High latency | Enable `ROUTER_DEBUG`, check AI Gateway |
| Deployment fails | `bun run check` then retry |
| Deploy order issues | Ensure shared-agents deploys before telegram/github |
| Binding failures | Verify `script_name` in wrangler.toml matches shared-agents |

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
