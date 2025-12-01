---
title: Build Custom Agent
desc: End-to-end tutorial. Extend base agent. Add DO binding. Deploy. Test. Your agent live!
sidebar_position: 2.1
keywords: [custom-agent, tutorial, extend-agent, durable-object, wrangler-binding, deploy-test]
slug: guides/build-custom-agent
---

# Build Custom Agent

**TL;DR**: Extend `BaseAgent`. Add class/bind in `shared-agents`. `bun run deploy:shared-agents`. Test via Telegram!

Create "WeatherAgent". Runs in 5 mins.

## 📋 Prerequisites

- [ ] [Getting Started →](/getting-started/env-setup)
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

In [`apps/shared-agents/wrangler.toml`](apps/shared-agents/[`wrangler.toml`](apps/shared-agents/wrangler.toml)):

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

## 🔄 Agent Flow Mermaid

```mermaid
graph TD
    A[User: 'Weather?'] --> B[RouterAgent Classify]
    B --> C[WeatherAgent DO]
    C --> D[Tools: weather API]
    D --> E[Response: '28°C']
    E --> F[Edit thinking → Final]
```

## 🎯 Quiz

**Q**: Bind new DO where?  
A: `shared-agents/wrangler.toml` ✅

**Pro Tip**: Add pattern `/weather/i` in router for fast route.

## 🚀 Next

[Telegram Setup →](/guides/telegram-bot-setup)  
**Build now**: Add WeatherAgent! {{t('agent.live')}}