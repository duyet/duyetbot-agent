---
title: Cloudflare Agents Deployment
description: Deploy duyetbot-agent to Cloudflare Agents with Durable Objects, SQLite, and WebSocket hibernation
---

**Back to:** [Deployment Overview](README.md)

Deploy duyetbot-agent to [Cloudflare Agents](https://agents.cloudflare.com/) using Durable Objects for stateful, serverless execution.

## Overview

Cloudflare Agents provides:
- **Stateful execution** via Durable Objects
- **Zero-latency SQLite storage** for agent memory
- **WebSocket hibernation** for cost savings
- **Real-time communication** with clients
- **Global edge deployment**

## Prerequisites

1. Cloudflare account (Free tier available)
2. Node.js 18+
3. Wrangler CLI: `npm install -g wrangler`

## Quick Start

### 1. Create Agent Project

```bash
# Create from Cloudflare's starter template
npm create cloudflare@latest duyetbot-cf-agent -- --template cloudflare/agents-starter

cd duyetbot-cf-agent
```

### 2. Install Dependencies

```bash
npm install @anthropic-ai/sdk agents
```

### 3. Configure wrangler.jsonc

```jsonc
{
  "name": "duyetbot-agent",
  "main": "src/index.ts",
  "compatibility_date": "2025-01-01",
  "compatibility_flags": ["nodejs_compat"],

  // Required for Cloudflare Agents
  "durable_objects": {
    "bindings": [
      {
        "name": "AGENT",
        "class_name": "DuyetbotAgent"
      }
    ]
  },

  // Mandatory migrations for Agents SDK
  "migrations": [
    {
      "tag": "v1",
      "new_sqlite_classes": ["DuyetbotAgent"]
    }
  ],

  // Optional: AI bindings
  "ai": {
    "binding": "AI"
  },

  // Environment variables
  "vars": {
    "ENVIRONMENT": "production"
  }
}
```

### 4. Create Agent Entry Point

```typescript
// src/index.ts
import { Agent, AgentNamespace } from "agents";

export interface Env {
  AGENT: AgentNamespace<DuyetbotAgent>;
  ANTHROPIC_API_KEY: string;
  AI: Ai;
}

export class DuyetbotAgent extends Agent<Env> {
  async onRequest(request: Request): Promise<Response> {
    // Handle HTTP requests
    const body = await request.json();
    const response = await this.processMessage(body.message);
    return new Response(JSON.stringify({ response }));
  }

  async onConnect(connection: Connection): Promise<void> {
    // Handle WebSocket connections
    connection.send(JSON.stringify({ status: "connected" }));
  }

  async onMessage(connection: Connection, message: string): Promise<void> {
    // Handle WebSocket messages
    const data = JSON.parse(message);
    const response = await this.processMessage(data.message);
    connection.send(JSON.stringify({ response }));
  }

  private async processMessage(message: string): Promise<string> {
    // Your agent logic here
    // Use this.state for persistent storage
    await this.state.storage.put("lastMessage", message);

    return `Processed: ${message}`;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Route to agent instance
    const agentId = url.searchParams.get("id") || "default";
    const agent = env.AGENT.get(env.AGENT.idFromName(agentId));

    return agent.fetch(request);
  },
};
```

### 5. Set Secrets

```bash
wrangler login

# Set required secrets
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put GITHUB_TOKEN  # If using GitHub integration
```

### 6. Deploy

```bash
# Deploy to Cloudflare
wrangler deploy

# Your agent will be available at:
# https://duyetbot-agent.<your-subdomain>.workers.dev
```

## Environment Variables

```bash
# Required
ANTHROPIC_API_KEY=<your-api-key>

# Optional
GITHUB_TOKEN=<token>              # For GitHub operations
MCP_MEMORY_URL=<url>              # Memory server URL
ANTHROPIC_BASE_URL=<url>          # Custom API endpoint (Z.AI)
```

## Integrating with duyetbot-agent

To use the existing duyetbot-agent packages:

```typescript
// src/index.ts
import { Agent } from "agents";
import { executeQuery } from "@duyetbot/core/sdk-engine";
import { getAllSDKTools } from "@duyetbot/core/sdk-engine/tools";

export class DuyetbotAgent extends Agent<Env> {
  async onMessage(connection: Connection, message: string): Promise<void> {
    const config = {
      model: "sonnet",
      tools: getAllSDKTools(),
      systemPrompt: "You are duyetbot...",
      sessionId: this.state.id.toString(),
    };

    for await (const msg of executeQuery(message, config)) {
      if (msg.type === "assistant") {
        connection.send(JSON.stringify(msg));
      }
    }
  }
}
```

## State Persistence

Cloudflare Agents uses SQLite storage built into Durable Objects:

```typescript
// Store state
await this.state.storage.put("key", value);

// Retrieve state
const value = await this.state.storage.get("key");

// Delete state
await this.state.storage.delete("key");

// List keys
const keys = await this.state.storage.list();
```

## WebSocket Hibernation

Enable hibernation for cost savings when idle:

```typescript
export class DuyetbotAgent extends Agent<Env> {
  // Agent automatically hibernates when no active connections
  // WebSocket connections are maintained during hibernation

  async onConnect(connection: Connection): Promise<void> {
    // Restore state when connection resumes
    const lastState = await this.state.storage.get("lastState");
    connection.send(JSON.stringify({ restored: lastState }));
  }
}
```

## Deployment Options

### Development

```bash
# Run locally
wrangler dev

# With remote bindings (D1, KV, etc.)
wrangler dev --remote
```

### Production

```bash
# Deploy to production
wrangler deploy

# Deploy to specific environment
wrangler deploy --env production
```

### Custom Domain

```jsonc
// wrangler.jsonc
{
  "routes": [
    {
      "pattern": "agent.yourdomain.com/*",
      "custom_domain": true
    }
  ]
}
```

## Monitoring

View logs and metrics in Cloudflare Dashboard:

```bash
# Stream logs
wrangler tail

# View specific agent logs
wrangler tail --filter "DuyetbotAgent"
```

## Cost Considerations

| Resource | Free Tier | Paid |
|----------|-----------|------|
| Requests | 100K/day | $0.15/million |
| Duration | 10ms CPU | $12.50/million GB-s |
| Storage | 1GB | $0.20/GB-month |

WebSocket hibernation reduces costs by pausing execution while maintaining connections.

## Troubleshooting

### Migration Errors

If you see migration errors, ensure `new_sqlite_classes` includes your agent class:

```jsonc
"migrations": [
  {
    "tag": "v1",
    "new_sqlite_classes": ["DuyetbotAgent"]
  }
]
```

### State Not Persisting

Ensure you're using `this.state.storage` methods, not local variables.

### WebSocket Disconnections

Check that your agent handles reconnection gracefully and restores state from storage.

## Next Steps

- [Memory MCP Deployment](memory-mcp.md) - Add session persistence
- [GitHub Bot Deployment](github-bot.md) - Deploy webhook handler
- [Deployment Overview](README.md) - Other components

## Resources

- [Cloudflare Agents Documentation](https://developers.cloudflare.com/agents/)
- [Durable Objects Guide](https://developers.cloudflare.com/durable-objects/get-started/)
- [Agents SDK Blog Post](https://blog.cloudflare.com/build-ai-agents-on-cloudflare/)
