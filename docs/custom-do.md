---
title: Custom Agent DO
desc: Extend BaseAgent. Implement handle(). Self-register via agentRegistry.register(). Import agents/index.ts.
sidebar_position: 3
keywords: [extend, agent, do, custom, registry, base-agent]
slug: developer-hub/extend/custom-do
---

<!-- i18n: en -->

# Custom Agent DO

**TL;DR**: `class MyAgent extends Agent<MyEnv, MyState>`. `handle(ctx)`. `agentRegistry.register({name:'my-agent',...})`. Import `agents/index.ts`. ✅ Routed.

## Table of Contents
- [Extend Base](#extend-base)
- [Register](#register)
- [Snippet](#snippet)

## Extend Base

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

## Register

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

## Router Auto-Uses

Registry builds classification prompt dynamically [`registry.ts`](packages/chat-agent/src/agents/registry.ts:229).

**Quiz**: Registration where?  
A: agentRegistry.register() ✅

**Pro Tip** ✅: Priority 100 for HITL.

**CTA**: Build agent → [Fork/PR](../contribute/fork-pr.md)

**Next**: [Troubleshooting →](../../../community/troubleshooting.md)