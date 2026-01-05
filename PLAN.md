# duyetbot-agent Implementation Status

## Overview

**duyetbot-agent** is a personal AI agent system built on Cloudflare Workers + Durable Objects, implementing a loop-based agent architecture with tool iterations for GitHub integration (@duyetbot mentions) and Telegram chat.

### Core Capabilities

- 🤖 **GitHub Integration**: Respond to @duyetbot mentions, manage issues/PRs, automated reviews
- 💬 **Telegram Bot**: Chat interface for quick queries and notifications
- 🧠 **Persistent Memory**: MCP-based memory server on Cloudflare Workers (D1 + KV)
- 🛠️ **LLM Provider**: OpenRouter SDK via Cloudflare AI Gateway
- 📦 **Monorepo**: Separated packages for core, tools, CLI, MCP, bots
- 🔄 **Loop-Based Agent**: Single agent with LLM reasoning loop and tool iterations
- 🔧 **Tool System**: Built-in tools (bash, git, github, research, plan) + MCP integration
- 💻 **CLI Support**: Local execution with optional cloud memory access

## Current Architecture ✅ DEPLOYED

### Deployment Model

```
┌──────────────────────────────────────────────────────────────────┐
│                     Cloudflare Workers                           │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Telegram Bot + GitHub Bot (HTTP Handlers)              │   │
│  │  • Webhook receivers                                    │   │
│  │  • Context parsing                                      │   │
│  │  • ~50 lines per app                                    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  CloudflareChatAgent (Durable Object)                   │   │
│  │                                                          │   │
│  │  • Chat Loop (LLM reasoning with tool iterations)       │   │
│  │  • Tool Executor (built-in + MCP tools)                 │   │
│  │  • Token Tracker (usage + cost tracking)                │   │
│  │  • Message Store (conversation history)                 │   │
│  │  • Transport Layer (platform abstraction)               │   │
│  │                                                          │   │
│  │  State Management:                                      │   │
│  │  • Conversation history (trimmed to max)                │   │
│  │  • Token usage and cost tracking                        │   │
│  │  • Execution steps for debugging                        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Memory MCP Server (D1 + KV)                            │   │
│  │  • Cross-session memory                                 │   │
│  │  • User isolation                                       │   │
│  │  • Semantic search (future: Vectorize)                  │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┼─────────────┐
                │             │             │
                ▼             ▼             ▼
         ┌────────────┐ ┌──────────┐ ┌────────────┐
         │   GitHub   │ │OpenRouter│ │ MCP Servers│
         │    API     │ │   API    │ │ (optional) │
         └────────────┘ └──────────┘ └────────────┘
```

### Why Cloudflare Workers + Durable Objects?

| Feature | Workers | Durable Objects | Benefit |
|---------|---------|-----------------|---------|
| **Cold Start** | <10ms | <5ms | Real-time responses |
| **Persistent State** | ❌ Stateless | ✅ Built-in SQLite | Session management |
| **Cost (Idle)** | 💰 Free | ✅ Free | No idle costs |
| **Scalability** | ✅ Global edge | ✅ Sharded globally | Automatic scaling |
| **Message Batching** | ✅ Via alarms | ✅ Via alarms | Reduce LLM calls |

### Key Architectural Components

| Component | Purpose | Status |
|-----------|---------|--------|
| **CloudflareChatAgent** | Loop-based agent with tool iterations | ✅ Deployed |
| **Chat Loop** | LLM reasoning loop with tool execution | ✅ Deployed |
| **Tool Executor** | Unified built-in + MCP tool execution | ✅ Deployed |
| **Token Tracker** | Real-time usage and cost tracking | ✅ Deployed |
| **Message Store** | Conversation history persistence | ✅ Deployed |
| **Transport Layer** | Platform abstraction (Telegram/GitHub) | ✅ Deployed |
| **Memory MCP Server** | Cross-session persistence | ✅ Deployed |

---

## Message Flow: From Webhook to Response

### Complete Timing Sequence

