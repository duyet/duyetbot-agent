---
title: Build Custom Agent
description: Create custom Durable Object agents. Extend base, register, bind, deploy. Complete tutorial.
---

# Build Custom Agent

Create a custom agent that runs as a Durable Object. This guide covers the full workflow from code to deployment.

## Prerequisites

- [Environment Setup](/getting-started/env-setup) complete
- Deployed: `bun run deploy:shared-agents`

## Step 1: Create Agent Class

In `packages/chat-agent/src/agents/`:

```typescript
// weather-agent.ts
import { Agent } from 'agents';
import { agentRegistry } from './registry.js';

export class WeatherAgent extends Agent<Env, State> {
  name = 'WeatherAgent';

  async handle(ctx: AgentContext): Promise<AgentResult> {
    const query = ctx.message;
    const weather = await this.tools.weather(query);
    return { success: true, content: `Weather: ${weather}` };
  }
}
```

Export in `index.ts`:

```typescript
export { WeatherAgent } from './weather-agent.js';
```

## Step 2: Register Agent

Registration enables router classification. In your agent file:

```typescript
agentRegistry.register({
  name: 'weather-agent',
  description: 'Handles weather queries and forecasts',
  examples: ['what is the weather', 'temperature in Tokyo'],
  priority: 50  // Higher = checked first (HITL uses 100)
});
```

Import in `agents/index.ts` to auto-register.

## Step 3: Add DO Binding

In `apps/shared-agents/wrangler.toml`:

```toml
[[durable_objects.bindings]]
name = "WeatherAgent"
class_name = "WeatherAgent"
```

Add migration if using SQLite state:

```toml
[[migrations]]
tag = "v4"
new_sqlite_classes = ["WeatherAgent"]
```

## Step 4: Deploy & Test

```bash
bun run deploy:shared-agents
```

**Test via Telegram**: "What's the weather in Hanoi?"

**Expected**: "Weather: 28°C sunny"

## Agent Flow

```
User: "Weather?"
       ↓
RouterAgent (classify)
       ↓
WeatherAgent DO
       ↓
Tools: weather API
       ↓
Response: "28°C sunny"
```

## Cross-Worker Reference

To use shared agents from other workers (e.g., telegram-bot):

In `apps/telegram-bot/wrangler.toml`:

```toml
[[durable_objects.bindings]]
name = "WeatherAgent"
class_name = "WeatherAgent"
script_name = "duyetbot-shared-agents"  # Reference shared worker
```

## Quick Reference

| Task | Location |
|------|----------|
| Agent logic | `packages/chat-agent/src/agents/` |
| Registration | `agentRegistry.register()` |
| DO binding | `apps/shared-agents/wrangler.toml` |
| Cross-worker ref | Add `script_name` in consumer's wrangler.toml |

## Related

- [Custom Tools](/guides/custom-tools)
- [Cloudflare Deployment](/guides/cloudflare-deploy)
