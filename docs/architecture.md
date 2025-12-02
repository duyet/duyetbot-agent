---
title: Architecture
description: System design overview of duyetbot-agent's hybrid supervisor-worker architecture with Cloudflare Workers and Durable Objects.
---

**Table of Contents**: [System Overview](#system-overview) | [Message Flow](#message-flow) | [Routing System](#routing-system) | [Batch Processing](#batch-processing) | [Package Architecture](#package-architecture) | [Transport Layer](#transport-layer) | [Error Handling](#error-handling) | [Deployment](#deployment)

---

## System Overview

**duyetbot-agent** is a sophisticated multi-agent system built entirely on Cloudflare Workers + Durable Objects. It routes incoming messages (from Telegram/GitHub webhooks) to one of 8 specialized agents based on query classification.

### Architecture Diagram

```
┌───────────────────────────────────────────────────────────────────────────┐
│                        Cloudflare Workers (Edge)                          │
│                                                                           │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │  HTTP Handlers (Webhook Entry Points)                              │   │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────┐   │   │
│  │  │ Telegram Webhook │  │  GitHub Webhook  │  │  Health Routes  │   │   │
│  │  │  /webhook POST   │  │  /webhook POST   │  │  /health /etc   │   │   │
│  │  └────────┬─────────┘  └────────┬─────────┘  └─────────────────┘   │   │
│  │           │                     │                                  │   │
│  │           └─────────┬───────────┘                                  │   │
│  │                     │                                              │   │
│  │              Parse & Validate                                      │   │
│  │         (auth, signature, dedup)                                   │   │
│  │                     │                                              │   │
│  │                     ▼                                              │   │
│  │        ┌────────────────────────┐                                  │   │
│  │        │  TelegramAgent (DO)    │     ┌───────────────────┐        │   │
│  │        │  or GitHubAgent (DO)   │────→│ Shared Agents     │        │   │
│  │        │                        │     │ via script_name   │        │   │
│  │        │ • State Management     │     │ binding:          │        │   │
│  │        │ • Message Queue        │     │ • RouterAgent     │        │   │
│  │        │ • Batch Processing     │     │ • SimpleAgent     │        │   │
│  │        │ • Heartbeat            │     │ • Orchestrator    │        │   │
│  │        └────────────────────────┘     │ • HITLAgent       │        │   │
│  │                                       │ • 4 Workers       │        │   │
│  │                                       └───────────────────┘        │   │
│  │                                                                    │   │
│  │  ┌──────────────────────────────────────────────────────────────┐  │   │
│  │  │  Memory MCP Server (D1 + KV)                                 │  │   │
│  │  │  • Cross-session memory persistence                          │  │   │
│  │  │  • User isolation                                            │  │   │
│  │  │  • Semantic search (future: Vectorize)                       │  │   │
│  │  └──────────────────────────────────────────────────────────────┘  │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  External Integrations:                                                   │
│  • Claude API (via Anthropic base URL)                                    │
│  • GitHub API (webhooks + REST)                                           │
│  • Telegram Bot API (webhooks + REST)                                     │
│  • MCP Servers (duyet-mcp, github-mcp, etc.)                              │
└───────────────────────────────────────────────────────────────────────────┘
```

### Key Design Principles

```
1. Fire-and-Forget Pattern
   ├─ Webhook returns immediately (<100ms)
   └─ DO continues independently with own timeout

2. Dual-Batch Queue
   ├─ pendingBatch (collecting) never blocks
   └─ activeBatch (processing) runs atomically

3. Hybrid Classification
   ├─ Quick pattern match (instant)
   └─ LLM fallback (semantic analysis)

4. Transport Abstraction
   ├─ Platform-agnostic agent logic
   ├─ Pluggable platform transports
   └─ Reduced per-app code

5. Heartbeat & Recovery
   ├─ Rotating messages prove liveness
   ├─ Stuck detection after 30s no heartbeat
   └─ Automatic recovery without user action
```

---

## Message Flow: Webhook to Response

### Complete Execution Timeline

```
User Sends Message
      │
      ▼
┌─────────────────────────────────────────┐
│  Webhook Ingestion (T+0-6ms)            │
├─────────────────────────────────────────┤
│                                         │
│  T+0ms:   POST /webhook received        │
│  T+1ms:   Middleware validation         │
│           ├─ X-Hub-Signature-256        │
│           ├─ JSON parse                 │
│           └─ Authorization check        │
│                                         │
│  T+2ms:   Request ID generation         │
│           └─ For trace correlation      │
│                                         │
│  T+3ms:   Deduplication check           │
│           ├─ Look up requestId          │
│           └─ Skip if duplicate          │
│                                         │
│  T+4ms:   Get or create Durable Object  │
│           └─ env.TelegramAgent.get()    │
│                                         │
│  T+5ms:   Queue message                 │
│           ├─ agent.queueMessage(ctx)    │
│           ├─ Add to pendingBatch        │
│           ├─ Schedule alarm (500ms)     │
│           └─ Mark requestId processed   │
│                                         │
│  T+6ms:   Return HTTP 200 OK            │
│           └─ Webhook complete!          │
│                                         │
└─────────────────────────────────────────┘
                      │
        ✅ Webhook exits here,
           DO continues independently
                      │
                      ▼
┌─────────────────────────────────────────┐
│  Batch Window & Processing (T+506-5002)│
├─────────────────────────────────────────┤
│                                         │
│  T+506ms:  onBatchAlarm() fires         │
│            └─ Scheduled from queueMsg   │
│                                         │
│  T+507ms:  Atomic promotion             │
│            ├─ activeBatch = pendingBatch│
│            ├─ pendingBatch = empty      │
│            └─ Status: processing        │
│                                         │
│  T+508ms:  processBatch() starts        │
│            ├─ Combine all messages      │
│            ├─ "msg1\n---\nmsg2"         │
│            └─ (Multiple msgs → 1 LLM)   │
│                                         │
│  T+509ms:  Send typing indicator        │
│            └─ User sees "typing..."     │
│                                         │
│  T+510ms:  Send thinking message        │
│            ├─ Text: "Thinking ..."      │
│            └─ Get messageRef for edits  │
│                                         │
│  T+511ms:  Start rotation loop          │
│            ├─ Every 5s: edit message    │
│            ├─ Update lastHeartbeat      │
│            └─ Proves DO alive           │
│                                         │
│  T+512ms:  Routing decision             │
│            ├─ Check shouldRoute()       │
│            │                            │
│            ├─ Path A: Direct chat()     │
│            │  └─ Call LLM, blocking     │
│            │                            │
│            └─ Path B: scheduleRouting() │
│               ├─ RouterAgent.execute()  │
│               ├─ Fire-and-forget        │
│               └─ Return immediately     │
│                                         │
│  T+513-5000ms: LLM execution            │
│            ├─ Hybrid classification     │
│            ├─ Route to agent            │
│            ├─ Execute tools if needed   │
│            └─ Compile response          │
│                                         │
│  T+5001ms: Edit thinking message        │
│            ├─ Replace with response     │
│            └─ User sees final answer    │
│                                         │
│  T+5002ms: Mark batch complete          │
│            ├─ activeBatch.status: done  │
│            └─ Clear activeBatch         │
│                                         │
└─────────────────────────────────────────┘
```

### Routing Decision Point

When `processBatch()` reaches the routing decision (T+512ms), it chooses:

```
shouldRoute(userIdStr)
    ├─ Check: routerConfig present?
    ├─ Check: routing enabled?
    │
    ├─ YES to both: scheduleRouting()
    │  ├─ Fire-and-forget to RouterAgent
    │  ├─ Return immediately
    │  └─ RouterAgent handles response
    │
    └─ NO: Direct chat()
       ├─ Call this.chat(combinedText)
       ├─ Get response
       └─ Send directly to user
```

### Key Pattern: Fire-and-Forget

```
❌ WRONG - Blocks webhook:
c.executionCtx.waitUntil(agent.queueMessage(ctx));
├─ DO inherits webhook's 30s timeout
├─ If processing >30s, entire context fails
└─ User sees nothing

✅ CORRECT - Independent execution:
agent.queueMessage(ctx).catch(() => {});
├─ Webhook returns in ~6ms
├─ DO has independent 30s timeout
├─ Multiple DOs can run in series
└─ Error isolation preserved
```

---

## Multi-Agent Routing System

### 8 Durable Objects (All Deployed ✅)

```
┌──────────────────────────────────────────────────────────────┐
│               RouterAgent (Hybrid Classifier)                │
│                                                              │
│  Input: User query (from Telegram/GitHub)                   │
│                                                              │
│  ┌─ Phase 1: Pattern Match (10-50ms) ──────────────────┐   │
│  │                                                      │   │
│  │  Regex checks for quick route:                       │   │
│  │  ├─ /^(hi|hello|hey)/i ────→ SimpleAgent            │   │
│  │  ├─ /help|\?/i ────────────→ SimpleAgent            │   │
│  │  ├─ /yes|no|approve/i ─────→ HITLAgent              │   │
│  │  └─ No match? → Phase 2                             │   │
│  │                                                      │   │
│  └──────────────────────────────────────────────────────┘   │
│                      │                                       │
│                      ▼                                       │
│  ┌─ Phase 2: LLM Classification (200-500ms) ────────────┐   │
│  │                                                      │   │
│  │  Call Claude with classification prompt              │   │
│  │  Analyze: type, category, complexity, approval      │   │
│  │                                                      │   │
│  │  Returns schema:                                     │   │
│  │  {                                                   │   │
│  │    type: "simple" | "complex",                       │   │
│  │    category: "code" | "research" | "github" | ...,   │   │
│  │    complexity: "low" | "medium" | "high",            │   │
│  │    requiresHumanApproval: boolean,                   │   │
│  │    reasoning: string                                 │   │
│  │  }                                                   │   │
│  │                                                      │   │
│  └──────────────────────────────────────────────────────┘   │
│                      │                                       │
└──────────────────────┼───────────────────────────────────────┘
                       │
              Determine Route Target
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
   SimpleAgent    HITLAgent    OrchestratorAgent
   Quick Q&A      Approval       Decomposition
   Greetings      Confirmation   Complex tasks
                  Sensitive ops


┌─ Route Determination Algorithm ───────────────────────────┐
│                                                           │
│  IMPORTANT: Router only dispatches to AGENTS.             │
│  Workers are dispatched by OrchestratorAgent.             │
│                                                           │
│  if (type === 'tool_confirmation')                        │
│    → return 'hitl-agent'                                  │
│                                                           │
│  if (requiresHumanApproval === true)                      │
│    → return 'hitl-agent'                                  │
│                                                           │
│  if (category === 'duyet')                                │
│    → return 'duyet-info-agent'                            │
│                                                           │
│  if (category === 'research' && complexity >= 'medium')   │
│    → return 'lead-researcher-agent'                       │
│                                                           │
│  if (complexity === 'high')                               │
│    → return 'orchestrator-agent'                          │
│                                                           │
│  if (type === 'simple' && complexity === 'low')           │
│    → return 'simple-agent'                                │
│                                                           │
│  if (category === 'code' || 'research' || 'github')       │
│    → return 'orchestrator-agent'  // dispatches workers   │
│                                                           │
│  default:                                                 │
│    → return 'simple-agent'                                │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

### Agent vs Worker Distinction

**IMPORTANT**: Router only dispatches to **Agents**, never directly to Workers.

| Type | Purpose | Called By | Interface |
|------|---------|-----------|-----------|
| **Agents** | Stateful coordinators with conversation history | RouterAgent | `execute(query, context): AgentResult` |
| **Workers** | Stateless executors for single tasks | OrchestratorAgent only | `execute(WorkerInput): WorkerResult` |

**Agents** (called by Router):
- SimpleAgent, OrchestratorAgent, HITLAgent, LeadResearcherAgent, DuyetInfoAgent

**Workers** (called by Orchestrator):
- CodeWorker, ResearchWorker, GitHubWorker

Workers implement the [Orchestrator-Workers pattern](https://developers.cloudflare.com/agents/patterns/).
They expect a `PlanStep` and return `WorkerResult`, not `AgentResult`.

### Agent Responsibilities

| Agent | Trigger | Logic | Example |
|-------|---------|-------|---------|
| **SimpleAgent** | pattern:greeting OR type:simple+complexity:low | Direct LLM call | "Hi!" "How's the weather?" |
| **HITLAgent** | tool_confirmation OR requiresApproval | State machine: pending→approved→execute | "Delete all logs?" → confirm |
| **OrchestratorAgent** | complexity:high OR domain tasks | 1. Plan, 2. Dispatch workers, 3. Aggregate | "Review PR and summarize" |
| **LeadResearcherAgent** | category:research + complexity>=medium | Multi-agent parallel research | "Compare AI frameworks" |
| **DuyetInfoAgent** | category:duyet | MCP connection to duyet-mcp | "Tell me about yourself" |

### Worker Responsibilities (OrchestratorAgent only)

| Worker | Task Type | Logic | Example |
|--------|-----------|-------|---------|
| **CodeWorker** | workerType:code | Code analysis/review/generation | "Fix this bug" |
| **ResearchWorker** | workerType:research | Web search + synthesis | "Latest AI news" |
| **GitHubWorker** | workerType:github | GitHub API operations | "Merge if CI passes" |

---

## Batch Processing Architecture

### Dual-Batch Queue (The Heart of Reliability)

```
┌─────────────────────────────────────────────────────────────┐
│           State: Two-Batch Architecture                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  pendingBatch: BatchState (mutable, always collecting)      │
│  ├─ status: 'collecting'                                   │
│  ├─ pendingMessages: PendingMessage[]                       │
│  ├─ lastMessageAt: number                                   │
│  └─ (New messages added here ALWAYS)                        │
│                                                             │
│  activeBatch: BatchState | null (immutable during process) │
│  ├─ status: 'processing'                                   │
│  ├─ pendingMessages: PendingMessage[] (snapshot)            │
│  ├─ lastHeartbeat: number (updated every 5s)               │
│  └─ messageRef: string (for thinking message edits)         │
│                                                             │
│  Why two batches?                                          │
│  • pendingBatch never blocks new messages                  │
│  • activeBatch processes atomically                        │
│  • Stuck activeBatch won't block new input                 │
│  • Recovery: promote pendingBatch → activeBatch            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Message Arrival to Processing

```
Message Arrives → queueMessage(ctx)
        │
        ▼
    Validate
    ├─ Parse request ID
    ├─ Check deduplication
    └─ Ensure auth
        │
        ▼
    Check activeBatch State
        │
    ┌───┴───┐
    │       │
    ▼       ▼
 EXISTS   NULL
    │       │
    │       ├─ Add to pendingBatch
    │       ├─ Schedule alarm:
    │       │  onBatchAlarm()
    │       │  after 500ms
    │       └─ Return immediately
    │
    └─ Add to pendingBatch
       └─ Return immediately
          (alarm already scheduled)

Batch Window (500ms default)
    ├─ Collect: msg1, msg2, msg3...
    └─ Wait for window

onBatchAlarm() Fires
    ├─ Check: activeBatch exists?
    │  ├─ YES: Skip (already processing)
    │  └─ NO: Continue
    │
    ├─ Check: pendingBatch has messages?
    │  ├─ NO: Done (nothing to do)
    │  └─ YES: Continue
    │
    ├─ Atomic Promotion:
    │  ├─ activeBatch = { ...pendingBatch, status:'processing' }
    │  ├─ pendingBatch = { empty }
    │  └─ Start: processBatch(activeBatch)
    │
    └─ Meanwhile:
       └─ New messages → fresh pendingBatch
```

### Heartbeat & Stuck Detection

```
processBatch(activeBatch)
    │
    ├─ Send "Thinking 🧠" message
    ├─ Get messageRef
    └─ Start rotation loop:
       │
       ├─ Loop every 5s:
       │  ├─ Get next rotation text
       │  ├─ Update: activeBatch.lastHeartbeat = now
       │  ├─ Edit message via transport
       │  └─ Catch errors gracefully
       │
       └─ During LLM processing:
          ├─ T+511ms: 1st rotation
          ├─ T+516ms: 2nd rotation
          ├─ T+521ms: 3rd rotation
          └─ ... continues until response ready

Stuck Detection (Independent Check)
    ├─ On new message arrival:
    │  └─ Check activeBatch
    │
    ├─ Is it stuck?
    │  └─ lastHeartbeat < (now - 30s)
    │
    ├─ If YES:
    │  ├─ Log: "Batch stuck for X seconds"
    │  ├─ Clear activeBatch
    │  ├─ pendingBatch becomes active
    │  └─ User can proceed (recovered!)
    │
    └─ If NO:
       └─ Process normally
```

### Benefits of Dual-Batch Design

| Scenario | Single-Batch | Dual-Batch |
|----------|---|---|
| **LLM slow (20s)** | Messages pile up | Collected in pending |
| **DO crashes** | All queued messages lost | pendingBatch survives |
| **Stuck batch (no heartbeat)** | User blocked | Recovered automatically |
| **Rapid messages** | Process separately (N calls) | Combined batch (1 call) |
| **Cost efficiency** | 3 msgs = 3 LLM calls | 3 msgs = 1 LLM call |

---

## Package Architecture

### Monorepo Structure (11 Packages + 5 Apps)

```
Foundation Layer
└─ @duyetbot/types
   ├─ Agent, Tool, Message types
   ├─ Provider interface
   └─ Shared Zod schemas

   Intermediate Layer
   ├─ @duyetbot/providers
   │  ├─ Claude adapter
   │  ├─ OpenRouter adapter
   │  └─ Provider factory
   │
   ├─ @duyetbot/tools
   │  ├─ bash, git, github tools
   │  ├─ research, plan tools
   │  └─ Tool registry
   │
   ├─ @duyetbot/prompts
   │  ├─ Telegram prompt
   │  ├─ GitHub prompt
   │  ├─ Router prompt
   │  └─ Agent-specific prompts
   │
   └─ @duyetbot/hono-middleware
      ├─ Logger middleware
      ├─ Auth middleware
      └─ Health routes

      Core Business Layer
      └─ @duyetbot/core
         ├─ SDK adapter (query())
         ├─ Session manager
         └─ MCP client

      └─ @duyetbot/chat-agent (2400+ LOC)
         ├─ CloudflareChatAgent
         ├─ RouterAgent + classifier
         ├─ SimpleAgent, OrchestratorAgent
         ├─ HITLAgent
         ├─ 4 Workers (Code, Research, GitHub, DuyetInfo)
         ├─ Batch processing logic
         └─ Transport interface

Application Layer
├─ apps/telegram-bot
│  └─ Telegram transport + TelegramAgent DO
│
├─ apps/github-bot
│  └─ GitHub transport + GitHubAgent DO
│
├─ apps/memory-mcp
│  └─ MCP server (D1 + KV)
│
├─ apps/shared-agents
│  └─ Shared DO pool (RouterAgent, etc.)
│
└─ apps/agent-server
   └─ Long-running agent (future)

Support Packages
├─ @duyetbot/cli
│  └─ Local chat CLI
│
└─ @duyetbot/config-*
   └─ Build configs
```

### Dependency Graph

```
                  @duyetbot/types
                        ↓
        ┌───────────────┼───────────────┐
        │               │               │
  @duyetbot/      @duyetbot/      @duyetbot/
   providers        tools          prompts
        │               │               │
        └───────────────┼───────────────┘
                        ↓
                 @duyetbot/core
                        ↓
          @duyetbot/chat-agent
                        ↓
        ┌───────────────┼───────────────┬───────────────┐
        │               │               │               │
  telegram-bot    github-bot      memory-mcp     agent-server
```

### Package Responsibilities

```
@duyetbot/types
├─ Agent interface
├─ Tool interface
├─ Message types
├─ LLMProvider interface
└─ Zod validation schemas

@duyetbot/providers
├─ Claude provider (via AI Gateway or direct)
├─ OpenRouter provider
├─ Provider factory
└─ Base URL override support

@duyetbot/tools
├─ bash tool (exec shell commands)
├─ git tool (git operations)
├─ github tool (GitHub API)
├─ research tool (web search)
├─ plan tool (task planning)
└─ Tool registry & platform-specific filtering

@duyetbot/prompts
├─ Telegram bot personality
├─ GitHub bot personality
├─ Router classification prompt
├─ Orchestrator planning prompt
├─ Agent-specific prompts
└─ Prompt builder (template system)

@duyetbot/core
├─ SDK adapter: query() async generator
├─ Tool execution wrapper
├─ Session manager interface
└─ MCP client

@duyetbot/chat-agent
├─ CloudflareChatAgent (main DO wrapper)
├─ Message batching logic
├─ Batch state management
├─ Stuck detection & recovery
├─ Router + hybrid classifier
├─ 7 specialized agents
├─ Transport interface
└─ Lifecycle hooks
```

---

## Transport Layer Pattern

The **Transport Layer** is the key innovation enabling clean separation between platform-specific and agent logic.

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
├─ Split message if > 4096 chars
│  ├─ Split at newlines (respect formatting)
│  └─ Send multiple messages if needed
├─ Try Markdown parse mode
├─ Fallback to plain text if formatting fails
└─ Return message_id for edits

edit(ctx: TelegramContext, messageId, text)
├─ Check message length
│  ├─ If >4096: truncate + "..."
│  └─ Otherwise: send as-is
├─ Retry on conflict (message deleted)
└─ Log admin debug footer (if admin user)

typing(ctx: TelegramContext)
├─ sendChatAction(chatId, 'typing')
└─ User sees "typing..." indicator

parseContext(webhookContext)
├─ Extract text
├─ Extract user ID, chat ID
├─ Generate request ID
└─ Return normalized ParsedInput
```

### GitHub Transport

```
github-bot/src/transport.ts

send(ctx: GitHubContext, text: string)
├─ Create comment on issue/PR
├─ Include context header:
│  ├─ Issue/PR URL
│  ├─ State (open/closed)
│  └─ Labels
└─ Return comment.id for edits

edit(ctx: GitHubContext, commentId, text)
├─ Update comment via Octokit
├─ Preserve formatting
└─ Return void

react(ctx: GitHubContext, commentId, emoji)
├─ Add emoji reaction to comment
├─ Use GitHub API reactions endpoint
└─ Return void

parseContext(webhookPayload)
├─ Extract issue/PR metadata
├─ Extract sender info
├─ Include full context (title, labels, etc.)
└─ Return normalized ParsedInput
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

### Deduplication Strategy

```
Message Arrival
    │
    ├─ Extract requestId from context
    ├─ Check processedRequestIds set
    │
    ├─ If found (duplicate):
    │  ├─ Log: "Duplicate request"
    │  └─ Return without processing
    │
    └─ If not found:
       ├─ Process normally
       ├─ Add requestId to processed set
       └─ Trim to recent window (rolling)

Purpose:
├─ Handle platform retries (Telegram, GitHub)
├─ Prevent duplicate LLM calls
└─ Save on token costs
```

### Stuck Batch Detection

```
On New Message Arrival:

Check activeBatch
    │
    ├─ No activeBatch? → process normally
    │
    └─ Has activeBatch?
       │
       ├─ Calculate: time since last heartbeat
       │  └─ now - activeBatch.lastHeartbeat
       │
       ├─ If < 30s (healthy):
       │  └─ Process new batch normally
       │
       └─ If >= 30s (stuck):
          ├─ Log: "Batch stuck for Xs"
          │        (includes diagnostics)
          ├─ Clear activeBatch
          │  (throw away stuck messages)
          ├─ Promote pendingBatch → active
          │  (begin processing new messages)
          └─ User can now proceed
             (automatic recovery!)
```

### Recovery Mechanisms

```
LLM Error (during chat/routing)
    ├─ Catch error
    ├─ Log with batch context
    ├─ Clear activeBatch (don't retry)
    ├─ Send error message to user
    └─ Ready for next batch

Tool Execution Error
    ├─ Catch and log
    ├─ Continue with other tools
    ├─ Include error in response
    └─ User sees partial results

DO Crash/Timeout
    ├─ Webhook resends message
    ├─ queueMessage() receives again
    ├─ Deduplication prevents double-process
    └─ New DO invocation succeeds

Router Error
    ├─ Fall through to simpler agent
    ├─ Direct chat() instead of routing
    ├─ User still gets response
    └─ Degraded but functional
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

  // Batch processing
  activeBatch?: {
    batchId: string;
    status: 'processing' | 'delegated';
    pendingMessages: PendingMessage[];
    lastHeartbeat: number;  // For stuck detection
    messageRef?: string | number;  // Reference for edits
    batchStartedAt: number;
  };

  pendingBatch?: {
    batchId: string;
    status: 'collecting';
    pendingMessages: PendingMessage[];
    batchStartedAt: number;
  };

  // Deduplication
  processedRequestIds?: string[];  // Rolling window

  // Custom data
  metadata?: Record<string, unknown>;
}
```

### State Persistence

```
Durable Object Storage (Automatic)
    ├─ Transactional writes
    ├─ Geographically replicated
    ├─ Auto-backup on failure
    └─ Survives worker restart

On setState(newState):
    ├─ State validated
    ├─ Persisted atomically
    ├─ Available immediately on next request
    └─ Replicated globally

Benefits:
    ├─ No separate database needed
    ├─ Sub-millisecond access
    ├─ Transactional guarantees
    └─ Free (included in Cloudflare)
```

---

## Deployment Architecture

### Shared Agent Pattern

To avoid duplicating 8 agents across apps, the system uses **script_name binding**:

```
duyetbot-shared-agents Worker (One deployment)
├─ RouterAgent (Durable Object)
├─ SimpleAgent (Durable Object)
├─ OrchestratorAgent (Durable Object)
├─ HITLAgent (Durable Object)
├─ CodeWorker (Durable Object)
├─ ResearchWorker (Durable Object)
├─ GitHubWorker (Durable Object)
└─ DuyetInfoAgent (Durable Object)

duyetbot-telegram Worker
├─ TelegramAgent (Durable Object)
├─ References shared agents via:
│  └─ [[durable_objects.bindings]]
│     name = "RouterAgent"
│     script_name = "duyetbot-shared-agents"
└─ Result: single code, shared execution

duyetbot-github Worker
├─ GitHubAgent (Durable Object)
├─ References same shared agents
└─ Both bots use same 8 agent instances
```

### Wrangler Configuration

```toml
# apps/telegram-bot/wrangler.toml

name = "duyetbot-telegram"
type = "service"

[env.production]
routes = [
  { pattern = "telegram.duyetbot.workers.dev/*", zone_name = "duyetbot.com" }
]

[[durable_objects.bindings]]
name = "TelegramAgent"
class_name = "TelegramAgent"

# Shared agents from different worker
[[durable_objects.bindings]]
name = "RouterAgent"
class_name = "RouterAgent"
script_name = "duyetbot-shared-agents"

[[durable_objects.bindings]]
name = "SimpleAgent"
class_name = "SimpleAgent"
script_name = "duyetbot-shared-agents"

# ... repeat for all 8 shared agents
```

### Deployment Commands

```bash
# Deploy all workers
bun run deploy

# Deploy individual apps
bun run deploy:telegram
bun run deploy:github
bun run deploy:memory-mcp
bun run deploy:shared

# Rollback
wrangler rollback
```

### Environment Variables

```
ANTHROPIC_API_KEY      # Claude API key
ANTHROPIC_BASE_URL     # Optional: custom endpoint (Z.AI, etc.)
TELEGRAM_BOT_TOKEN     # Telegram bot token (secret)
GITHUB_TOKEN           # GitHub PAT (secret)
GITHUB_WEBHOOK_SECRET  # GitHub webhook verification (secret)
ROUTER_DEBUG           # Enable debug logging (optional)
```

---

## Metrics & Monitoring

### Key Metrics to Track

```
Routing Accuracy
├─ % of queries routed to correct handler
├─ Breakdown by agent type
└─ Identify misclassifications

Processing Latency
├─ P50, P95, P99 response times
├─ Batch size vs latency correlation
└─ LLM call duration

Batch Processing
├─ Messages per batch (avg, p99)
├─ Batch window utilization
├─ Stuck batch count (per day)

Agent Performance
├─ Success rate by agent
├─ Error rate by agent
├─ Token usage per agent
├─ Cost breakdown

System Health
├─ DO invocation success rate
├─ Message deduplication hits
├─ Recovery actions triggered
```

### Logging Pattern

```typescript
logger.info('[ROUTER] Query classified', {
  queryId,           // Trace correlation ID
  type: 'simple',
  category: 'general',
  complexity: 'low',
  routedTo: 'simple-agent',
  latencyMs: 125,
  userId,
  timestamp: Date.now(),
});

logger.warn('[BATCH] Stuck batch detected', {
  batchId,
  duration: '35000ms',
  messageCount: 3,
  action: 'cleared',
});

logger.error('[LLM] Call failed', {
  queryId,
  error: error.message,
  retryable: true,
  attempts: 1,
});
```

---

## Future Architecture

### Tier 2: Long-Running Agent (Planned)

```
Cloud Provider: Cloudflare Sandbox / Fly.io / Custom
Runtime: Node.js/Bun + Linux environment

Use Cases:
├─ Full filesystem access (git clone, file ops)
├─ Shell tools (bash, git, gh CLI, ripgrep)
├─ Long-running tasks (5-30 minutes)
└─ Triggered by Tier 1 via Cloudflare Workflows

Integration:
├─ Tier 1 detects complex task
├─ Creates Cloudflare Workflow
├─ Provisions compute resource
├─ Tier 2 executes with full SDK
├─ Results stream back to user
└─ Resource auto-cleanup on completion

Status: PLANNED (not yet implemented)
```

### Vector Memory (Planned)

```
Cloudflare Vectorize integration

Current: Cross-session memory via memory-mcp (D1 + KV)
Future: Semantic search via embeddings

Benefits:
├─ Find relevant past conversations
├─ Context-aware suggestions
├─ Personalized memory retrieval
└─ Better user experience

Status: PLANNED (not yet implemented)
```

---

## Key Architectural Insights

```
★ Insight: Fire-and-Forget Pattern
├─ Webhook returns <100ms (prevents platform retry)
├─ DO continues with independent 30s timeout
├─ Multiple DOs can chain in series (each gets 30s)
└─ Error isolation prevents cascade failures

★ Insight: Dual-Batch Queue
├─ pendingBatch (always collecting) never blocks
├─ activeBatch (immutable during processing) runs atomically
├─ If activeBatch stuck: pendingBatch promotes automatically
└─ User never blocked, system always responsive

★ Insight: Heartbeat = Liveness Proof
├─ Rotating messages serve dual purpose
├─ User feedback: "Still working on this..."
├─ Liveness proof: edit proves DO alive
├─ Combined with timestamp: enables stuck detection

★ Insight: Transport Abstraction
├─ ~50 lines of transport per app
├─ ~2400 lines of agent logic (reused)
├─ Platform changes = transport change only
├─ Enables rapid platform onboarding

★ Insight: Hybrid Classification
├─ Quick pattern match covers 80% of queries (instant)
├─ LLM fallback handles semantic analysis (slower)
├─ Best of both: speed and accuracy
└─ Graceful degradation under load
```

---

## Quick Reference

- **Package Dependency Graph**: See [Package Architecture](#package-architecture)
- **Message Flow Timing**: See [Message Flow](#message-flow) (T+0ms to T+5002ms)
- **Router Logic**: See [Multi-Agent Routing](#multi-agent-routing-system)
- **Batch Architecture**: See [Batch Processing](#batch-processing-architecture)
- **Deployment**: See [Deployment Architecture](#deployment-architecture)
- **Implementation Status**: See `PLAN.md`

---

## External References

- **Model Context Protocol**: https://modelcontextprotocol.io/
- **Cloudflare Workers**: https://developers.cloudflare.com/workers/
- **Cloudflare Durable Objects**: https://developers.cloudflare.com/durable-objects/
- **Anthropic Claude API**: https://docs.anthropic.com/
- **Telegram Bot API**: https://core.telegram.org/bots/api
- **GitHub Webhooks**: https://docs.github.com/en/developers/webhooks-and-events/webhooks