```
T+0ms:     User sends Telegram message
T+1ms:     POST /webhook received
T+2ms:     Middleware validation (auth, signature, parse)
T+3ms:     Deduplication check (requestId)
T+4ms:     TelegramAgent.queueMessage() adds to pendingBatch
T+5ms:     Schedule alarm: onBatchAlarm() after 500ms
T+6ms:     HTTP 200 OK returned to Telegram
           ✓ Webhook complete, DO continues independently

T+506ms:   onBatchAlarm() fires
T+507ms:   Atomic: pendingBatch → activeBatch (processing)
T+508ms:   Clear pendingBatch (ready for new messages)
T+509ms:   Send typing indicator
T+510ms:   Send "Thinking 🧠" message, get messageRef
T+511ms:   Start rotation: edit message every 5s
           (Each edit updates lastHeartbeat timestamp)

T+512ms:   Routing decision via shouldRoute()
           ├─ YES: scheduleRouting() to RouterAgent
           │       (Fire-and-forget, returns immediately)
           └─ NO: Direct chat() with LLM

T+513-5000ms: LLM execution / RouterAgent processing
             • Hybrid classifier analyzes query
             • Route to appropriate agent
             • Execute tools if needed
             • Compile response

T+5001ms:  Edit thinking message with final response
T+5002ms:  Mark activeBatch.status = 'completed'
T+5003ms:  Clear activeBatch (ready for next batch)

RESULT:    User sees response ~5 seconds after webhook
           Thinking message updates every 5s prove DO is alive
```

### Fire-and-Forget Pattern

The webhook returns immediately, allowing the Durable Object to run independently:

```
✅ CORRECT Pattern:
app.post('/webhook', async (c) => {
  const ctx = createTelegramContext(...);
  const agent = getChatAgent(env.TelegramAgent, agentId);

  // Fire-and-forget: DO runs with its own timeout
  agent.queueMessage(ctx).catch(() => {});

  // Return immediately
  return c.json({ ok: true });
});

Why NOT waitUntil() or await?
- Webhook has 30s IoContext timeout
- If DO takes >30s, entire context cancelled
- Worker and user both get nothing

Better approach:
- DO has independent 30s timeout
- Webhook returns in <100ms
- DO can process for full duration
- Error isolation (one doesn't affect the other)
```

---

## Loop-Based Agent Architecture ✅ REFACTORED

**Date**: December 2024
**Status**: COMPLETE - Multi-agent routing system removed (~8000+ LOC deleted)

The system now uses a single loop-based agent pattern instead of the previous multi-agent routing architecture.

### What Changed

**Before (Multi-Agent System)**:
- 8 specialized Durable Objects (RouterAgent, SimpleAgent, OrchestratorAgent, HITLAgent, CodeWorker, ResearchWorker, GitHubWorker, DuyetInfoAgent)
- Complex routing logic with hybrid classification
- shared-agents app for shared DO pool
- ~8000+ LOC for routing and orchestration
- 1420+ tests

**After (Loop-Based System)**:
- Single CloudflareChatAgent with chat loop
- Built-in tools + MCP integration
- Tool-based approach (plan, bash, git, github, research tools)
- ~2000 LOC for agent logic
- 969 tests (simpler architecture)

### Benefits

| Aspect | Improvement |
|--------|-------------|
| **Code Complexity** | 75% reduction in LOC |
| **Test Count** | 32% reduction (simpler to test) |
| **Real-time Updates** | Every tool iteration (vs. lost in routing) |
| **Debugging** | Single execution thread (vs. cross-agent traces) |
| **Maintenance** | Simple tool interface (vs. complex routing) |
| **Context** | Unified conversation (vs. fragmented) |

### Tool System

The chat loop uses tools instead of specialized agents. Tools are now **Claude Code-style** for powerful agent capabilities:

