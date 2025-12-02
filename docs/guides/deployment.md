# Deployment

Quick reference for deploying duyetbot-agent components.

## Prerequisites

```bash
bun install
bunx wrangler login
```

## Deploy All

```bash
bun run deploy           # Both bots
bun run deploy:telegram  # Telegram only
bun run deploy:github    # GitHub only
```

## Secrets

```bash
# Telegram Bot
cd apps/telegram-bot
bunx wrangler secret put TELEGRAM_BOT_TOKEN
bunx wrangler secret put OPENROUTER_API_KEY

# GitHub Bot
cd apps/github-bot
bunx wrangler secret put GITHUB_TOKEN
bunx wrangler secret put GITHUB_WEBHOOK_SECRET
bunx wrangler secret put OPENROUTER_API_KEY
```

## Routing Debug

```bash
# Enable debug logs for routing decisions
bunx wrangler secret put ROUTER_DEBUG --text "true"
```

## Monitoring

```bash
# Tail logs
bunx wrangler tail --format pretty

# Filter errors
bunx wrangler tail --filter error

# List deployments
bunx wrangler deployments list
```

## Rollback

```bash
# List deployments
bunx wrangler deployments list

# Rollback to previous
bunx wrangler rollback [DEPLOYMENT_ID]
```

## Durable Objects

Each bot deploys 8 DOs (v3 migration):
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

## Links

- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Durable Objects](https://developers.cloudflare.com/durable-objects/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
