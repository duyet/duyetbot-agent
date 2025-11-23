# Architecture

**Related:** [Getting Started](getting-started.md) | [Use Cases](usecases.md) | [API Reference](api.md) | [Deployment](deploy.md)

## Overview

duyetbot-agent is a personal AI agent system built on the **Claude Agent SDK as its core engine**. It implements a **Hybrid Supervisor-Worker Architecture** where Cloudflare Workflows orchestrates durable execution while Fly.io Machines provide the compute environment for heavy LLM tasks.

The system uses a **Transport Layer Pattern** to cleanly separate platform-specific messaging from agent logic, enabling easy addition of new platforms with minimal code.

## Transport Layer Pattern

The core innovation in the application layer is the Transport abstraction that separates:

- **Application Layer**: Thin webhook handlers that connect transport to agent
- **Transport Layer**: Platform-specific message sending/receiving
- **Agent Layer**: All workflow logic, LLM calls, state management

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
│           (telegram-bot, github-bot, future apps)            │
│                                                              │
│  • Webhook handling & routing                                │
│  • Context creation from platform payload                    │
│  • ~50 lines of code per app                                 │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     Transport Layer                          │
│                                                              │
│  interface Transport<TContext> {                             │
│    send: (ctx, text) => Promise<MessageRef>                  │
│    edit?: (ctx, ref, text) => Promise<void>                  │
│    typing?: (ctx) => Promise<void>                           │
│    parseContext: (ctx) => ParsedInput                        │
│  }                                                           │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                       Agent Layer                            │
│                   (chat-agent package)                       │
│                                                              │
│  agent.handle(ctx) orchestrates:                             │
│    1. Parse input from context                               │
│    2. Route: command or chat                                 │
│    3. Process with LLM if needed                             │
│    4. Use transport to respond                               │
│                                                              │
│  Lifecycle hooks: beforeHandle, afterHandle, onError         │
└─────────────────────────────────────────────────────────────┘
```

### Benefits of Transport Layer

| Aspect | Before | After |
|--------|--------|-------|
| **App code size** | ~300 lines | ~50 lines |
| **Logic location** | Scattered across app & agent | Centralized in agent |
| **Testability** | Hard (mixed concerns) | Easy (mock transport) |
| **New platform** | Copy entire app | Just add transport |
| **Command handling** | In each app | Single place in agent |
| **Error handling** | Duplicated | Configurable hooks |

### Transport Interface

```typescript
// Message reference for edits (platform-specific)
type MessageRef = string | number;

// Normalized input from any platform
interface ParsedInput {
  text: string;
  userId: string | number;
  chatId: string | number;
  messageRef?: MessageRef;
  replyTo?: MessageRef;
}

// Transport interface
interface Transport<TContext> {
  send: (ctx: TContext, text: string) => Promise<MessageRef>;
  edit?: (ctx: TContext, ref: MessageRef, text: string) => Promise<void>;
  delete?: (ctx: TContext, ref: MessageRef) => Promise<void>;
  typing?: (ctx: TContext) => Promise<void>;
  react?: (ctx: TContext, ref: MessageRef, emoji: string) => Promise<void>;
  parseContext: (ctx: TContext) => ParsedInput;
}
```

### Example: Simplified App Code

```typescript
// apps/telegram-bot/src/index.ts (~50 lines total)
app.post('/webhook', async (c) => {
  const env = c.env;
  const update = await c.req.json();

  // Create context from webhook
  const ctx = createTelegramContext(bot, update);
  if (!ctx) return c.json({ ok: true });

  // Get agent instance for this chat
  const agentId = env.TELEGRAM_AGENT.idFromName(String(ctx.chatId));
  const agent = env.TELEGRAM_AGENT.get(agentId);

  // Agent handles everything
  await agent.handle(ctx);

  return c.json({ ok: true });
});
```

## The Hybrid Supervisor-Worker Model

The system splits responsibilities between two complementary platforms:

- **Supervisor (Cloudflare Workflows)**: The "Brain" - handles state management, webhook ingestion, and human-in-the-loop orchestration
- **Worker (Fly.io Machines)**: The "Hands" - provides filesystem and shell primitives required by the Claude Agent SDK

This architecture solves the fundamental challenge: heavy LLM tasks need a "computer-like" environment, but we want serverless cost-efficiency.

## High-Level System Design

```
┌──────────────────────────────────────────────────────────────────┐
│                        User Interactions                          │
├────────────────┬────────────────┬──────────────┬─────────────────┤
│ GitHub @mentions│ Telegram Bot   │  CLI Tool    │ Web UI (future) │
└────────┬───────┴────────┬───────┴──────┬───────┴─────────────────┘
         │                │              │
         ▼                ▼              │