```
Built-in Tools (from @duyetbot/tools):

Core Tools:
├─ bash: Execute shell commands (with description, timeout up to 10min)
├─ git: Git operations
├─ github: GitHub API operations
├─ research: Web search and synthesis
└─ plan: Task planning and decomposition

Claude Code-Style Tools (NEW):
├─ glob: Fast file pattern matching (**/*.ts, src/**/*.tsx)
├─ grep: Regex code search with context lines (-A/-B/-C)
├─ read_file: Read with line numbers (cat -n), offset/limit
├─ write_file: Write with directory creation
├─ edit_file: Unique match required (safer edits)
├─ todo_write: Task tracking (pending/in_progress/completed)
├─ todo_read: Read current todo list
├─ ask_user: Interactive clarification with options
└─ web_fetch: URL content retrieval with HTML-to-markdown

Configuration:
├─ maxToolIterations: 25 (up from 5, for complex tasks)
└─ Tools sorted by priority in getAllBuiltinTools()

MCP Tools (dynamically discovered):
├─ duyet-mcp: Personal blog/info queries
├─ github-mcp: Advanced GitHub operations
└─ Custom MCP servers as needed
```

### Migration Notes

- All legacy agents removed from `packages/cloudflare-agent/src/`
- `apps/shared-agents` deleted entirely
- Routing infrastructure (routing/, orchestration/, workers/, hitl/, context/, execution/) removed
- Transport layer pattern preserved (platform abstraction still works)

---

## Chat Loop Architecture

### Flow

```
Message Arrival Loop
    ├─ Message arrives at webhook
    ├─ queueMessage() invoked
    ├─ Check activeBatch status
    │
    ├─ IF activeBatch EXISTS (processing):
    │  ├─ Add to pendingBatch
    │  └─ Return immediately (queued)
    │
    └─ IF activeBatch NULL (idle):
       ├─ Add to pendingBatch
       ├─ Schedule alarm: onBatchAlarm() after 500ms
       └─ Return immediately (queued)

Batch Window (500ms default)
    ├─ Collect multiple messages into pendingBatch
    ├─ Combine: "msg1\n---\nmsg2\n---\nmsg3"
    └─ Process as single request (reduce LLM calls)

onBatchAlarm() Execution
    ├─ Wait for idle state (no activeBatch)
    ├─ Atomic: activeBatch = pendingBatch (snapshot)
    ├─ Reset: pendingBatch = empty
    ├─ Status: activeBatch.status = 'processing'
    ├─ Start: Call processBatch(activeBatch)
    └─ Note: New messages go to fresh pendingBatch

processBatch() Flow
    ├─ Combine all messages in batch
    ├─ Send typing indicator
    ├─ Send "Thinking..." message
    ├─ Start rotation (edit every 5s)
    │  └─ Update lastHeartbeat = now (proves DO alive)
    │
    ├─ Routing/Execution:
    │  ├─ Check shouldRoute()
    │  ├─ YES: scheduleRouting() → RouterAgent (fire-and-forget)
    │  └─ NO: Direct chat() with LLM (blocking)
    │
    ├─ Response Ready:
    │  ├─ Edit thinking message with response
    │  └─ Mark batch complete
    │
    └─ Cleanup:
       ├─ Clear activeBatch
       └─ Ready for next batch
```

### Heartbeat & Stuck Detection

```
Rotating Thinking Messages (Every 5s)
    ├─ "Thinking 🧠"
    ├─ "Still thinking... ⏳"
    ├─ "Almost there... 🔄"
    └─ (Cycle repeats)

Purpose:
    ├─ User Feedback: Shows bot is working
    ├─ Heartbeat Signal: Edit proves DO is alive
    └─ Stuck Detection: No edit for 30s = stuck

Recovery:
    ├─ Detect: lastHeartbeat < now - 30s
    ├─ Action: Clear stuck activeBatch
    ├─ Unblock: pendingBatch becomes new active
    └─ User: Can send new messages (recovered)
```

### Progress Chain Display

Real-time execution progress shown during LLM tool iterations. Uses `*` prefix for current running step, `⏺` for completed steps.

**During Execution (Progressive Updates)**:

