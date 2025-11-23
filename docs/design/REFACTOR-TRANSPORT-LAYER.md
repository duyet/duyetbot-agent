# Refactoring Plan: Transport Layer Architecture

> **Status**: Complete
> **Created**: 2024-11-23
> **Completed**: 2024-11-24
> **Goal**: Move all agent logic into the agent layer, with apps defining only the transport layer

## Overview

This refactoring introduces a **Transport Layer Pattern** that cleanly separates:
- **Agent Layer**: All workflow logic, LLM calls, state management
- **Transport Layer**: Platform-specific message sending/receiving
- **Application Layer**: Thin webhook handlers that connect transport to agent

### Target Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Application Layer                       │
│         (telegram-bot, github-bot, future apps)          │
│                                                          │
│  • Webhook handling & routing                            │
│  • Context creation from platform payload                │
│  • Transport implementation for platform                 │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                   Transport Layer                        │
│                                                          │
│  interface Transport<TContext> {                         │
│    send: (ctx, text) => Promise<MessageRef>              │
│    edit?: (ctx, ref, text) => Promise<void>              │
│    typing?: (ctx) => Promise<void>                       │
│    parseContext: (ctx) => ParsedInput                    │
│  }                                                       │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                     Agent Layer                          │
│              (chat-agent package)                        │
│                                                          │
│  agent.handle(ctx) orchestrates:                         │
│    1. Parse input from context                           │
│    2. Route: command or chat                             │
│    3. Process with LLM if needed                         │
│    4. Use transport to respond                           │
└─────────────────────────────────────────────────────────┘
```

### Simplified App Code

**Before**: ~300 lines with scattered logic
**After**: ~50 lines, thin controller

```typescript
// apps/telegram-bot/src/index.ts
app.post('/webhook', async (c) => {
  const env = c.env;
  const update = await c.req.json();

  // Create context from webhook
  const ctx = createTelegramContext(env, update);

  // Get or create agent instance
  const agent = await getAgent(env, ctx.chatId);

  // Agent handles everything
  await agent.handle(ctx);

  return c.json({ ok: true });
});
```

---

## Phase 1: Core Transport Interface

### Task 1.1: Create Transport Interface

**File**: `packages/chat-agent/src/transport.ts`

```typescript
/**
 * Message reference returned by transport.send()
 * Platform-specific (number for Telegram, string for GitHub)
 */
export type MessageRef = string | number;

/**
 * Parsed input extracted from platform context
 */
export interface ParsedInput {
  /** The message text */
  text: string;
  /** User identifier */
  userId: string | number;
  /** Chat/conversation identifier */
  chatId: string | number;
  /** Original message reference (for replies) */
  messageRef?: MessageRef;
  /** Message this is replying to */
  replyTo?: MessageRef;
}

/**
 * Transport interface for platform-specific message operations
 * @template TContext - Platform-specific context type
 */
export interface Transport<TContext> {
  /**
   * Send a message and return reference for future edits
   */
  send: (ctx: TContext, text: string) => Promise<MessageRef>;

  /**
   * Edit an existing message (for streaming updates)
   */
  edit?: (ctx: TContext, ref: MessageRef, text: string) => Promise<void>;

  /**
   * Delete a message
   */
  delete?: (ctx: TContext, ref: MessageRef) => Promise<void>;

  /**
   * Send typing indicator
   */
  typing?: (ctx: TContext) => Promise<void>;

  /**
   * Add reaction to a message
   */
  react?: (ctx: TContext, ref: MessageRef, emoji: string) => Promise<void>;

  /**
   * Extract input data from platform context
   */
  parseContext: (ctx: TContext) => ParsedInput;
}
```

### Task 1.2: Update Agent Config

**File**: `packages/chat-agent/src/cloudflare-agent.ts`

Update `CloudflareAgentConfig` to include transport:

```typescript
export interface CloudflareAgentConfig<TEnv, TContext = unknown> {
  // Existing fields
  createProvider: (env: TEnv) => LLMProvider;
  systemPrompt: string;
  welcomeMessage?: string;
  helpMessage?: string;
  maxHistory?: number;

