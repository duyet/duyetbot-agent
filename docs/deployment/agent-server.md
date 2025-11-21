# Agent Server Deployment

**Back to:** [Deployment Overview](README.md)

Deploy the long-running agent server with WebSocket support.

## Overview

The Agent Server provides:
- Long-running agent sessions
- WebSocket streaming
- Session lifecycle management
- Health check endpoints

## Prerequisites

1. Docker installed
2. Server with persistent storage

## Environment Variables

```env
# LLM Provider
ANTHROPIC_API_KEY=xxx
ANTHROPIC_BASE_URL=https://api.anthropic.com

# Server
PORT=3003
NODE_ENV=production

# Optional MCP Memory
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

## Next Steps

- [GitHub Bot Deployment](github-bot.md) - Deploy the main bot
- [Deployment Overview](README.md) - Other components
