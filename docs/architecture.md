---
title: Architecture
description: System design overview of duyetbot-agent's loop-based agent architecture with Cloudflare Workers and Durable Objects.
---

**Table of Contents**: [System Overview](#system-overview) | [Loop-Based Architecture](#loop-based-architecture) | [Message Flow](#message-flow) | [Core Modules](#core-modules) | [Tool System](#tool-system) | [Package Architecture](#package-architecture) | [Transport Layer](#transport-layer) | [Error Handling](#error-handling) | [Deployment](#deployment)

---

## System Overview

**duyetbot-agent** is a personal AI agent system built on Cloudflare Workers + Durable Objects. It uses a loop-based agent pattern with tool iterations for intelligent task execution across Telegram and GitHub platforms.

### Architecture Diagram

```
+---------------------------------------------------------------------+
|                          Cloudflare Workers (Edge)                  |
|                                                                     |
|  +----------------------------------------------------------+       |
|  | HTTP Handlers (Webhook Entry Points)                   |       |
|  |  +-------------------+  +-------------------+  +--------+       |
|  |  | Telegram Webhook |  |  GitHub Webhook   |  | Health |       |
|  |  | /webhook POST    |  | /webhook POST     |  |/health |       |
|  |  +-------------------+  +-------------------+  +--------+       |
|  |         |                       |                          |       |
|  |         +-----------------------+--------------------------+       |
|  |                                 |                              |       |
|  |                       Parse & Validate                       |       |
|  |                     (auth, signature, dedup)                 |       |
|  |                                 |                              |       |
|  |                                 v                              |       |
|  |                       +-------------------+                    |       |
|  |                       |CloudflareChatAgent|                    |       |
|  |                       |     (DO)          |                    |       |
|  |                       |                   |                    |       |
|  |                       | • Chat Loop       |                    |       |
|  |                       | • Tool Executor   |                    |       |
|  |                       | • Token Tracker   |                    |       |
|  |                       | • Message Store   |                    |       |
|  |                       +-------------------+                    |       |
|  |                                                              |       |
|  |                       +-----------------------------+        |       |
|  |                       | Memory MCP Server (D1+KV)  |        |       |
|  |                       | • Cross-session memory     |        |       |
|  |                       | • User isolation           |        |       |
|  |                       | • Semantic search (future) |        |       |
|  |                       +-----------------------------+        |       |
|  +----------------------------------------------------------+       |
|                                                                     |
|                          External Integrations:                      |
|                          • OpenRouter API (via AI Gateway)          |
|                          • GitHub API (webhooks + REST)             |
|                          • Telegram Bot API (webhooks + REST)       |
|                          • MCP Servers (duyet-mcp, github-mcp, etc.)|
+---------------------------------------------------------------------+
```

### Key Design Principles

```
1. Loop-Based Agent Pattern
   +- Single agent with LLM reasoning loop
   +- Tool iterations until task completion
   +- Real-time progress updates to user

2. Modular Components
   +- chat/ module: Chat loop, tool executor, context builder
   +- tracking/ module: Token tracker, execution logger
   +- persistence/ module: Message store, session manager

3. Transport Abstraction
   +- Platform-agnostic agent logic
   +- Pluggable platform transports
   +- Reduced per-app code (~50 lines)

4. Built-in + MCP Tools
   +- Built-in tools: bash, git, github, research, plan
   +- MCP integration: duyet-mcp, github-mcp
   +- Unified tool execution interface

5. Token & Cost Tracking
   +- Real-time token usage tracking
   +- Cost calculation per session
   +- Stored in D1 for analytics
```

---

## Loop-Based Agent Architecture

The system uses a single agent pattern with an LLM reasoning loop. This replaced the previous multi-agent routing system (~8000 LOC deleted), providing simpler architecture, real-time updates, and unified conversation context.

### CloudflareChatAgent

Single Durable Object implementation created via `createCloudflareChatAgent()`:

```
User Message → CloudflareChatAgent (DO)
                      │
                      ▼
              ┌──────────────┐
              │   Chat Loop  │ ◄─── LLM Provider (OpenRouter)
              │              │
              │  ┌────────┐  │
              │  │ Tools  │  │ ◄─── Built-in + MCP tools
              │  └────────┘  │
              │              │
              │  ┌────────┐  │
              │  │ Track  │  │ ◄─── Token/step tracking → D1
              │  └────────┘  │
              └──────────────┘
                      │
                      ▼
              Transport Layer → Platform (Telegram/GitHub)
```

### Benefits Over Multi-Agent System

| Aspect | Old (Multi-Agent) | New (Loop-Based) |
|--------|-------------------|------------------|
| **Architecture** | 8 agents + routing | 1 agent + tools |
| **Code Size** | ~8000+ LOC | ~2000 LOC |
| **Real-time Updates** | Lost in routing | Every tool iteration |
| **Debugging** | Cross-agent traces | Single execution thread |
| **Context** | Fragmented per agent | Unified conversation |
| **Maintenance** | Complex routing logic | Simple tool interface |
| **Test Count** | 1420+ tests | 969 tests (simpler) |

---

## Message Flow: Webhook to Response

### Complete Execution Timeline

```
User Sends Message
      |
      v
+------------------------------+
| Webhook Ingestion (T+0-50ms) |
+------------------------------+
|                              |
| T+0ms:  POST /webhook recv   |
| T+1ms:  Middleware validate  |
|   +- Signature verification  |
|   +- JSON parse              |
|   +- Authorization check     |
|                              |
| T+2ms:  Request ID generate  |
|   +- For trace correlation   |
|                              |
| T+3ms:  Get/create DO        |
|   +- env.ChatAgent.get()     |
|                              |
| T+4ms:  Send message         |
|   +- agent.chat(message)     |
|   +- Non-blocking call       |
|                              |
| T+50ms: Return HTTP 200 OK   |
|   +- Webhook complete!       |
|                              |
+------------------------------+
                      |
        Webhook exits here,
           DO continues independently
                      |
                      v
+-------------------------------------+
| Chat Loop Execution (T+50ms-30s)   |
+-------------------------------------+
|                                     |
| T+51ms: Parse user message          |
|   +- Extract text, context          |
|   +- Load conversation history      |
|                                     |
| T+52ms: Send typing indicator       |
|   +- User sees "typing..."          |
|                                     |
| T+53ms: Send thinking message       |
|   +- Text: "Thinking..."            |
|   +- Get messageRef for edits       |
|                                     |
| T+54ms: Start chat loop             |
|   +- Build context with history     |
|   +- Call LLM with tools            |
|                                     |
| T+100-5000ms: Tool iterations       |
|   +- LLM generates response         |
|   +- If tool_use:                   |
|   |  +- Execute tool                |
|   |  +- Update thinking message     |
|   |  +- Feed result back to LLM     |
|   +- Repeat until completion        |
|                                     |
| T+5001ms: Edit thinking message     |
|   +- Replace with final response    |
|   +- User sees answer               |
|                                     |
| T+5002ms: Store message             |
|   +- Save to conversation history   |
|   +- Track token usage              |
|   +- Log execution steps            |
|                                     |
+-------------------------------------+
```

### Chat Loop Pattern

The agent uses a continuous loop with tool iterations:

```
chat(message)
    │
    ├─ Load conversation history
    ├─ Build context with system prompt
    │
    └─ while (needs_tool_use):
        │
        ├─ Call LLM with available tools
        │  +- Returns response + optional tool calls
        │
        ├─ If tool_use detected:
        │  ├─ Update user: "🔧 Running {tool}..."
        │  ├─ Execute tool (built-in or MCP)
        │  ├─ Collect tool results
        │  └─ Feed results back to LLM
        │
        └─ If no tool_use:
           ├─ Extract final response
           ├─ Update user with answer
           └─ Exit loop
```

---

## Core Modules

The agent is composed of modular components in `@duyetbot/cloudflare-agent`:

### Chat Module (`chat/`)

| File | Purpose | Key Functions |
|------|---------|---------------|
| `chat-loop.ts` | Main LLM reasoning loop | `runChatLoop()`, tool iteration control |
| `tool-executor.ts` | Unified tool execution | `executeTools()`, built-in + MCP support |
| `context-builder.ts` | Build conversation context | `buildContext()`, history management |
| `response-handler.ts` | Process LLM responses | `handleResponse()`, extract tool calls |

### Tracking Module (`tracking/`)

| File | Purpose | Key Functions |
|------|---------|---------------|
| `token-tracker.ts` | Token usage tracking | `trackTokens()`, cost calculation |
| `execution-logger.ts` | Log execution steps | `logStep()`, debug footer generation |

### Persistence Module (`persistence/`)

| File | Purpose | Key Functions |
|------|---------|---------------|
| `message-persistence.ts` | Message store interface | `MessageStore` implementations |
| `d1-persistence.ts` | D1 database storage | Async persistence to D1 |
| `memory-persistence.ts` | In-memory storage | Fast in-DO storage |

### Workflow Module (`workflow/`)

| File | Purpose | Key Functions |
|------|---------|---------------|
| `step-tracker.ts` | Track execution steps | Record tool calls and results |
| `debug-footer.ts` | Debug information | Generate execution summary |

---

## Tool System

The agent has access to built-in and MCP-based tools, all executed through a unified interface.

### Built-in Tools

From `@duyetbot/tools` package:

| Tool | Purpose | Example Usage |
|------|---------|---------------|
| `bash` | Execute shell commands | Run scripts, file operations |
| `git` | Git operations | Clone repos, create commits |
| `github` | GitHub API operations | Create issues, merge PRs |
| `research` | Web search and synthesis | Find information, summarize |
| `plan` | Task planning | Break down complex tasks |

### MCP Tools

Dynamically discovered from connected MCP servers:

| Server | Tools | Purpose |
|--------|-------|---------|
| `duyet-mcp` | Blog queries, personal info | Answer questions about blog posts |
| `github-mcp` | Advanced GitHub ops | Repository management |
| Custom servers | User-defined | Extend functionality |

### Tool Execution Flow

```
LLM requests tool_use
      │
      ▼
toolExecutor.executeTools(toolCalls)
      │
      ├─ For each tool call:
      │  │
      │  ├─ Check if built-in tool
      │  │  └─ Yes: Execute directly
      │  │
      │  └─ Check if MCP tool
      │     └─ Yes: Call MCP server
      │
      ▼
Return results to LLM
```

---

## Package Architecture

### Monorepo Structure

```
Foundation Layer
+- @duyetbot/types
   +- Agent, Tool, Message types
   +- Provider interface
   +- Shared Zod schemas

   Intermediate Layer
   +- @duyetbot/providers
   |  +- OpenRouter adapter (via AI Gateway)
   |  +- Provider factory
   |
   +- @duyetbot/tools
   |  +- bash, git, github tools
   |  +- research, plan tools
   |  +- Tool registry
   |
   +- @duyetbot/prompts
   |  +- Telegram prompt
   |  +- GitHub prompt
   |  +- System prompts
   |
   +- @duyetbot/hono-middleware
      +- Logger middleware
      +- Auth middleware
      +- Health routes

      Core Business Layer
      +- @duyetbot/core
         +- SDK adapter (query())
         +- Session manager
         +- MCP client

         +- @duyetbot/cloudflare-agent
            +- CloudflareChatAgent factory
            +- Chat loop implementation
            +- Tool executor
            +- Token tracker
            +- Message persistence
            +- Transport interface

Application Layer
+- apps/telegram-bot
|  +- Telegram transport + webhook handler
|
+- apps/github-bot
|  +- GitHub transport + webhook handler
|
+- apps/memory-mcp
   +- MCP server (D1 + KV)

Support Packages
+- @duyetbot/cli
|  +- Local chat CLI
|
+- @duyetbot/config-*
   +- Build configs
```

### Dependency Graph

```
          @duyetbot/types
                 v
    +--------+---+---+--------+
    |        |   |   |        |
 @duyetbot/@duyetbot/@duyetbot/
 providers  tools   prompts
    |        |   |   |        |
    +--------+---+---+--------+
             v
       @duyetbot/core
             v
      @duyetbot/cloudflare-agent
             v
    +---+---+---+
    |   |   |   |
telegram github memo
 -bot  -bot  -mcp
```

### Package Responsibilities

```
@duyetbot/cloudflare-agent (969 tests)
+- CloudflareChatAgent factory
+- Chat loop with tool iterations
+- Tool execution (built-in + MCP)
+- Token tracking and cost calculation
+- Message persistence (D1 + in-memory)
+- Transport interface
+- Debug footer generation

@duyetbot/core (32 tests)
+- SDK adapter: query() async generator
+- Tool execution wrapper
+- Session manager interface
+- MCP client

@duyetbot/tools (24 tests)
+- bash tool (exec shell commands)
+- git tool (git operations)
+- github tool (GitHub API)
+- research tool (web search)
+- plan tool (task planning)

@duyetbot/providers (0 tests)
+- OpenRouter provider via AI Gateway
+- Provider factory
+- Base URL override support

@duyetbot/prompts (18 tests)
+- Telegram bot personality
+- GitHub bot personality
+- System prompts
+- Prompt builder (template system)
```

---

## Transport Layer Pattern

The **Transport Layer** enables clean separation between platform-specific and agent logic.

### Transport Interface

```typescript
interface Transport<TContext> {
  // Send message, get reference for edits
  send(ctx: TContext, text: string): Promise<MessageRef>;

  // Edit existing message (for streaming updates)
  edit?(ctx: TContext, ref: MessageRef, text: string): Promise<void>;

  // Delete message
  delete?(ctx: TContext, ref: MessageRef): Promise<void>;

  // Show typing indicator
  typing?(ctx: TContext): Promise<void>;

  // Add emoji reaction
  react?(ctx: TContext, ref: MessageRef, emoji: string): Promise<void>;

  // Extract normalized input from platform context
  parseContext(ctx: TContext): ParsedInput;
}

interface ParsedInput {
  text: string;
  userId: string | number;
  chatId: string | number;
  messageRef?: string | number;
  metadata?: Record<string, unknown>;
}
```

### Telegram Transport

```
telegram-bot/src/transport.ts

send(ctx: TelegramContext, text: string)
+- Split message if > 4096 chars
|  +- Split at newlines (respect formatting)
|  +- Send multiple messages if needed
+- Try Markdown parse mode
+- Fallback to plain text if formatting fails
+- Return message_id for edits

edit(ctx: TelegramContext, messageId, text)
+- Check message length
|  +- If >4096: truncate + "..."
|  +- Otherwise: send as-is
+- Retry on conflict (message deleted)
+- Log admin debug footer (if admin user)

typing(ctx: TelegramContext)
+- sendChatAction(chatId, 'typing')
+- User sees "typing..." indicator

parseContext(webhookContext)
+- Extract text
+- Extract user ID, chat ID
+- Generate request ID
+- Return normalized ParsedInput
```

### GitHub Transport

```
github-bot/src/transport.ts

send(ctx: GitHubContext, text: string)
+- Create comment on issue/PR
+- Include context header:
|  +- Issue/PR URL
|  +- State (open/closed)
|  +- Labels
+- Return comment.id for edits

edit(ctx: GitHubContext, commentId, text)
+- Update comment via Octokit
+- Preserve formatting
+- Return void

react(ctx: GitHubContext, commentId, emoji)
+- Add emoji reaction to comment
+- Use GitHub API reactions endpoint
+- Return void

parseContext(webhookPayload)
+- Extract issue/PR metadata
+- Extract sender info
+- Include full context (title, labels, etc.)
+- Return normalized ParsedInput
```

### Benefits

| Aspect | Without Transport | With Transport |
|--------|---|---|
| **App boilerplate** | ~300 lines | ~50 lines |
| **Duplicate logic** | Across apps | None |
| **New platform** | Copy entire app | Just add transport |
| **Testing** | Hard (mixed concerns) | Easy (mock transport) |
| **Hooks** | Per-app | Configurable |

---

## Error Handling & Recovery

### Tool Execution Errors

```
Tool Error (during execution)
    +- Catch error
    +- Log with tool context
    +- Return error to LLM
    +- LLM decides next step
    +- User sees partial results
```

### LLM Errors

```
LLM Error (during chat)
    +- Catch error
    +- Log with conversation context
    +- Send error message to user
    +- Clear processing state
    +- Ready for next message
```

### DO Crash/Timeout

```
DO Crash/Timeout
    +- Webhook resends message
    +- New DO invocation
    +- Load conversation from storage
    +- Resume chat loop
```

### Recovery Mechanisms

```
Graceful Degradation
    +- Tool failure → Continue with other tools
    +- MCP server down → Skip MCP tools
    +- LLM timeout → Send partial response
    +- Storage error → Use in-memory fallback
```

---

## Durable Object State Management

### State Schema

```typescript
interface CloudflareAgentState {
  // Session identity
  userId?: string | number;
  chatId?: string | number;
  createdAt: number;
  updatedAt: number;

  // Conversation context
  messages: Message[];  // Trimmed to maxHistory (20-100)

  // Token tracking
  totalTokens?: number;
  totalCost?: number;

  // Custom data
  metadata?: Record<string, unknown>;
}
```

### State Persistence

```
Durable Object Storage (Automatic)
    +- Transactional writes
    +- Geographically replicated
    +- Auto-backup on failure
    +- Survives worker restart

On setState(newState):
    +- State validated
    +- Persisted atomically
    +- Available immediately on next request
    +- Replicated globally

Benefits:
    +- No separate database needed
    +- Sub-millisecond access
    +- Transactional guarantees
    +- Free (included in Cloudflare)
```

---

## Deployment Architecture

### Application Deployment

```bash
# Deploy all workers
bun run deploy

# Deploy individual apps
bun run deploy:telegram  # Telegram bot
bun run deploy:github    # GitHub bot

# CI deployment (single app)
bun run ci:deploy:telegram
bun run ci:deploy:github
```

### Wrangler Configuration

```toml
# apps/telegram-bot/wrangler.toml

name = "duyetbot-telegram"
main = "src/index.ts"
compatibility_date = "2024-11-01"

[[durable_objects.bindings]]
name = "ChatAgent"
class_name = "CloudflareChatAgent"

[env.production]
routes = [
  { pattern = "telegram.duyetbot.workers.dev/*", zone_name = "duyetbot.com" }
]
```

### Environment Variables

```
OPENROUTER_API_KEY     # OpenRouter API key
AI_GATEWAY_BASE_URL    # Cloudflare AI Gateway endpoint
TELEGRAM_BOT_TOKEN     # Telegram bot token (secret)
GITHUB_TOKEN           # GitHub PAT (secret)
GITHUB_WEBHOOK_SECRET  # GitHub webhook verification (secret)
```

---

## Metrics & Monitoring

### Key Metrics to Track

```
Processing Latency
+- P50, P95, P99 response times
+- Tool execution duration
+- LLM call duration

Token Usage
+- Tokens per message
+- Cost per session
+- Total usage trends

Tool Performance
+- Success rate by tool
+- Error rate by tool
+- Execution time by tool

System Health
+- DO invocation success rate
+- Tool execution errors
+- LLM error rate
```

### Logging Pattern

```typescript
logger.info('[CHAT] Tool execution', {
  queryId,           // Trace correlation ID
  tool: 'github',
  duration: 125,
  success: true,
  userId,
  timestamp: Date.now(),
});

logger.warn('[TOOL] Execution failed', {
  tool: 'bash',
  error: error.message,
  retryable: false,
});

logger.error('[LLM] Call failed', {
  queryId,
  error: error.message,
  retryable: true,
  attempts: 1,
});
```

---

## Key Architectural Insights

```
* Insight: Loop-Based Simplicity
+- Single agent replaces 8 specialized agents
+- Tools replace agent routing logic
+- ~8000 LOC removed, architecture simplified
+- Easier to understand, debug, and maintain

* Insight: Real-Time Progress
+- Every tool iteration updates user
+- "Thinking..." → "Running tool..." → "Result"
+- Previous multi-agent system lost updates in routing
+- Better user experience and transparency

* Insight: Transport Abstraction
+- ~50 lines of transport per app
+- ~2000 lines of agent logic (reused)
+- Platform changes = transport change only
+- Enables rapid platform onboarding

* Insight: Unified Tool Execution
+- Built-in and MCP tools use same interface
+- LLM doesn't know the difference
+- Easy to add new tools or MCP servers
+- Consistent error handling and logging

* Insight: Token Tracking
+- Real-time tracking during chat loop
+- Cost calculation per session
+- Stored in D1 for analytics
+- Enables usage optimization
```

---

## Quick Reference

- **Package Dependency Graph**: See [Package Architecture](#package-architecture)
- **Message Flow Timing**: See [Message Flow](#message-flow) (T+0ms to T+5002ms)
- **Tool System**: See [Tool System](#tool-system)
- **Deployment**: See [Deployment Architecture](#deployment-architecture)
- **Implementation Status**: See `PLAN.md`

---

## External References

- **Model Context Protocol**: https://modelcontextprotocol.io/
- **Cloudflare Workers**: https://developers.cloudflare.com/workers/
- **Cloudflare Durable Objects**: https://developers.cloudflare.com/durable-objects/
- **OpenRouter API**: https://openrouter.ai/docs
- **Telegram Bot API**: https://core.telegram.org/bots/api
- **GitHub Webhooks**: https://docs.github.com/en/developers/webhooks-and-events/webhooks
