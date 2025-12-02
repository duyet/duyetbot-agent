---
title: sdk.query()
description: "Async generator for agent execution. Stream messages, tools, results. Options: model/tools/agents/abort."
---

<!-- i18n: en -->

**TL;DR**: `for await (const msg of sdk.query("Hello", {tools}))` -> Stream user/assistant/result. AbortController support.

## Table of Contents
- [Signature](#signature)
- [Options](#options)
- [Stream Messages](#stream-messages)
- [Usage](#usage)
- [Errors](#errors)

## Signature

From [`query.ts`](packages/core/src/sdk/query.ts:231)

```typescript
export async function* query(
  input: QueryInput,  // string | AsyncIterable<string>
  options?: QueryOptions,
  controller?: QueryController  // {interrupt(), signal}
): AsyncGenerator<SDKAnyMessage>
```

## Options

| Prop | Type | Desc |
|------|------|------|
| model | string | LLM model |
| tools | SDKTool[] | MCP-converted tools |
| agents | SubagentConfig[] | Delegate patterns |
| systemPrompt | string | Custom system |
| sessionId | string | Resume context |

## Stream Messages

```typescript
for await (const msg of query("Hi")) {
  if (msg.type === 'user') console.log('User:', msg.content);
  if (msg.type === 'assistant') console.log('AI:', msg.content);
  if (msg.type === 'result') console.log('Tokens:', msg.totalTokens);
}
```

Types [`types.ts`](packages/core/src/sdk/types.ts)

| Type | Fields |
|------|--------|
| user | content, uuid |
| assistant | content, stopReason |
| result | content, inputTokens, duration |

## Usage

**Playground**:

```typescript
// Single shot
const result = await querySingle("2+2?", {model: "claude-3-haiku"});
// {content: "4", totalTokens: 10}

// Collect all
const messages = await collectMessages("Analyze code", {tools: [bashTool]});
```

**Abort**:

```typescript
const ctrl = createQueryController();
setTimeout(() => ctrl.interrupt(), 5000);
for await (const msg of query("Long task", {}, ctrl)) { /* ... */ }
```

## Errors

Handled as `system` msg. Validation fails -> early yield.

**Quiz**: query("Hi", {tools}) -> MCP server?
A: duyetbot-tools ✅

**Try**: Import `sdk`, run playground -> Stream live!

**Related**: [Subagents ->](./subagent.md)