```
Initial:
* Ruminating...

After thinking starts:
* <thinking message>...

Tool starting:
⏺ <thinking message>...
* <tool_name>(<param>: "value")
  ⎿ Running…

Tool completed, next iteration:
⏺ <thinking message>...
⏺ <tool_name>(<param>: "value")
  ⎿ <result preview>
* <next thinking>...

Multiple tools:
⏺ <thinking message>...
⏺ tool_1(param: "value")
  ⎿ <result>
⏺ <thinking message>...
* tool_2(...)
  ⎿ Running…
```

**Final Response (Expandable Debug Footer)**:

```
<final response text>

<blockquote expandable>
[debug]
⏺ <thinking message>...
⏺ tool_1(param: "value")
  ⎿ <result>
⏺ <thinking message>...
⏺ tool_2(...)
  ⎿ <result>
⏱️ 7.6s | 📊 5.4kin/272out/642cache | 🤖 x-ai/grok-4.1-fast
</blockquote>
```

**Key Components**:
- `StepProgressTracker`: Tracks execution steps and emits progress updates
- `formatDebugFooter()`: Formats final chain for admin debug footer
- `ContextBuilder`: Extracts thinking text from LLM responses
- Transport `edit()`: Updates progress message in real-time

---

## Package Structure (Monorepo)

### Dependency Graph

```
                @duyetbot/types (foundation)
                 • Agent, Tool, Message, Provider types
                 • Shared Zod schemas
                        ↓
        ┌───────────────┼───────────────┐
        ↓               ↓               ↓
  @duyetbot/      @duyetbot/      @duyetbot/
   providers        tools          prompts
   (LLM adapters) (tool impls)  (system prompts)
        ↓               ↓               ↓
        └───────────────┼───────────────┘
                        ↓
                 @duyetbot/core
            (SDK adapter + session mgmt)
                        ↓
              @duyetbot/cloudflare-agent
           (2400+ LOC: agents, routing, batch)
                        ↓
        ┌───────────────┼───────────────┬───────────────┐
        ↓               ↓               ↓               ↓
  telegram-bot    github-bot      memory-mcp     agent-server
  (Workers+DO)    (Workers+DO)    (Workers+D1)   (Node.js)
```

### Package Details

| Package | Purpose | Key Exports | Tests |
|---------|---------|-------------|-------|
| **@duyetbot/types** | Shared types & schemas | Agent, Tool, LLMMessage, Provider | 8 |
| **@duyetbot/providers** | OpenRouter SDK provider via AI Gateway | createOpenRouterProvider | 0 |
| **@duyetbot/tools** | Built-in tool implementations | bash, git, github, research, plan | 24 |
| **@duyetbot/prompts** | System prompts & templates | Telegram, GitHub, router prompts | 18 |
| **@duyetbot/hono-middleware** | Shared HTTP utilities | logger, auth, health routes | 6 |
| **@duyetbot/core** | SDK adapter & session | query(), sdkTool(), MCP client | 32 |
| **@duyetbot/cloudflare-agent** | Loop-based agent | CloudflareChatAgent, chat loop, tools | 969 |
| **@duyetbot/cli** | Command-line interface | chat, ask, sessions commands | 14 |
| **@duyetbot/config-typescript** | TypeScript config | Shared tsconfig.json | 0 |
| **@duyetbot/config-vitest** | Vitest config | Shared vitest.config.ts | 0 |
| **@duyetbot/mcp-servers** | MCP server configs | duyet-mcp, github-mcp | 4 |

**Total: 969+ tests** (significant simplification from 1420+ after refactoring)

### Apps

| App | Runtime | Purpose | Status |
|-----|---------|---------|--------|
| **@duyetbot/telegram-bot** | Cloudflare Workers + DO | Telegram chat interface | ✅ Deployed |
| **@duyetbot/github-bot** | Cloudflare Workers + DO | GitHub @mention handler | ✅ Deployed |
| **@duyetbot/memory-mcp** | Cloudflare Workers + D1 | Cross-session memory (MCP) | ✅ Deployed |
| ~~**@duyetbot/shared-agents**~~ | ~~Cloudflare Workers~~ | ~~Shared DO pool~~ | ❌ DELETED (December 2024) |

---

## Implementation Phases

### ✅ Phase 1: Core Infrastructure

