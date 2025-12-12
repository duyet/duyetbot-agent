# duyetbot-agent Implementation Status

## Overview

**duyetbot-agent** is a personal AI agent system built on Cloudflare Workers + Durable Objects, implementing a sophisticated multi-agent architecture for GitHub integration (@duyetbot mentions), Telegram chat, and long-running task execution.

### Core Capabilities

- 🤖 **GitHub Integration**: Respond to @duyetbot mentions, manage issues/PRs, automated reviews
- 💬 **Telegram Bot**: Chat interface for quick queries and notifications
- 🧠 **Persistent Memory**: MCP-based memory server on Cloudflare Workers (D1 + KV)
- 🛠️ **LLM Provider**: OpenRouter SDK via Cloudflare AI Gateway (grok-4.1-fast + xAI native tools)
- 📦 **Monorepo**: Separated packages for core, tools, server, CLI, MCP, bots
- 🤖 **Multi-Agent Routing**: 8 specialized Durable Objects for different task types
- ⚡ **Batch Processing**: Intelligent message batching with alarm-based execution
- 💻 **CLI Support**: Local execution with optional cloud memory access

## Current Architecture ✅ DEPLOYED

### Deployment Model

```
┌──────────────────────────────────────────────────────────────────┐
│                     Cloudflare Workers (Tier 1)                  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Telegram Bot + GitHub Bot (HTTP Handlers)              │   │
│  │  • Webhook receivers                                    │   │
│  │  • Context parsing                                      │   │
│  │  • Fire-and-forget DO invocation                        │   │
│  │  • ~50 lines per app                                    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Durable Objects (8 per bot + platform-specific)        │   │
│  │                                                          │   │
│  │  Platform-Specific:                                     │   │
│  │  • TelegramAgent (telegram-bot)                         │   │
│  │  • GitHubAgent (github-bot)                             │   │
│  │                                                          │   │
│  │  Shared (via shared-agents script binding):             │   │
│  │  • RouterAgent (hybrid classifier + orchestrator)       │   │
│  │  • SimpleAgent (direct LLM for quick Q&A)               │   │
│  │  • OrchestratorAgent (task decomposition)               │   │
│  │  • HITLAgent (human-in-the-loop approvals)              │   │
│  │  • CodeWorker (code analysis/review)                    │   │
│  │  • ResearchWorker (web search + research)               │   │
│  │  • GitHubWorker (PR/issue operations)                   │   │
│  │  • DuyetInfoAgent (personal blog/info via duyet-mcp)    │   │
│  │                                                          │   │
│  │  State Management:                                      │   │
│  │  • Conversation history (trimmed to max)                │   │
│  │  • Batch queue (dual-batch: pending + active)           │   │
│  │  • Session deduplication (requestId tracking)           │   │
│  │  • Heartbeat for stuck detection                        │   │
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
         │   GitHub   │ │Anthropic │ │ MCP Servers│
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
| **CloudflareChatAgent** | Main DO wrapper (2400+ LOC) | ✅ Deployed |
| **Multi-Agent Routing** | Route queries to 8 specialized agents | ✅ Deployed |
| **Hybrid Classifier** | Pattern match + LLM fallback | ✅ Deployed |
| **Batch Processing** | Dual-queue with alarm-based execution | ✅ Deployed |
| **Transport Layer** | Platform abstraction (Telegram/GitHub) | ✅ Deployed |
| **Heartbeat Mechanism** | Rotating messages + stuck detection | ✅ Deployed |
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

## Multi-Agent Routing System

### 8 Durable Objects: Roles & Responsibilities

```
RouterAgent
├─ Purpose: Query classification + routing orchestration
├─ Trigger: scheduleRouting() from TelegramAgent/GitHubAgent
├─ Logic: Hybrid classifier (pattern match → LLM)
├─ Output: Routes to one of 7 specialized agents
└─ Status: ✅ Deployed

SimpleAgent
├─ Purpose: Direct LLM responses for quick Q&A
├─ Trigger: Router determines type:simple + complexity:low
├─ Logic: Embed history, call LLM, return response
├─ Examples: Greetings, help, simple questions
└─ Status: ✅ Deployed

OrchestratorAgent
├─ Purpose: Break complex tasks into parallel steps
├─ Trigger: Router determines complexity:high
├─ Logic: Plan → Execute (parallel) → Aggregate
├─ Coordinated Agents: CodeWorker, ResearchWorker, GitHubWorker
└─ Status: ✅ Deployed

HITLAgent (Human-In-The-Loop)
├─ Purpose: Request user approval for sensitive operations
├─ Trigger: Router determines requiresHumanApproval:true
├─ Logic: State machine (pending → approved/rejected → execute)
├─ Example: Delete operations, merge PRs
└─ Status: ✅ Deployed