  // NEW: Transport layer (optional for backward compatibility)
  transport?: Transport<TContext>;

  // NEW: Lifecycle hooks
  hooks?: {
    beforeHandle?: (ctx: TContext) => Promise<void>;
    afterHandle?: (ctx: TContext, response: string) => Promise<void>;
    onError?: (ctx: TContext, error: Error) => Promise<void>;
  };
}
```

### Task 1.3: Implement handle() Method

Add to the agent class:

```typescript
/**
 * Handle incoming message context
 * Routes to command handler or chat, then sends response via transport
 */
async handle(ctx: TContext): Promise<void> {
  const transport = this.transport;
  if (!transport) {
    throw new Error('Transport not configured. Pass transport in config.');
  }

  const input = transport.parseContext(ctx);

  // Initialize state with user/chat context
  await this.init(input.userId, input.chatId);

  try {
    // Call beforeHandle hook
    if (this.hooks?.beforeHandle) {
      await this.hooks.beforeHandle(ctx);
    }

    let response: string;

    // Route: Command or Chat
    if (input.text.startsWith('/')) {
      response = this.handleCommand(input.text);
    } else {
      // Send typing indicator
      if (transport.typing) {
        await transport.typing(ctx);
      }

      // Process with LLM
      response = await this.chat(input.text);
    }

    // Send response
    await transport.send(ctx, response);

    // Call afterHandle hook
    if (this.hooks?.afterHandle) {
      await this.hooks.afterHandle(ctx, response);
    }
  } catch (error) {
    // Call onError hook
    if (this.hooks?.onError) {
      await this.hooks.onError(ctx, error as Error);
    } else {
      throw error;
    }
  }
}

/**
 * Handle command and return response
 */
handleCommand(text: string): string {
  const command = text.split(' ')[0].toLowerCase();

  switch (command) {
    case '/start':
      return this.getWelcome();
    case '/help':
      return this.getHelp();
    case '/clear':
      return this.clearHistory();
    default:
      return `Unknown command: ${command}. Try /help for available commands.`;
  }
}
```

---

## Phase 2: Telegram Migration

### Task 2.1: Create Telegram Transport

**File**: `apps/telegram-bot/src/transport.ts`

```typescript
import type { Bot } from 'grammy';
import type { Transport, MessageRef, ParsedInput } from '@duyetbot/chat-agent';

/**
 * Telegram-specific context
 */
export interface TelegramContext {
  bot: Bot;
  chatId: number;
  message: {
    message_id: number;
    text: string;
    from: {
      id: number;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
    };
  };
}

/**
 * Create Telegram context from webhook update
 */
export function createTelegramContext(bot: Bot, update: any): TelegramContext | null {
  const message = update.message;
  if (!message?.text) return null;

  return {
    bot,
    chatId: message.chat.id,
    message: {
      message_id: message.message_id,
      text: message.text,
      from: message.from,
      chat: message.chat,
    },
  };
}

/**
 * Telegram transport implementation
 */
export const telegramTransport: Transport<TelegramContext> = {
  send: async (ctx, text) => {
    const result = await ctx.bot.api.sendMessage(ctx.chatId, text, {
      parse_mode: 'Markdown',
    });
    return result.message_id;
  },

  edit: async (ctx, ref, text) => {
    await ctx.bot.api.editMessageText(ctx.chatId, ref as number, text, {
      parse_mode: 'Markdown',
    });
  },

  typing: async (ctx) => {
    await ctx.bot.api.sendChatAction(ctx.chatId, 'typing');
  },

  parseContext: (ctx) => ({
    text: ctx.message.text,
    userId: ctx.message.from.id,
    chatId: ctx.message.chat.id,
    messageRef: ctx.message.message_id,
  }),
};
```

### Task 2.2: Update Telegram Agent Config

**File**: `apps/telegram-bot/src/agent.ts`

```typescript
import { createCloudflareChatAgent } from '@duyetbot/chat-agent';
import { createAIGatewayProvider } from './provider.js';
import { telegramTransport, type TelegramContext } from './transport.js';
import {
  TELEGRAM_SYSTEM_PROMPT,
  TELEGRAM_WELCOME_MESSAGE,
  TELEGRAM_HELP_MESSAGE,
} from '@duyetbot/prompts';

