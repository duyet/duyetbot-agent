# Deployment Guide

**Related:** [Getting Started](getting-started.md) | [Architecture](architecture.md) | [Contributing](contributing.md)

## Deployable Components

| Component | Guide | Required | Description |
|-----------|-------|----------|-------------|
| **GitHub Bot** | [deployment/github-bot.md](deployment/github-bot.md) | Yes | Webhook handler for @mentions, PR reviews |
| **Memory MCP** | [deployment/memory-mcp.md](deployment/memory-mcp.md) | No | Cloudflare Workers - session persistence |
| **Telegram Bot** | [deployment/telegram-bot.md](deployment/telegram-bot.md) | No | Chat interface via Telegram |
| **Agent Server** | [deployment/agent-server.md](deployment/agent-server.md) | No | Long-running server with WebSocket |

## Quick Start

For most users, start with the **GitHub Bot**:

1. **[GitHub Bot Deployment](deployment/github-bot.md)** - Deploy the core webhook handler
2. Optionally add **[Memory MCP](deployment/memory-mcp.md)** for session persistence

## Platform Comparison

| Platform | Difficulty | Cost | Best For |
|----------|------------|------|----------|
| Railway | Easy | $5/mo | Beginners, quick setup |
| Fly.io | Easy | Free-$5/mo | Free tier, good defaults |
| Render | Easy | Free-$7/mo | Simple Docker deploys |
| AWS ECS/Fargate | Advanced | $10-15/mo | Full control, enterprise |
| Docker Compose | Medium | VPS cost | Self-hosted |

**Recommendation**: Start with **Fly.io** for free tier or **Railway** for simplicity.

## Next Steps

- **[GitHub Bot Deployment](deployment/github-bot.md)** - Start here
- [Getting Started](getting-started.md) - Development setup
- [Architecture](architecture.md) - System design
