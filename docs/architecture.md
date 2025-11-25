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
┌──────────────────────────────────────────────────────────────────────────────┐
│                            User Interactions                                  │
├────────────────┬────────────────┬──────────────┬────────────────────────────┤
│ GitHub @mentions│ Telegram Bot   │  CLI Tool    │ Web UI (future)            │
└────────┬───────┴────────┬───────┴──────┬───────┴────────────────────────────┘
         │                │              │
         ▼                ▼              │
┌──────────────────────────────────────────────────────────────────────────────┐
│              Cloudflare Workers (Tier 1 - Edge Agents)                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  @duyetbot/hono-middleware (Shared Foundation)                          │ │
│  │  • Logger, error handler, rate limiting, health routes, auth            │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │ github-bot   │  │ telegram-bot │  │ memory-mcp   │  │ shared-agents   │  │
│  │ (DO Agent)   │  │ (DO Agent)   │  │ (D1 + KV)    │  │ (8 DOs)         │  │
│  │ + Transport  │  │ + Transport  │  │ MCP Server   │  │ Routing Logic   │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘  └─────────────────┘  │
└─────────┼─────────────────┼──────────────────────────────────────────────────┘
          │                 │
          └────────┬────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│               Multi-Agent Routing System (Durable Objects)                    │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ RouterAgent: Hybrid Classifier (Pattern Match + LLM)                   │  │
│  │   → Classifies: type, category, complexity, approval needs             │  │
│  └────────┬───────────────────────────────────────────────────────────────┘  │
│           │                                                                   │
│  ┌────────┴────────────┬───────────────────┬───────────────────┐             │
│  ▼                     ▼                   ▼                   ▼             │
│ ┌───────────┐  ┌─────────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│ │SimpleAgent│  │  HITLAgent      │  │ Orchestrator │  │ DuyetInfoAgent  │  │
│ │Quick Q&A  │  │  Confirmations  │  │ Task Decomp  │  │ Personal Info   │  │
│ └───────────┘  └─────────────────┘  └──────┬───────┘  └─────────────────┘  │
│                                             │                                │
│                            ┌────────────────┼────────────────┐               │
│                            ▼                ▼                ▼               │
│                    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐      │
│                    │ CodeWorker   │ │ResearchWorker│ │ GitHubWorker │      │
│                    │ Code Review  │ │ Web Search   │ │ PR/Issues    │      │
│                    └──────────────┘ └──────────────┘ └──────────────┘      │
│                                                                               │
│  State Management:                                                            │
│  • Each agent = Durable Object with SQLite storage                           │
│  • Conversation history + routing metrics + session state                    │
│  • Memory persistence via memory-mcp (D1 + KV)                               │
└──────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
                    ▼                 ▼                 ▼
         ┌────────────────┐  ┌────────────────┐  ┌────────────────┐
         │ LLM Providers  │  │ External APIs  │  │ MCP Servers    │
         │ • Anthropic    │  │ • GitHub API   │  │ • duyet-mcp    │
         │ • OpenRouter   │  │ • Telegram API │  │ • github-mcp   │
         │ • AI Gateway   │  │                │  │ • memory-mcp   │
         └────────────────┘  └────────────────┘  └────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│          Tier 2: Heavy Compute Layer (Future - Agent Server)                 │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │  Container (Fly.io/Cloudflare) with Claude Agent SDK                   │  │
│  │  • Full filesystem access (git clone, file operations)                 │  │
│  │  • Shell tools (bash, git, gh CLI, ripgrep)                            │  │
│  │  • Long-running tasks (code review, test execution)                    │  │
│  │  • Persistent volume for session state                                 │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│  Triggered by: Cloudflare Workflows for complex multi-step operations        │
└──────────────────────────────────────────────────────────────────────────────┘
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

## Multi-Agent Routing System