export const TelegramAgent = createCloudflareChatAgent<BaseEnv, TelegramContext>({
  createProvider: (env) => createAIGatewayProvider(env),
  systemPrompt: TELEGRAM_SYSTEM_PROMPT,
  welcomeMessage: TELEGRAM_WELCOME_MESSAGE,
  helpMessage: TELEGRAM_HELP_MESSAGE,
  transport: telegramTransport,
  hooks: {
    onError: async (ctx, error) => {
      console.error('Agent error:', error);
      await ctx.bot.api.sendMessage(
        ctx.chatId,
        'Sorry, an error occurred. Please try again.',
      );
    },
  },
});
```

### Task 2.3: Simplify Telegram Index

**File**: `apps/telegram-bot/src/index.ts`

Remove:
- `handleCommand()` function (~35 lines)
- `processAgentChat()` function (~65 lines)
- Complex routing logic

Replace with:

```typescript
app.post('/webhook', async (c) => {
  const env = c.env;
  const update = await c.req.json();

  // Create context from webhook
  const ctx = createTelegramContext(bot, update);
  if (!ctx) {
    return c.json({ ok: true }); // Ignore non-text messages
  }

  // Get agent instance for this chat
  const agentId = env.TELEGRAM_AGENT.idFromName(String(ctx.chatId));
  const agent = env.TELEGRAM_AGENT.get(agentId);

  // Agent handles everything
  await agent.handle(ctx);

  return c.json({ ok: true });
});
```

---

## Phase 3: GitHub Migration

### Task 3.1: Create GitHub Transport

**File**: `apps/github-bot/src/transport.ts`

```typescript
import type { Octokit } from '@octokit/rest';
import type { Transport, MessageRef, ParsedInput } from '@duyetbot/chat-agent';

/**
 * GitHub-specific context
 */
export interface GitHubContext {
  octokit: Octokit;
  owner: string;
  repo: string;
  issueNumber: number;
  commentId?: number;
  body: string;
  sender: {
    id: number;
    login: string;
  };
}

/**
 * Create GitHub context from webhook payload
 */
export function createGitHubContext(
  octokit: Octokit,
  payload: any,
): GitHubContext | null {
  // Handle issue_comment event
  if (payload.comment && payload.issue) {
    return {
      octokit,
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      issueNumber: payload.issue.number,
      commentId: payload.comment.id,
      body: payload.comment.body,
      sender: payload.sender,
    };
  }

  // Handle issues event (new issue)
  if (payload.issue && !payload.comment) {
    return {
      octokit,
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      issueNumber: payload.issue.number,
      body: payload.issue.body || '',
      sender: payload.sender,
    };
  }

  return null;
}

/**
 * GitHub transport implementation
 */