**Status**: COMPLETE & DEPLOYED

- [x] Monorepo structure (pnpm workspaces)
- [x] Package organization (types → providers → cloudflare-agent)
- [x] Shared Hono middleware (logger, auth, health)
- [x] Environment configuration system
- [x] Build & test infrastructure
- [x] 40+ unit tests

**Key Files**:
- `packages/cloudflare-agent/src/cloudflare-agent.ts` (main framework)
- `packages/cloudflare-agent/src/batch-types.ts` (batch structures)
- `packages/cloudflare-agent/src/transport.ts` (transport interface)

### ✅ ~~Phase 2: Multi-Agent Routing~~ REMOVED IN REFACTORING

**Status**: COMPLETE - REMOVED (December 2024)

This phase was replaced by the loop-based agent architecture.

**What was removed** (~8000+ LOC deleted):
- All legacy agents: RouterAgent, SimpleAgent, OrchestratorAgent, HITLAgent, CodeWorker, ResearchWorker, GitHubWorker, DuyetInfoAgent
- Routing infrastructure: routing/, orchestration/, workers/, hitl/, context/, execution/ folders
- The `apps/shared-agents` app (deleted entirely)
- Hybrid classifier and complex routing logic

### ✅ Phase 3: Platform Integration

**Status**: COMPLETE & DEPLOYED

- [x] Transport layer pattern
- [x] Telegram transport implementation
- [x] GitHub transport implementation
- [x] Webhook handlers (fire-and-forget pattern)
- [x] Context parsing (Telegram/GitHub specific)
- [x] Message deduplication
- [x] 60+ integration tests

**Key Files**:
- `apps/telegram-bot/src/index.ts` (webhook handler)
- `apps/telegram-bot/src/transport.ts` (Telegram impl)
- `apps/github-bot/src/index.ts` (webhook handler)
- `apps/github-bot/src/transport.ts` (GitHub impl)

### ✅ ~~Phase 4: Batch Processing & Reliability~~ REMOVED IN REFACTORING

**Status**: COMPLETE - REMOVED (December 2024)

Batch processing logic was removed in favor of direct chat loop execution with real-time updates.

### ✅ ~~Phase 5: Specialized Agents & Workers~~ REMOVED IN REFACTORING

**Status**: COMPLETE - REMOVED (December 2024)

Specialized agents replaced by tool-based approach:
- CodeWorker → No direct replacement (LLM handles code tasks via chat loop)
- ResearchWorker → `research` tool (built-in)
- GitHubWorker → `github` tool (built-in)
- DuyetInfoAgent → `duyet-mcp` MCP server

### ✅ Phase 6: Deployment & Monitoring

**Status**: COMPLETE & DEPLOYED

- [x] Wrangler.toml configuration
- [x] ~~Shared agent pattern (script_name binding)~~ REMOVED
- [x] Durable Object state schema
- [x] Error handling & recovery
- [x] Structured logging patterns
- [x] Deployment commands
- [x] 50+ deployment tests

**Key Files**:
- `wrangler.toml` (all apps)
- Deployment scripts
- Environment variable templates

---

## Deployment Guide

### Local Development

```bash
# Install dependencies
bun install

# Run tests
bun run test

# Type check & lint
bun run check

# Local dev (watch mode)
bun run dev
```

### Deploy to Cloudflare

```bash
# Deploy all workers
bun run deploy

# Deploy individual apps (includes dependencies)
bun run deploy:telegram    # Telegram bot
bun run deploy:github      # GitHub bot
```

### Configuration

**Required Secrets** (all apps via `scripts/config.ts`):

| Secret | Required | Purpose |
|--------|----------|---------|
| `AI_GATEWAY_API_KEY` | ✓ | Cloudflare AI Gateway authentication |
| `TELEGRAM_BOT_TOKEN` | ✓ (telegram) | Telegram Bot API |
| `GITHUB_TOKEN` | ✓ (github) | GitHub API access |

```bash
# Set all secrets for an app
bun scripts/config.ts telegram    # Telegram bot
bun scripts/config.ts github      # GitHub bot
```

