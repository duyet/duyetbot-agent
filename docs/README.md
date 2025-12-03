---
title: Deployment
description: Deploy GitHub Bot, Memory MCP, Telegram, or Agent Server. Platform comparison and quick start guide.
---

**Related:** [Getting Started](../getting-started.md) | [Architecture](../architecture.md) | [Contributing](../contributing.md)

## Deployable Components

| Component | Guide | Required | Description |
|-----------|-------|----------|-------------|
| **GitHub Bot** | [github-bot.md](github-bot.md) | Yes | Webhook handler for @mentions, PR reviews |
| **Memory MCP** | [memory-mcp.md](memory-mcp.md) | No | Cloudflare Workers - session persistence |
| **Telegram Bot** | [telegram-bot.md](telegram-bot.md) | No | Chat interface via Telegram |
| **Cloudflare Agents** | [cloudflare-agents.md](cloudflare-agents.md) | No | Stateful serverless agents on Cloudflare |

## Quick Start

For most users, start with the **GitHub Bot**:

1. **[GitHub Bot Deployment](github-bot.md)** - Deploy the core webhook handler
2. Optionally add **[Memory MCP](memory-mcp.md)** for session persistence

## Platform Comparison

| Platform | Difficulty | Cost | Best For |
|----------|------------|------|----------|
| Cloudflare Agents | Easy | Free-$5/mo | Stateful agents, global edge |
| Railway | Easy | $5/mo | Beginners, quick setup |
| Fly.io | Easy | Free-$5/mo | Free tier, good defaults |
| Render | Easy | Free-$7/mo | Simple Docker deploys |
| AWS ECS/Fargate | Advanced | $10-15/mo | Full control, enterprise |
| Docker Compose | Medium | VPS cost | Self-hosted |

**Recommendation**: Start with **Cloudflare Agents** for stateful serverless agents, **Fly.io** for free tier containers, or **Railway** for simplicity.

## Next Steps

- [GitHub Bot Deployment](github-bot.md) - Start here
- [Architecture](../architecture.md) - System design overview