CodeWorker
├─ Purpose: Code analysis, review, generation
├─ Trigger: Router determines category:code
├─ Logic: Receive task + context, analyze, return results
├─ Examples: Review code, explain functions, find bugs
└─ Status: ✅ Deployed

ResearchWorker
├─ Purpose: Web research and documentation lookup
├─ Trigger: Router determines category:research
├─ Logic: Search web, compile info, synthesize
├─ Examples: Technology research, documentation lookup
└─ Status: ✅ Deployed

GitHubWorker
├─ Purpose: GitHub operations (PRs, issues, CI)
├─ Trigger: Router determines category:github
├─ Logic: Use GitHub MCP tools to perform operations
├─ Examples: Check CI status, merge PRs, label issues
└─ Status: ✅ Deployed

DuyetInfoAgent
├─ Purpose: Personal blog/info queries
├─ Trigger: Router determines category:duyet
├─ Logic: Connect to duyet-mcp MCP server
├─ Examples: Blog posts, personal info, CV, skills
└─ Status: ✅ Deployed
```

### Routing Classification Logic

```
Query Input
    ↓
hybridClassify(query)
    │
    ├─ Phase 1: Quick Pattern Match (10-50ms)
    │  ├─ Greetings: /^(hi|hello|hey)/i
    │  ├─ Help: /help|\?|what can you do/i
    │  ├─ Confirmations: /yes|no|approve|reject/i
    │  └─ No match? → Phase 2
    │
    └─ Phase 2: LLM Classification (200-500ms)
       └─ Call Claude with classification prompt
          Returns: { type, category, complexity, requiresHumanApproval }

determineRouteTarget(classification)
    ├─ tool_confirmation → hitl-agent
    ├─ complexity: high → orchestrator-agent
    ├─ requiresHumanApproval: true → hitl-agent
    ├─ category: code → code-worker
    ├─ category: research → research-worker
    ├─ category: github → github-worker
    ├─ category: duyet → duyet-info-agent
    └─ default → simple-agent

Response Handling
    ├─ Routed Agent executes task
    ├─ Returns response to target transport
    └─ Transport sends to Telegram/GitHub
```

---

## Batch Processing Architecture

### Dual-Batch Queue System

The system uses two batch states to prevent message loss:

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
| **@duyetbot/cloudflare-agent** | Multi-agent system | CloudflareChatAgent, routing, agents | 226 |
| **@duyetbot/cli** | Command-line interface | chat, ask, sessions commands | 14 |
| **@duyetbot/config-typescript** | TypeScript config | Shared tsconfig.json | 0 |
| **@duyetbot/config-vitest** | Vitest config | Shared vitest.config.ts | 0 |
| **@duyetbot/mcp-servers** | MCP server configs | duyet-mcp, github-mcp | 4 |

**Total: 344 tests across 11 packages**

### Apps

| App | Runtime | Purpose | Status |
|-----|---------|---------|--------|
| **@duyetbot/telegram-bot** | Cloudflare Workers + DO | Telegram chat interface | ✅ Deployed |
| **@duyetbot/github-bot** | Cloudflare Workers + DO | GitHub @mention handler | ✅ Deployed |
| **@duyetbot/memory-mcp** | Cloudflare Workers + D1 | Cross-session memory (MCP) | ✅ Deployed |
| **@duyetbot/shared-agents** | Cloudflare Workers | Shared DO pool (8 agents) | ✅ Deployed |

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

### ✅ Phase 2: Multi-Agent Routing

**Status**: COMPLETE & DEPLOYED

- [x] RouterAgent implementation
- [x] Hybrid classifier (pattern + LLM)
- [x] SimpleAgent (direct LLM)
- [x] OrchestratorAgent (task decomposition)
- [x] HITLAgent (human approval)
- [x] Classification schemas (Zod)
- [x] 80+ routing tests

**Key Files**:
- `packages/cloudflare-agent/src/agents/router-agent.ts`
- `packages/cloudflare-agent/src/routing/classifier.ts`
- `packages/cloudflare-agent/src/routing/schemas.ts`

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

### ✅ Phase 4: Batch Processing & Reliability

**Status**: COMPLETE & DEPLOYED

- [x] Dual-batch queue architecture
- [x] Alarm-based batch processing
- [x] Message combining (batch window)
- [x] Heartbeat mechanism
- [x] Stuck batch detection & recovery
- [x] Deduplication strategy
- [x] 70+ reliability tests

**Key Files**:
- `packages/cloudflare-agent/src/cloudflare-agent.ts` (batch logic, lines 1137-1265)
- `packages/cloudflare-agent/src/cloudflare-agent.ts` (stuck detection, lines 812-880)

### ✅ Phase 5: Specialized Agents & Workers

**Status**: COMPLETE & DEPLOYED

- [x] CodeWorker (code analysis)
- [x] ResearchWorker (web research)
- [x] GitHubWorker (GitHub operations)
- [x] DuyetInfoAgent (personal blog/info)
- [x] Base agent patterns
- [x] Lifecycle hooks (beforeHandle, afterHandle, onError)
- [x] 90+ agent tests

**Key Files**:
- `packages/cloudflare-agent/src/workers/code-worker.ts`
- `packages/cloudflare-agent/src/workers/research-worker.ts`
- `packages/cloudflare-agent/src/workers/github-worker.ts`
- `packages/cloudflare-agent/src/agents/duyet-info-agent.ts`

### ✅ Phase 6: Deployment & Monitoring

**Status**: COMPLETE & DEPLOYED

- [x] Wrangler.toml configuration
- [x] Shared agent pattern (script_name binding)
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

# Deploy individual apps
bun run deploy:telegram    # duyetbot-telegram
bun run deploy:github      # duyetbot-github
bun run deploy:memory-mcp  # duyetbot-memory-mcp
bun run deploy:shared      # duyetbot-shared-agents
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
bun scripts/config.ts telegram    # Telegram bot + webhook
bun scripts/config.ts github      # GitHub bot
bun scripts/config.ts agents      # Shared agents
```