### Monitoring

**Key Metrics**:
- Processing latency (P50, P95, P99)
- Tool execution duration
- Token usage per message
- Cost per session
- Tool success/error rates

**Logging**:
```typescript
logger.info('[CHAT] Tool execution', {
  queryId,
  tool: 'github',
  duration: 125,
  success: true,
  userId,
  timestamp: Date.now(),
});
```

---

## Testing Strategy

**Total**: 969+ tests across packages (significant simplification after refactoring from 1420+)

### Test Breakdown by Package

| Package | Test Count | Coverage |
|---------|-----------|----------|
| `@duyetbot/cloudflare-agent` | 969 | ✅ High |
| `@duyetbot/core` | 32 | ✅ High |
| `@duyetbot/tools` | 24 | ✅ High |
| `@duyetbot/prompts` | 18 | ✅ High |
| Others | ~20 | ✅ High |

### Test Execution

```bash
# All tests
bun run test

# Specific package
bun run test --filter @duyetbot/cloudflare-agent

# Watch mode
bun run test -- --watch

# Coverage report
bun run test -- --coverage
```

---

## Transport Layer Pattern

The Transport abstraction separates platform-specific code from agent logic:

```typescript
interface Transport<TContext> {
  send(ctx: TContext, text: string): Promise<MessageRef>;
  edit?(ctx: TContext, ref: MessageRef, text: string): Promise<void>;
  typing?(ctx: TContext): Promise<void>;
  react?(ctx: TContext, ref: MessageRef, emoji: string): Promise<void>;
  parseContext(ctx: TContext): ParsedInput;
}
```

### Benefits

| Aspect | Before Transport | After Transport |
|--------|---|---|
| **App code size** | ~300 lines | ~50 lines |
| **Platform integration** | Duplicated across apps | Centralized in transport |
| **New platform support** | Copy entire app | Just add transport |
| **Testing** | Hard (mixed concerns) | Easy (mock transport) |
| **Error handling** | Scattered | Configurable hooks |

### Implementations

- **Telegram**: Message splitting, parse mode fallback, admin debug footer
- **GitHub**: Context enrichment, emoji reactions, comment threading

---

## ✅ Phase 7-8: Loop-Based Agent Refactoring

**Status**: COMPLETE & DEPLOYED (December 2024)

**Summary**: Complete architectural refactoring from multi-agent routing to loop-based agent pattern.
- Phase 7: Introduced loop-based architecture alongside legacy system
- Phase 8: Removed all legacy multi-agent code (~8000+ LOC deleted)

This refactoring replaced the multi-agent routing system with a simpler, more maintainable loop-based architecture inspired by Claude Code's reasoning model.

### Architecture Overview

```
OLD Architecture (Multi-Agent Routing):
User → RouterAgent → 7 specialized agents → Workers
    ├─ SimpleAgent, OrchestratorAgent, HITLAgent
    ├─ CodeWorker, ResearchWorker, GitHubWorker
    └─ DuyetInfoAgent

NEW Architecture (Claude Code-Style Single Loop):
User → CloudflareAgent → AgenticLoop
                              │
                    while (needs_tool_use):
                      1. LLM generates response
                      2. If tool_call → execute tool
                      3. Feed result back to LLM
                      4. Update user with progress
                    end
                              │
                    Available Tools (replaces agents):
                    ├── plan (task decomposition)
                    ├── research (web search + synthesis)
                    ├── memory (MCP: personal info)
                    ├── github (MCP: GitHub operations)
                    ├── request_approval (HITL)
                    └── subagent (parallel delegation)
```

### Key Benefits

| Aspect | Before (Multi-Agent) | After (AgenticLoop) |
|--------|---------------------|---------------------|
| **Architecture** | 7 agents + routing | 1 loop + 6 tools |
| **Real-time updates** | ❌ Lost in fire-and-forget | ✅ Every iteration |
| **Debugging** | Hard (cross-agent traces) | Easy (single thread) |
| **Context** | Fragmented per agent | Unified conversation |
| **Code complexity** | ~3000 LOC routing | ~500 LOC loop |