┌─────────────────────────────────────────────────────────────────┐
│        Cloudflare Workers (Tier 1 - Lightweight Agents)          │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  @duyetbot/hono-middleware (Shared)                         │ │
│  │  • Logger, error handler, rate limiting                     │ │
│  │  • Health routes (/health, /health/live, /health/ready)     │ │
│  │  • Auth middleware (webhook signatures, API keys)           │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                          │                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ github-bot   │  │ telegram-bot │  │  memory-mcp  │           │
│  │ (DO Agent)   │  │ (DO Agent)   │  │  (D1 + KV)   │           │
│  │ + Transport  │  │ + Transport  │  │              │           │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘           │
└─────────┼─────────────────┼─────────────────────────────────────┘
          │                 │
          ▼                 ▼
┌─────────────────────────────────────────────────────────────────┐
│           Workflow Supervisor (Cloudflare Durable Object)        │
│  • State machine: status, machine_id, volume_id                  │
│  • Provisions Fly.io resources                                   │
│  • Manages Human-in-the-Loop wait states                         │
│  • Can sleep for days/weeks without cost                         │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│        Agent Runner (Tier 2 - Heavy Compute, Fly.io Machine)     │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Docker Container                                          │ │
│  │  • Node.js + git + gh + ripgrep                            │ │
│  │  • Claude Agent SDK                                        │ │
│  │  • Custom tools (GitHub, Research)                         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                          │                                       │
│                          ▼                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Persistent Volume (NVMe)                                  │ │
│  │  • Session state (/root/.claude)                           │ │
│  │  • Conversation history                                    │ │
│  │  • Cloned repositories                                     │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────┬───────────────────────────────────────┘
                          │
              ┌───────────┼───────────┐
              │           │           │
              ▼           ▼           ▼
         ┌────────┐  ┌────────┐  ┌────────┐
         │ GitHub │  │Anthropic│  │  MCP   │
         │  API   │  │   API   │  │ Memory │
         └────────┘  └────────┘  └────────┘
