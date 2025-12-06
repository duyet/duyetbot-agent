---
title: Claude Code Agent
description: Deploy long-running agent server with Claude Code/Agent SDK. Docker deployment, WebSocket streaming, extended sessions.
---

# Claude Code Agent

**Back to:** [Cloudflare Deploy](cloudflare-deploy)

Deploy a long-running agent server for tasks that exceed Cloudflare Workers' 30-second timeout.

## Overview

The Claude Code Agent (Tier 2) is designed for:
- **Long-running sessions** - No 30s timeout limit
- **WebSocket streaming** - Real-time response streaming
- **Code execution** - Filesystem access, shell tools
- **Extended context** - Multi-turn complex conversations

## When to Use

| Use Case | Agent Type | Why |
|----------|------------|-----|
| Quick Q&A, greetings | Cloudflare Agent | Fast, serverless |
| Webhook handlers | Cloudflare Agent | Fire-and-forget pattern |
| Complex research | Claude Code Agent | Needs extended time |
| Code generation + testing | Claude Code Agent | Filesystem access |
| Multi-step workflows | Claude Code Agent | Session persistence |

## Comparison

| Aspect | Cloudflare Agent | Claude Code Agent |
|--------|------------------|-------------------|
| **Runtime** | Cloudflare Workers + DO | Docker container |
| **Timeout** | 30 seconds | Unlimited |
| **State** | Durable Objects | In-memory/filesystem |
| **Latency** | Ultra-low (edge) | Higher (single region) |
| **Scaling** | Automatic, global | Manual, container-based |
| **Tools** | MCP servers only | Shell, filesystem, git |

## Prerequisites

1. Docker installed
2. Server with persistent storage (or Fly.io, Railway, etc.)

## Environment Variables

```bash
# LLM Provider
ANTHROPIC_API_KEY=xxx
ANTHROPIC_BASE_URL=https://api.anthropic.com

# Server
PORT=3003
NODE_ENV=production

# Optional: Connect to Memory MCP
MCP_SERVER_URL=https://memory.duyetbot.workers.dev
MCP_AUTH_TOKEN=xxx
```

## Deploy with Docker

```bash
cd apps/agent-server

# Build
docker build -t duyetbot-server .

# Run
docker run -d \
  -e ANTHROPIC_API_KEY=xxx \
  -p 3003:3003 \
  duyetbot-server
```

## Docker Compose

```yaml
version: '3.8'

services:
  agent-server:
    build:
      context: .
      dockerfile: apps/agent-server/Dockerfile
    ports:
      - "3003:3003"
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - MCP_SERVER_URL=${MCP_SERVER_URL}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3003/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

## Health Check

```bash
curl http://localhost:3003/health
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Tier 1 (Edge)                        │
│  Cloudflare Workers + Durable Objects                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ Telegram    │  │ GitHub      │  │ Router      │     │
│  │ Webhook     │  │ Webhook     │  │ Agent       │     │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘     │
│         │                │                │             │
│         └────────────────┴────────────────┘             │
│                          │                              │
│         Simple queries handled here                     │
└──────────────────────────┼──────────────────────────────┘
                           │
              Complex/long-running tasks
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                    Tier 2 (Container)                   │
│  ┌─────────────────────────────────────────────────┐   │
│  │              Claude Code Agent                   │   │
│  │  • Claude Agent SDK                             │   │
│  │  • Filesystem access                            │   │
│  │  • Shell tools (git, bash)                      │   │
│  │  • WebSocket streaming                          │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Routing from Tier 1

The RouterAgent in Tier 1 can escalate to Tier 2 when:
- Task complexity is high
- Task requires filesystem access
- Task needs extended execution time
- User explicitly requests long-running mode

## Next Steps

- [Telegram Bot](telegram-bot) - Tier 1 Telegram interface
- [GitHub Bot](github-bot) - Tier 1 GitHub integration
- [Cloudflare Deploy](cloudflare-deploy) - Deployment overview