### ~~Feature Flag Control~~ REMOVED

**Note**: The feature flag `USE_AGENTIC_LOOP` has been removed. The loop-based architecture is now the only implementation.

### Implementation Files

| File | Purpose |
|------|---------|
| `packages/cloudflare-agent/src/cloudflare-agent.ts` | Main agent factory |
| `packages/cloudflare-agent/src/chat/chat-loop.ts` | Core chat loop |
| `packages/cloudflare-agent/src/chat/tool-executor.ts` | Tool execution |
| `packages/cloudflare-agent/src/tracking/token-tracker.ts` | Token tracking |
| `packages/cloudflare-agent/src/persistence/message-persistence.ts` | Message store |

### Progress Updates

Real-time status messages edit the "Thinking..." message:

- **🤔 Thinking...** - LLM reasoning in progress
- **🔧 Running {tool}...** - Tool execution started
- **✅ {tool} completed** - Tool finished successfully
- **❌ {tool} failed** - Tool error (with message)
- **📝 Generating response...** - Final response

### Tasks Completed

- [x] Phase 7: Implement loop-based architecture with feature flag (November 2024)
- [x] Phase 8: Complete refactoring (December 2024)
  - [x] Remove all legacy multi-agent code (~8000+ LOC deleted)
  - [x] Delete `apps/shared-agents` app entirely
  - [x] Remove routing infrastructure: routing/, orchestration/, workers/, hitl/, context/, execution/ folders
  - [x] Simplify to modular components: chat/, tracking/, persistence/, workflow/ modules
  - [x] Update all tests (969 tests passing, down from 1420+)
  - [x] Remove feature flag (loop-based is now the only implementation)
  - [x] Update project documentation
- [x] Production testing with real LLM (Telegram + GitHub bots)
- [x] Performance validation (simpler, faster, more transparent architecture)
- [x] Code quality improvements (75% reduction in LOC, easier to maintain)

---

## Future Enhancements 🔮

These features are planned but NOT YET IMPLEMENTED:

### Tier 2: Long-Running Agent (Claude Agent SDK)

```
Container-based heavy compute for:
├─ Full filesystem access (code operations)
├─ Shell tools (bash, git, gh CLI)
├─ Long-running tasks (minutes to hours)
└─ Triggered by Tier 1 agents via Workflows

Status: PLANNED (Phase 7+)
```

### Vector Memory & Semantic Search

```
Vectorize integration for:
├─ Semantic search across sessions
├─ Similarity-based context retrieval
├─ Personalized memory augmentation
└─ Multi-user isolation

Status: PLANNED (Phase 8+)
```

### Web UI & Dashboard

```
User-facing interface for:
├─ Chat history browsing
├─ Agent configuration
├─ Approval workflows (HITL)
└─ Usage analytics

Status: PLANNED (Phase 9+)
```

---

## Revision History

| Date | Changes | Contributor |
|------|---------|-------------|
| 2025-12-13 | Added Phase 7: AgenticLoop architecture (Claude Code-style single-agent loop) | Claude Code |
| 2025-11-29 | Provider refactoring: unified OpenRouter SDK with AI Gateway auth | Claude Code |
| 2024-11-27 | Complete rewrite: document current Cloudflare implementation | Claude Code |
| (Previous entries in git history) | | |

---

## Quick References

- **Architecture Diagram**: See `docs/architecture.md`
- **API Reference**: See `docs/api.md`
- **Getting Started**: See `docs/getting-started.md`
- **Use Cases**: See `docs/USECASES.md`
- **Deployment**: See `docs/deployment.md`
- **Code Overview**: See `CLAUDE.md`

## Important Notes

**When working on this project:**

1. **Read this plan first** - Understand current phase and dependencies
2. **Update sections as you work** - Keep status accurate
3. **Add new discoveries** - Uncovered tasks belong in appropriate phase
4. **Mark tasks `[x]` immediately** - Don't batch updates
5. **Commit PLAN.md with code** - Keep documentation synchronized

See `CLAUDE.md` "Development Workflow" for detailed instructions.