The Tier 1 agents use a **RouterAgent** to classify queries and route them to specialized handlers. The system implements all five [Cloudflare Agent Patterns](https://developers.cloudflare.com/agents/patterns/):

| Pattern | Implementation | Component | Status |
|---------|---------------|-----------|--------|
| Prompt Chaining | LLM→Tool→LLM flow | `CloudflareChatAgent.chat()` | ✅ Complete |
| Routing | Hybrid classification | `RouterAgent` + `classifier.ts` | ✅ Complete |
| Parallelization | Concurrent step execution | `executor.ts` | ✅ Complete |
| Orchestrator-Workers | Task decomposition | `OrchestratorAgent` + Workers | ✅ Complete |
| Evaluator-Optimizer | Result synthesis | `aggregator.ts` | ✅ Complete |

**DuyetInfoAgent**: Specialized agent for personal blog queries using `duyet-mcp` MCP server (✅ Complete)

### Complete Query Flow

```
User Message → Platform Webhook (Telegram/GitHub)
                        │
                        ▼
            CloudflareChatAgent.handle()
                        │
              Route Query
              via RouterAgent
                        │
           ┌────────────┴────────────┐
           ▼                         ▼
    NO: Direct chat()         YES: routeQuery()
    (LLM + Tools)                    │
           │                         ▼
           │               RouterAgent.route()
           │                         │
           │               hybridClassify()
           │               ┌─────────┴─────────┐
           │               ▼                   ▼
           │         Quick Pattern       LLM Fallback
           │         (regex: hi,         (semantic
           │          help, yes)          analysis)
           │               └─────────┬─────────┘
           │                         │
           │         ┌───────────────┼───────────────┐
           │         ▼               ▼               ▼
           │   SimpleAgent    OrchestratorAgent  HITLAgent
           │   (quick Q&A)    (task decompose)   (approval)
           │         │               │               │
           │         │     ┌─────────┼─────────┐     │
           │         │     ▼         ▼         ▼     │
           │         │  CodeWrkr  RsrchWrkr  GitHubWrkr
           │         │  (review)  (search)   (PRs)   │
           │         │               │               │
           └─────────┴───────────────┴───────────────┘
                                     │
                                     ▼
                            Response to User
```

### Routing Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      RouterAgent (DO)                           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │               Hybrid Classifier                           │  │
│  │  1. Quick Pattern Match (regex) ─── Instant Response     │  │
│  │     • Greetings: hi, hello, hey                          │  │
│  │     • Help: help, ?, what can you do                     │  │
│  │     • Confirmations: yes, no, approve, reject            │  │
│  │  2. LLM Classification (fallback) ── ~200-500ms          │  │
│  │     • Analyzes query semantics                           │  │
│  │     • Determines type, category, complexity              │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│  Route Target Decision (Priority Order):                        │
│  1. tool_confirmation ────────────────► hitl-agent              │
│  2. complexity: high ─────────────────► orchestrator-agent      │
│  3. requiresHumanApproval: true ──────► hitl-agent              │
│  4. type: simple + complexity: low ───► simple-agent            │
│  5. category: code ───────────────────► code-worker             │
│  6. category: research ───────────────► research-worker         │
│  7. category: github ─────────────────► github-worker           │
│  8. default ──────────────────────────► simple-agent            │
└─────────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐
│  SimpleAgent    │  │   HITLAgent     │  │  OrchestratorAgent  │
│  • Quick Q&A    │  │  • Tool approval│  │  • Task decompose   │
│  • Greetings    │  │  • Confirmations│  │  • Parallel exec    │
│  • Direct LLM   │  │  • State machine│  │  • Worker coord     │
└─────────────────┘  └─────────────────┘  └─────────┬───────────┘
                                                    │
                                    ┌───────────────┼───────────────┐
                                    ▼               ▼               ▼
                              ┌──────────┐  ┌───────────┐  ┌────────────┐
                              │CodeWorker│  │ResearchWkr│  │GitHubWorker│
                              │• Review  │  │• Web search│  │• PRs/Issues│
                              │• Debug   │  │• Doc lookup│  │• CI status │
                              └──────────┘  └───────────┘  └────────────┘
```

### Agent Responsibilities

| Agent | Purpose | Triggers | Complexity | Status |
|-------|---------|----------|------------|--------|
| **SimpleAgent** | Quick responses, direct LLM | Greetings, help, simple Q&A | Low | ✅ Deployed |
| **HITLAgent** | Human approval workflow | Confirmations, destructive ops | Low-Medium | ✅ Deployed |
| **OrchestratorAgent** | Task decomposition | Multi-step, high complexity | High | ✅ Deployed |
| **CodeWorker** | Code analysis | Review, debug, refactor | Medium | ✅ Deployed |
| **ResearchWorker** | Information gathering | Web search, docs | Medium | ✅ Deployed |
| **GitHubWorker** | GitHub operations | PRs, issues, reviews | Medium | ✅ Deployed |
| **DuyetInfoAgent** | Personal blog/info queries | Duyet-related questions | Low | ✅ Deployed |

### Routing Configuration

```bash
# Environment variables
ROUTER_DEBUG=true     # Enable debug logging (default: false)
```

```toml
# wrangler.toml - Durable Object binding
[[durable_objects.bindings]]
name = "RouterAgent"
class_name = "RouterAgent"

[[migrations]]
tag = "v2"
new_sqlite_classes = ["RouterAgent"]
```

## Agent Implementation Details

This section covers the concrete implementation patterns for the multi-agent routing system.

### File Structure

The routing system is organized into dedicated modules for separation of concerns:

```
packages/chat-agent/src/
├── agents/
│   ├── index.ts                 # Agent exports
│   ├── base-agent.ts            # Abstract base with Durable Object functionality
│   ├── router-agent.ts          # Query classification & routing orchestration
│   ├── simple-agent.ts          # Direct LLM responses (stateless)
│   └── hitl-agent.ts            # Human-in-the-loop tool confirmations
│
├── workers/
│   ├── index.ts                 # Worker exports
│   ├── base-worker.ts           # Abstract worker base
│   ├── code-worker.ts           # Code analysis/review/generation
│   ├── research-worker.ts       # Web research & documentation
│   └── github-worker.ts         # GitHub operations via MCP
│
├── routing/
│   ├── index.ts                 # Routing exports
│   ├── classifier.ts            # Query classification logic
│   ├── schemas.ts               # Zod schemas for classification
│   └── router.ts                # Route selection algorithms
│
├── orchestration/
│   ├── index.ts                 # Orchestration exports
│   ├── planner.ts               # Task planning with LLM
│   ├── executor.ts              # Parallel execution engine
│   └── aggregator.ts            # Result synthesis
│
├── hitl/
│   ├── index.ts                 # HITL exports
│   ├── confirmation.ts          # Tool confirmation workflow
│   ├── state-machine.ts         # HITL state management
│   └── executions.ts            # Tool execution handlers
│
└── [existing files - kept for backward compatibility]
    ├── cloudflare-agent.ts
    ├── agent.ts
    ├── transport.ts
    └── types.ts
```

### Key Classification Schemas

The routing system uses Zod schemas to structure query classification:

```typescript
// Schema for query classification
const ClassificationSchema = z.object({
  type: z.enum(['simple', 'complex', 'tool_confirmation']),
  category: z.enum(['general', 'code', 'research', 'github', 'admin']),
  complexity: z.enum(['low', 'medium', 'high']),
  requiresHumanApproval: z.boolean(),
  reasoning: z.string(),
});

// Schema for orchestrator execution plans
const ExecutionPlanSchema = z.object({
  taskId: z.string(),
  summary: z.string(),
  steps: z.array(
    z.object({
      id: z.string(),
      description: z.string(),
      workerType: z.enum(['code', 'research', 'github']),
      task: z.string(),
      dependsOn: z.array(z.string()).optional(),
      priority: z.number().min(1).max(10),
    })
  ),
  estimatedComplexity: z.enum(['low', 'medium', 'high']),
});

// Schema for tool confirmation requests
interface ToolConfirmation {
  id: string;
  toolName: string;
  toolArgs: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: number;
  respondedAt?: number;
  reason?: string;
}
```

### Agent Implementation Patterns

#### RouterAgent - Query Classification

The RouterAgent uses a **hybrid classifier**:
1. **Pattern matching** for instant routing (greetings, help, confirmations)
2. **LLM-based classification** for semantic analysis (fallback)

Maintains routing history in Durable Object state for context across messages.

**Routing Logic**:
- `tool_confirmation` → HITLAgent
- `complexity: high` → OrchestratorAgent
- `requiresHumanApproval: true` → HITLAgent
- `type: simple` → SimpleAgent
- `category: code` → CodeWorker
- `category: research` → ResearchWorker
- `category: github` → GitHubWorker
- Default → SimpleAgent

#### OrchestratorAgent - Task Decomposition

The OrchestratorAgent breaks complex tasks into executable steps:

**Three-phase execution**:
1. **Planning**: Uses LLM to decompose task into independent steps
2. **Execution**: Groups steps by dependencies, executes in parallel
3. **Aggregation**: Synthesizes results from all steps into coherent response

Supports dependency management - steps can depend on results from previous steps.

#### HITLAgent - Human-in-the-Loop

Implements tool confirmation workflow for sensitive operations:

**Lifecycle**:
1. Agent reaches decision point for tool that requires confirmation
2. Creates ToolConfirmation record with pending status
3. Streams back to user (or Check Run) asking for approval
4. User approves/rejects via UI
5. Agent resumes execution based on user decision

Maintains state machine: `idle` → `awaiting_confirmation` → `executing` → `completed`

#### Specialized Workers

Workers are **stateless** agents optimized for specific task categories:
- **CodeWorker**: Code review, generation, analysis
- **ResearchWorker**: Web search, documentation lookup
- **GitHubWorker**: PR operations, issue management, CI checks

Workers receive task description + context (results from dependencies) and return structured results.

### Testing Strategy

#### Unit Tests - Routing

```typescript
describe('QueryClassifier', () => {
  it('classifies simple queries correctly', async () => {
    const result = await classifier.classify('What time is it?');
    expect(result.type).toBe('simple');
    expect(result.complexity).toBe('low');
  });

  it('classifies complex queries correctly', async () => {
    const result = await classifier.classify(
      'Review this PR for security issues, summarize, and post to Slack'
    );
    expect(result.type).toBe('complex');
    expect(result.complexity).toBe('high');
  });

  it('identifies tool confirmation queries', async () => {
    const result = await classifier.classify('Delete all test files');
    expect(result.requiresHumanApproval).toBe(true);
  });
});
```

#### Integration Tests - Orchestration

```typescript
describe('Orchestrator E2E', () => {
  it('plans and executes multi-step tasks in parallel', async () => {
    const orchestrator = await getAgentByName(env.OrchestratorAgent, 'test');

    const result = await orchestrator.orchestrate(
      'Review the authentication code and summarize security concerns',
      { repo: 'test/repo' }
    );

    expect(result.stepCount).toBeGreaterThan(1);
    expect(result.successCount).toBe(result.stepCount);
  });
});
```

### Implementation Phases

All five Cloudflare Agent Patterns are fully implemented and deployed:

| Phase | Focus | Status | Tests |
|-------|-------|--------|-------|
| 1 | Core infrastructure (base agents, routing, schemas) | ✅ Complete | 22 |
| 2 | Human-in-the-loop (confirmation workflows) | ✅ Complete | 57 |
| 3 | Orchestrator-Workers (task decomposition, parallel execution) | ✅ Complete | 49 |
| 4 | Platform integration (TelegramAgent, GitHubAgent) | ✅ Complete | 12 |
| 5 | Validation & rollout (full DO deployment) | ✅ Complete | 43 |

**Total: 277 tests passing**

All patterns are fully implemented and deployed. See the [README](../README.md) for current status.

### Shared Agent Deployment Pattern

The system uses a **shared agent deployment pattern** via `apps/shared-agents` to avoid code duplication:

```
apps/shared-agents (Worker: duyetbot-shared-agents)
  ├── RouterAgent
  ├── SimpleAgent
  ├── HITLAgent
  ├── OrchestratorAgent
  ├── CodeWorker
  ├── ResearchWorker
  ├── GitHubWorker
  └── DuyetInfoAgent

Referenced by all bots via script_name binding:
  apps/telegram-bot
  apps/github-bot
```

**Benefits**:
- ✅ No code duplication across bots
- ✅ Single agent instance per user/chat across all platforms
- ✅ Consistent behavior everywhere
- ✅ Update once, deploy everywhere
- ✅ Reduced deployment size and complexity

```toml
# wrangler.toml - Telegram/GitHub bot configuration
[[durable_objects.bindings]]
name = "TelegramAgent"  # or GitHubAgent (platform-specific)
class_name = "TelegramAgent"

# All other agents imported from shared worker
[[durable_objects.bindings]]
name = "RouterAgent"
class_name = "RouterAgent"
script_name = "duyetbot-shared-agents"  # ← Shared!

[[durable_objects.bindings]]
name = "SimpleAgent"
class_name = "SimpleAgent"
script_name = "duyetbot-shared-agents"

# ... same for all 8 agents
```

### Metrics & Monitoring

**Key metrics to track**:
- **Routing Accuracy**: % of queries routed to correct handler
- **Orchestration Efficiency**: Parallel vs sequential execution ratio
- **HITL Conversion**: % of confirmations approved vs rejected
- **Latency**: P50, P95, P99 for each agent type
- **Cost**: Token usage per query type

**Structured Logging Pattern**:
```typescript
logger.info('[ROUTER] Query classified', {
  queryId,
  type: classification.type,
  category: classification.category,
  complexity: classification.complexity,
  routedTo: route,
  latencyMs: Date.now() - startTime,
});
```

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
- `getTelegramPrompt()`, `getGitHubBotPrompt()` - Prompt getter functions

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