### Monitoring

**Key Metrics**:
- Routing accuracy (% correct agent routing)
- Batch processing latency (P50, P95, P99)
- Stuck batch detection (count per day)
- Token usage per query type
- Error rates by agent

**Logging**:
```typescript
logger.info('[ROUTER] Query classified', {
  queryId,
  type: classification.type,
  category: classification.category,
  complexity: classification.complexity,
  routedTo: route,
  latencyMs: duration,
});
```

---

## Testing Strategy

**Total**: 1420+ tests across 11 packages (includes 1059 cloudflare-agent tests)

### Test Breakdown by Phase

| Phase | Component | Test Count | Coverage |
|-------|-----------|-----------|----------|
| 1 | Core infrastructure | 40 | ✅ High |
| 2 | Routing & classification | 80 | ✅ High |
| 3 | Platform integration | 60 | ✅ High |
| 4 | Batch processing & reliability | 70 | ✅ High |
| 5 | Specialized agents | 90 | ✅ High |
| 6 | Deployment & monitoring | 50 | ✅ High |

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

## ✅ Phase 7: AgenticLoop Architecture (Claude Code-Style)

**Status**: COMPLETE & DEPLOYED (Feature flag enabled by default)

This phase introduced a new single-agent agentic loop architecture inspired by Claude Code's reasoning model.

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

### Feature Flag Control

**Environment Variable**: `USE_AGENTIC_LOOP`

```toml
# apps/telegram-bot/wrangler.toml
# apps/github-bot/wrangler.toml
[vars]
USE_AGENTIC_LOOP = "true"   # Enable agentic loop (default)
# USE_AGENTIC_LOOP = "false" # Fall back to multi-agent routing
```

### Implementation Files

| File | Purpose |
|------|---------|
| `packages/cloudflare-agent/src/agentic-loop/agentic-loop.ts` | Core loop implementation |
| `packages/cloudflare-agent/src/agentic-loop/cloudflare-integration.ts` | CloudflareAgent integration |
| `packages/cloudflare-agent/src/agentic-loop/transport-adapter.ts` | Progress → transport bridge |
| `packages/cloudflare-agent/src/agentic-loop/tools/*.ts` | Tool implementations |
| `packages/cloudflare-agent/src/agentic-loop/types.ts` | Type definitions |

### Progress Updates

Real-time status messages edit the "Thinking..." message:

- **🤔 Thinking...** - LLM reasoning in progress
- **🔧 Running {tool}...** - Tool execution started
- **✅ {tool} completed** - Tool finished successfully
- **❌ {tool} failed** - Tool error (with message)
- **📝 Generating response...** - Final response

### Tasks Completed

- [x] Create AgenticLoop core (`agentic-loop.ts`)
- [x] Create tool executor and progress tracking
- [x] Convert agents to tools (plan, research, memory, github, approval)
- [x] Create subagent tool with recursion prevention (one level max)
- [x] Create transport adapter for progress callbacks
- [x] Wire CloudflareAgent to use AgenticLoop when flag enabled
- [x] Add feature flag to telegram-bot and github-bot
- [x] 47+ unit tests for agentic loop module
- [x] Documentation in plan file

### Remaining Work (Phase 5 Validation)

- [ ] Production testing with real LLM
- [ ] Performance comparison (old vs new)
- [ ] Remove legacy routing code after stability validation

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