```

## Why Hybrid? Platform Comparison

| Feature | Cloudflare Workflows Only | Fly.io Only | Hybrid Model |
|---------|---------------------------|-------------|--------------|
| Filesystem Access | ❌ None (V8 Isolate) | ✅ Full Linux | ✅ Full Linux |
| Shell Tools (git, bash) | ❌ Impossible | ✅ Native | ✅ Native |
| Long Sleep (Days) | ✅ Up to 365 days | ❌ Pay for idle | ✅ Free (Cloudflare) |
| Cold Start | ⚡ <10ms | 🐢 ~300ms-2s | 🚀 ~2s (Acceptable) |
| Cost (Idle) | 💰 Free | 💸 Expensive | 💰 Free |
| Orchestration | ✅ Built-in | ❌ DIY | ✅ Full power |

## Two-Tier Agent Architecture

The system uses two types of agents for different workloads:

### Tier 1: Cloudflare Agents (Lightweight)

Fast, serverless agents for receiving messages and quick responses:

| App | Runtime | Worker Name | Purpose |
|-----|---------|-------------|---------|
| `apps/telegram-bot` | Workers + Durable Objects | `duyetbot-telegram` | Telegram chat interface |
| `apps/github-bot` | Workers + Durable Objects | `duyetbot-github` | GitHub @mentions and webhooks |
| `apps/memory-mcp` | Workers | `duyetbot-memory-mcp` | Cross-session memory (D1 + KV) |

**Capabilities**:
- Receive and respond to messages quickly (<100ms cold start)
- Stateful sessions via Durable Objects
- Built-in SQLite storage
- **Transport Layer** for platform-specific messaging
- Can trigger Cloudflare Workflows for:
  - **Deferred tasks**: Reminders, scheduled messages, delayed actions
  - **Complex tasks**: Multi-step operations requiring Tier 2 compute

### Tier 2: Claude Agent SDK (Heavy)

Long-running agents for complex tasks requiring full compute environment:

| App | Runtime | Purpose |
|-----|---------|---------|
| `apps/agent-server` | Container (Cloudflare sandbox) | Full agent with filesystem/shell tools |

**Capabilities**:
- `child_process.spawn()` for bash/git operations
- Filesystem access for code operations
- Long-running tasks (minutes to hours)
- Triggered by Cloudflare Workflows from Tier 1 agents

**Note**: Tier 2 implementation is planned for later phases.

### Agent Flow

```
User Message → Cloudflare Agent (Tier 1) → Quick Response
                     ↓
              Task Type Detection
                     ↓
         ┌─────────────┴─────────────┐
         ↓                           ↓
   Deferred Task              Complex Task
   (Lightweight)                 (Heavy)
         ↓                           ↓
 Cloudflare Workflow         Cloudflare Workflow
   (sleep, alarm)              (provision)
         ↓                           ↓
   Execute Later          Claude Agent SDK (Tier 2)
   (same Tier 1)              Full Compute
```

**Examples**:
- `@duyetbot remind me in 10 minutes` → Lightweight Workflow (sleep) → Tier 1 sends reminder
- `@duyetbot review this PR thoroughly` → Heavy Workflow → Tier 2 with filesystem/git

**Why this separation?**
- Tier 1: Instant responses, cost-effective, edge deployment
- Lightweight Workflows: Deferred tasks without compute cost (free sleep up to 365 days)
- Tier 2: Full Linux environment for heavy tasks, billed only when running

## Claude Agent SDK Integration

The Claude Agent SDK is the **primary execution engine** running on Fly.io Machines:

```typescript
// SDK query with streaming
import { query, createDefaultOptions } from '@duyetbot/core';

const options = createDefaultOptions({
  model: 'sonnet',
  tools: [bashTool, gitTool, githubTool],
  systemPrompt: 'You are a helpful assistant.',
});

for await (const message of query('Help me review this PR', options)) {
  switch (message.type) {
    case 'assistant':
      console.log(message.content);
      break;
    case 'tool_use':
      console.log(`Using: ${message.toolName}`);
      break;
    case 'result':
      console.log(`Tokens: ${message.totalTokens}`);
      break;
  }
}
```

### Why SDK Needs Full Environment

The Claude Agent SDK requires:
- **Bash tool**: Uses `child_process.spawn` to run shell commands
- **Git operations**: Native git for cloning, diffing, committing
- **Filesystem tools**: grep, find, read, write operations

These are impossible in Cloudflare Workers' V8 isolates.

## Volume-as-Session Pattern

The SDK relies on local filesystem for session state. We solve this with persistent volumes:

```
Volume Creation:
  PR #123 opened → Create vol_duyetbot_pr_123

Mount on Run:
  Machine boots → Mount volume to /root/.claude

Session Persistence:
  SDK writes → Actually writes to NVMe volume
  Machine dies → Data survives

Resume:
  Next webhook → New machine, same volume
  SDK boots → Finds existing state, resumes context
