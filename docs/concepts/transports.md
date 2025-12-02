---
title: Transports
description: Platform abstraction layer. Telegram/GitHub-specific send/edit/typing/parse. 50 LOC per platform. Reuses 2400+ agent LOC.
---

<!-- i18n: en -->

**TL;DR**: Abstracts platform APIs. Agents call `transport.send()`. Handles Telegram 4096-char splits, GitHub comments/reactions.

## Table of Contents
- [Interface](#interface)
- [Telegram Impl](#telegram-impl)
- [GitHub Impl](#github-impl)
- [Comparison](#comparison)

## Interface

Core methods agents use:

```typescript
interface Transport<T> {
  send(ctx: T, text: string): Promise<MessageRef>;
  edit?(ctx: T, ref: MessageRef, text: string): Promise<void>;
  typing?(ctx: T): Promise<void>;
  parseContext(ctx: T): ParsedInput; // text/userId/chatId
}
```

## Telegram Impl

Splits >4096 chars. Markdown fallback. Typing indicator.

[`apps/telegram-bot/src/transport.ts`](apps/telegram-bot/src/transport.ts:284)
```typescript
export const telegramTransport: Transport<TelegramContext> = {
  send: async (ctx, text) => sendTelegramMessage(ctx.token, ctx.chatId, finalText),
  edit: async (ctx, ref, text) => editTelegramMessage(...),
  typing: async (ctx) => sendTypingIndicator(...),
};
```

## GitHub Impl

Comments on issues/PRs. Reactions. XML context blocks.

[`apps/github-bot/src/transport.ts`](apps/github-bot/src/transport.ts:90)
```typescript
export const githubTransport: Transport<GitHubContext> = {
  send: async (ctx, text) => octokit.issues.createComment({ body: text }),
  edit: async (ctx, ref, text) => octokit.issues.updateComment(...),
  react: async (ctx, ref, emoji) => octokit.reactions.createForIssueComment(...),
};
```

## Comparison

| Feature | Telegram | GitHub |
|---------|----------|--------|
| send | 4096-char split/Markdown | Comment on issue/PR |
| edit | editMessageText | updateComment |
| typing | sendChatAction | N/A |
| parse | webhook → text/chatId | Payload → XML context |
| LOC | ~50 | ~50 |

**Reduces duplication 6x!**

**Quiz**: Transports vs Agents?  
A: Transports handle platform APIs; Agents contain logic ✅

**Related**: [Router →](./router-agent.md) | [Deployment →](../deployment)

**Next**: [Memory MCP →](./memory-mcp.md)