export const githubTransport: Transport<GitHubContext> = {
  send: async (ctx, text) => {
    const result = await ctx.octokit.issues.createComment({
      owner: ctx.owner,
      repo: ctx.repo,
      issue_number: ctx.issueNumber,
      body: text,
    });
    return result.data.id;
  },

  edit: async (ctx, ref, text) => {
    await ctx.octokit.issues.updateComment({
      owner: ctx.owner,
      repo: ctx.repo,
      comment_id: ref as number,
      body: text,
    });
  },

  react: async (ctx, ref, emoji) => {
    await ctx.octokit.reactions.createForIssueComment({
      owner: ctx.owner,
      repo: ctx.repo,
      comment_id: ref as number,
      content: emoji as any,
    });
  },

  parseContext: (ctx) => ({
    text: ctx.body,
    userId: ctx.sender.id,
    chatId: `${ctx.owner}/${ctx.repo}#${ctx.issueNumber}`,
    messageRef: ctx.commentId,
  }),
};
```

### Task 3.2: Update GitHub Agent Config

**File**: `apps/github-bot/src/agent.ts`

```typescript
import { createCloudflareChatAgent } from '@duyetbot/chat-agent';
import { createAIGatewayProvider } from './provider.js';
import { githubTransport, type GitHubContext } from './transport.js';
import { GITHUB_SYSTEM_PROMPT } from '@duyetbot/prompts';

export const GitHubAgent = createCloudflareChatAgent<BaseEnv, GitHubContext>({
  createProvider: (env) => createAIGatewayProvider(env),
  systemPrompt: GITHUB_SYSTEM_PROMPT,
  welcomeMessage: 'Hello! I\'m duyetbot. How can I help?',
  helpMessage: 'Mention me with @duyetbot to get help.',
  transport: githubTransport,
  hooks: {
    beforeHandle: async (ctx) => {
      // Add "eyes" reaction to acknowledge
      if (ctx.commentId) {
        await ctx.octokit.reactions.createForIssueComment({
          owner: ctx.owner,
          repo: ctx.repo,
          comment_id: ctx.commentId,
          content: 'eyes',
        });
      }
    },
    onError: async (ctx, error) => {
      console.error('Agent error:', error);
      await ctx.octokit.issues.createComment({
        owner: ctx.owner,
        repo: ctx.repo,
        issue_number: ctx.issueNumber,
        body: 'Sorry, I encountered an error processing your request.',
      });
    },
  },
});
```

### Task 3.3: Simplify GitHub Index

Consolidate webhook handlers to use `agent.handle(ctx)`.

---

## Phase 4: Testing & Cleanup

### Task 4.1: Update Tests

- Add unit tests for Transport interface
- Add tests for `agent.handle()` with mock transport
- Update existing tests

### Task 4.2: Remove Deprecated Code

- Remove old `handleCommand()` from telegram-bot
- Remove old `processAgentChat()` from telegram-bot
- Clean up unused imports

### Task 4.3: Documentation

- Update architecture.md
- Add transport layer documentation
- Update API documentation

---

## Task Checklist

- [x] **1.1** Define Transport interface in `packages/chat-agent/src/transport.ts`
- [x] **1.2** Update CloudflareAgentConfig with transport in `cloudflare-agent.ts`
- [x] **1.3** Implement `handle()` and `handleCommand()` methods
- [x] **2.1** Create `telegramTransport` and `TelegramContext`
- [x] **2.2** Update `apps/telegram-bot/src/agent.ts` with transport
- [x] **2.3** Simplify `apps/telegram-bot/src/index.ts`
- [x] **3.1** Create `githubTransport` and `GitHubContext`
- [x] **3.2** Update `apps/github-bot/src/agent.ts` with transport
- [x] **3.3** Simplify `apps/github-bot/src/index.ts`
- [x] **4.1** Run type-check: `bun run type-check`
- [x] **4.2** Run tests: `bun run test`
- [x] **4.3** Clean up deprecated code

---

## Benefits Summary

| Aspect | Before | After |
|--------|--------|-------|
| **App code size** | ~300 lines | ~50 lines |
| **Logic location** | Scattered across app & agent | Centralized in agent |
| **Testability** | Hard (mixed concerns) | Easy (mock transport) |
| **New platform** | Copy entire app | Just add transport |
| **Command handling** | In each app | Single place in agent |
| **Error handling** | Duplicated | Configurable hooks |

---

## Revision History

| Date | Author | Description |
|------|--------|-------------|
| 2024-11-23 | Claude | Initial plan created |
| 2024-11-24 | Claude | Implementation complete - all phases done, tests passing |