```

This enables multi-day conversations without complex database serialization.

## Component Architecture

### 1. Ingress Worker (Cloudflare)

Public entry point for webhooks:
- Validates `X-Hub-Signature-256`
- Routes events to appropriate Workflow
- Maps PR ID → Workflow Instance ID

### 2. Workflow Supervisor (Cloudflare Durable Object)

State machine managing agent lifecycle:
- **State**: `status`, `fly_machine_id`, `fly_volume_id`, `last_activity`
- **Provisions**: Creates Fly.io volumes and machines
- **Waits**: Uses `step.wait_for_event()` for HITL (free while waiting)
- **Cleanup**: Destroys resources when PR closes

### 3. Agent Runner (Fly.io Machine)

Docker container with full environment:
- **Image**: Node.js 20, git, gh CLI, ripgrep
- **Runtime**: Mounts volume, runs SDK, streams logs
- **Output**: Updates GitHub Checks API in real-time

## Human-in-the-Loop via GitHub Checks API

For tasks requiring human approval:

```
1. Agent Decision
   → Agent reaches decision point requiring approval

2. Check Update
   → Status: completed, Conclusion: action_required
   → Actions: [{ label: "Approve Fix", identifier: "approve" }]

3. Workflow Sleep
   → Runner exits
   → Supervisor calls step.wait_for_event('requested_action')

4. User Clicks Button
   → GitHub sends check_run.requested_action webhook

5. Resume
   → Workflow wakes, provisions new machine
   → Agent resumes with user's decision
```

This allows the bot to wait days/weeks for user input without cost.

## Data Flow: PR Review

```
1. GitHub webhook (pull_request.opened)
   ↓
2. Ingress Worker validates signature
   ↓
3. Workflow Supervisor receives event
   ↓
4. Supervisor provisions:
   • Creates Fly.io Volume (vol_pr_123)
   • Starts Fly.io Machine with volume mounted
   ↓
5. Agent Runner boots (~2s)
   • Mounts /root/.claude to volume
   • Creates GitHub Check Run (in_progress)
   ↓
6. Claude Agent SDK executes:
   • Clones repository
   • Analyzes diff
   • Runs tests if needed
   • Streams progress to Check Run
   ↓
7. Agent completes or requests input
   • Posts review comments
   • Updates Check Run (success/action_required)
   ↓
8. Machine stops, volume persists
   ↓
