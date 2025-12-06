---
title: Build Custom Agent
description: End-to-end tutorial. Extend base agent. Add DO binding. Deploy. Test. Your agent live!
---

**TL;DR**: Extend `BaseAgent`. Add class/bind in `shared-agents`. `bun run deploy:shared-agents`. Test via Telegram!

Create "WeatherAgent". Runs in 5 mins.

## 📋 Prerequisites

- [ ] [Getting Started ->](/getting-started/env-setup)
- [ ] Deployed: `bun run deploy:shared-agents`

## 🛠️ Step 1: Create Agent

In [`packages/chat-agent/src/agents/`](packages/chat-agent/src/agents/):

```typescript
// weather-agent.ts
import { BaseAgent } from '../base-agent.js';

export class WeatherAgent extends BaseAgent {
  name = 'WeatherAgent';

  async execute(query: string) {
    // Fetch weather via tool
    const weather = await this.tools.weather(query);
    return `Weather: ${weather}`;
  }
}
```

Export in `index.ts`:

```typescript
export { WeatherAgent } from './weather-agent.js';
```

## 🔗 Step 2: Bind DO

In [`apps/shared-agents/wrangler.toml`](apps/shared-agents/wrangler.toml):

```toml
[[durable_objects.bindings]]
name = "WeatherAgent"
class_name = "WeatherAgent"
```

## 🚀 Step 3: Deploy & Test

```bash
bun run deploy:shared-agents
```

Router auto-routes "weather" queries.

**Test Telegram**: "What's Hanoi weather?"

**Expect**: "Weather: 28°C sunny"

## 🔄 Agent Flow

```
+--------------------+
| User: "Weather?"   |
+--------+----------+
         |
         v
+--------------------+
| RouterAgent        |
| Classify           |
+--------+----------+
         |
         v
+--------------------+
| WeatherAgent DO    |
+--------+----------+
         |
         v
+--------------------+
| Tools: weather API |
+--------+----------+
         |
         v
+--------------------+
| Response: "28°C"   |
+--------+----------+
         |
         v
+--------------------+
| Edit thinking ->   |
| Final              |
+--------------------+
```

## 🎯 Quiz

**Q**: Bind new DO where?
A: `shared-agents/wrangler.toml` ✅

**Pro Tip**: Add pattern `/weather/i` in router for fast route.

## Custom Durable Objects

**TL;DR**: `class MyAgent extends Agent<MyEnv, MyState>`. `handle(ctx)`. `agentRegistry.register({name:'my-agent',...})`. Import `agents/index.ts`. ✅ Routed.

### Extend Base

From [`base-agent.ts`](packages/chat-agent/src/agents/base-agent.ts:7):

```typescript
import { Agent } from 'agents';
import { agentRegistry } from './registry.js';

export class MyAgent extends Agent<MyEnv, MyState> {
  async handle(ctx: AgentContext): Promise<AgentResult> {
    // Custom logic
    return { success: true, content: 'Hello!' };
  }
}
```

### Register

In `agents/my-agent.ts`:

```typescript
agentRegistry.register({
  name: 'my-agent',
  description: 'Handles custom tasks',
  examples: ['custom query'],
  priority: 50
});
```

Import `agents/my-agent.ts` in [`agents/index.ts`](packages/chat-agent/src/agents/index.ts).

### Router Auto-Uses

Registry builds classification prompt dynamically [`registry.ts`](packages/chat-agent/src/agents/registry.ts:229).

**Quiz**: Registration where?
A: agentRegistry.register() ✅

**Pro Tip** ✅: Priority 100 for HITL.

## 🚀 Next

[Telegram Setup ->](/guides/telegram-bot)
**Build now**: Add WeatherAgent! {{t('agent.live')}}
