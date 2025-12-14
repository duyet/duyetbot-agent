---
title: Simple Agent (LEGACY)
description: DEPRECATED - This document describes the legacy SimpleAgent which was removed in December 2024.
deprecated: true
---

<!-- i18n: en -->

> **DEPRECATION NOTICE**: This document describes the legacy SimpleAgent which was removed in December 2024 as part of the loop-based agent refactoring. The system now uses a single `CloudflareChatAgent` with tool iterations. See [architecture.md](../architecture.md) for current implementation.

## Legacy Documentation

**TL;DR** (Historical): Answered greetings/general knowledge directly via LLM. Fast, no tools/orchestration. Fallback for 80% queries.

## Table of Contents
- [Flow](#flow)
- [When Routed](#when-routed)
- [Code Snippet](#code-snippet)

## Flow

```
+-------------------------+
| Router Matches          |
| Pattern/LLM             |
+----------+--------------+
           |
           v
+---------------------+
| simple/low?         |
+-----+--------+------+
      |        |
    Yes|       |No
      v        v
+----------+  +----------+
|Simple    |  |Orchestr  |
|Agent     |  |/etc.     |
+-----+----+  +----------+
      |
      v
+-----+----------------+
| Load Parent         |
| History             |
+-----+----------------+
      |
      v
+-----+----------------+
| LLM Chat            |
| w/ webSearch?       |
+-----+----------------+
      |
      v
+---------------------+
| Response            |
| via Transport       |
+---------------------+
```

**Key**: Stateless. History from parent CloudflareChatAgent. Web search via :online models.

## When Routed

Router sends here for:
- Patterns: hi/help/thanks ✅
- `type: simple + complexity: low`
- General knowledge (no tools needed)

| Trigger | Example | Latency |
|---------|---------|---------|
| Pattern | "hi" | <100ms |
| LLM | "explain recursion" | 1-3s |

## Code Snippet

[`packages/cloudflare-agent/src/agents/simple-agent.ts`](packages/cloudflare-agent/src/agents/simple-agent.ts:190)
```typescript
async execute(query: string, context: AgentContext): Promise<AgentResult> {
  const provider = config.createProvider(env, context);
  const llmMessages = [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: query }];
  const response = await provider.chat(llmMessages, undefined, { webSearch: true });
}
```

**Quiz**: Simple vs Router?  
A: Simple executes; Router classifies ✅

**Related**: [Router ->](./router-agent.md) | [Transports ->](../transports.md)

**Next**: Deploy & test: `bun run deploy:telegram` -> "hi" -> SimpleAgent!