9. Supervisor sleeps (if awaiting input)
```

## Key Architectural Decisions

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Orchestration** | Cloudflare Workflows | Durable execution, free sleep, built-in retries |
| **Compute** | Fly.io Machines | Full Linux, fast boot, API-driven lifecycle |
| **State** | Fly.io Volumes | SDK requires filesystem, NVMe performance |
| **Agent Engine** | Claude Agent SDK | Battle-tested, maintained by Anthropic |
| **Feedback** | GitHub Checks API | Real-time streaming, action_required support |
| **Memory** | MCP Server (CF Workers) | Cross-session search, user isolation |
| **Messaging** | Transport Layer | Platform abstraction, simplified apps |

## Cost Model

### Scenario: 100 PRs/month, 10 min avg active time

| Component | Calculation | Cost |
|-----------|-------------|------|
| Fly.io Compute | 60,000s × $0.000011/s | $0.66 |
| Fly.io Storage | 100 PRs × 1GB × 5 days | $2.50 |
| Cloudflare | Mostly routing | ~$0.50 |
| **Total** | | **~$3.66/mo** |

Compare to always-on containers: **~$58/mo** (2× machines)

## Security

### Authentication
- Fly API token in Cloudflare secrets
- Single-use callback tokens for Runner → Supervisor
- GitHub webhook signature validation

### Networking
- Fly Machines use private IPv6 (no public IP)
- Communication via public APIs (GitHub, Cloudflare)
- Flycast for internal-only services

### Volume Cleanup
- Janitor Workflow runs daily via Cron
- Cross-references volumes with PR status
- Deletes orphaned volumes

## Packages & Components

### Core (`packages/core`)
- SDK adapter layer (`sdk/`)
- Session management
- MCP client
- Used by agent-server (Claude Agent SDK)

### Chat Agent (`packages/chat-agent`)
Reusable chat agent abstraction for Workers with Transport Layer support:
- `Transport<TContext>` - Platform-agnostic messaging interface
- `ChatAgent.handle(ctx)` - Main entry point for handling messages
- `ParsedInput` - Normalized input from any platform
- `CloudflareAgentAdapter` - Adapter for Cloudflare Agents SDK
- `createChatAgent()` - Factory for creating agents
- Provider-agnostic (OpenRouter, Anthropic via AI Gateway)
- Built-in conversation history management
- Lifecycle hooks (`beforeHandle`, `afterHandle`, `onError`)

### Hono Middleware (`packages/hono-middleware`)
Shared Hono middleware for all Cloudflare Workers apps:
- `createBaseApp()` - Factory for creating Hono apps with standard middleware
- Request logger with unique request IDs
- Error handler with consistent JSON responses
- Health check routes (`/health`, `/health/live`, `/health/ready`)
- Rate limiting middleware
- Auth middleware (Bearer, API key, webhook signature)

### Prompts (`packages/prompts`)
Shared system prompts as markdown files:
- `prompts/telegram.md` - Telegram bot personality
- `prompts/github.md` - GitHub bot personality
- `prompts/default.md` - Base prompt fragments
- `loadPrompt()` - Async prompt loader
- `TELEGRAM_SYSTEM_PROMPT`, `GITHUB_SYSTEM_PROMPT` - Pre-loaded exports

### Tools (`packages/tools`)
Built-in tools (SDK-compatible):
- `bash` - Shell execution
- `git` - Repository operations
- `github` - API operations
- `research` - Web research
- `plan` - Task planning

### Providers (`packages/providers`)
LLM provider abstractions:
- Claude provider with base URL override (Z.AI support)
- OpenRouter provider
- Provider factory with configuration

### Telegram Bot (`apps/telegram-bot`)
Cloudflare Agents SDK with Durable Objects:
- `TelegramAgent` class extending `Agent`
- `telegramTransport` - Telegram-specific Transport implementation
- Built-in state for conversation history
- MCP client for memory-mcp connection
- Uses `@duyetbot/hono-middleware` for shared routes
- Deploy: `wrangler deploy` → `duyetbot-telegram`

### GitHub Bot (`apps/github-bot`)
Cloudflare Agents SDK with Durable Objects:
- `GitHubAgent` class extending `Agent`
- `githubTransport` - GitHub-specific Transport implementation
- GitHub MCP for API operations
- duyet-mcp for knowledge base
- Uses `@duyetbot/hono-middleware` for shared routes
- Deploy: `wrangler deploy` → `duyetbot-github`

### Memory MCP (`apps/memory-mcp`)
Cloudflare Workers for cross-session memory:
- D1 - Metadata, users
- KV - Message history
- Vectorize - Semantic search (future)
- Deploy: `wrangler deploy` → `duyetbot-memory-mcp`

### CLI (`packages/cli`)
Local development and testing:
- Embeds SDK directly
- File-based or MCP storage

## Environment Configuration

```env
# LLM Provider
ANTHROPIC_API_KEY=sk-ant-xxx
ANTHROPIC_BASE_URL=https://api.anthropic.com

# GitHub
GITHUB_TOKEN=ghp_xxx
WEBHOOK_SECRET=xxx
BOT_USERNAME=duyetbot

# Fly.io (for Supervisor)
FLY_API_TOKEN=xxx
FLY_ORG=personal

# MCP Memory (optional)
MCP_SERVER_URL=https://memory.duyetbot.workers.dev
```

## Deployment

See [Deployment Guide](deploy.md) for component-specific instructions:
- [GitHub Bot](deployment/github-bot.md) - Webhook handler
- [Telegram Bot](deployment/telegram-bot.md) - Chat interface
- [Memory MCP](deployment/memory-mcp.md) - Session persistence
- [Agent Server](deployment/agent-server.md) - Long-running server
- [Cloudflare Agents](deployment/cloudflare-agents.md) - Stateful serverless

## Next Steps

- [Getting Started](getting-started.md) - Installation and quick start
- [Use Cases](usecases.md) - Common workflows
- [Report Issues](https://github.com/duyet/duyetbot-agent/issues)
