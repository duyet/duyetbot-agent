# Agent Flow Architecture

This document describes the multi-agent routing architecture for duyetbot-agent.

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PLATFORM LAYER                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                  │
│   │  Telegram   │     │   GitHub    │     │    CLI      │                  │
│   │    Bot      │     │    Bot      │     │   Client    │                  │
│   └──────┬──────┘     └──────┬──────┘     └──────┬──────┘                  │
│          │                   │                   │                          │
│          └───────────────────┼───────────────────┘                          │
│                              │                                              │
│                              ▼                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                    CloudflareChatAgent                               │  │
│   │                  (Platform Abstraction Layer)                        │  │
│   │                                                                      │  │
│   │  • Handles platform-specific formatting                             │  │
│   │  • Manages conversation history                                     │  │
│   │  • Provides unified API for all platforms                          │  │
│   └────────────────────────────┬────────────────────────────────────────┘  │
│                                │                                            │
└────────────────────────────────┼────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ROUTING LAYER                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                      RouterAgent (DO)                                │  │
│   │                                                                      │  │
│   │  ┌─────────────────────────────────────────────────────────────┐    │  │
│   │  │               Hybrid Classifier                              │    │  │
│   │  │                                                              │    │  │
│   │  │  1. Quick Pattern Match (regex) ──── Instant Response       │    │  │
│   │  │     • Greetings: hi, hello, hey                             │    │  │
│   │  │     • Help: help, ?, what can you do                        │    │  │
│   │  │     • Confirmations: yes, no, approve, reject               │    │  │
│   │  │     • Admin: /clear, reset                                  │    │  │
│   │  │                                                              │    │  │
│   │  │  2. LLM Classification (fallback) ── ~200-500ms             │    │  │
│   │  │     • Analyzes query semantics                              │    │  │
│   │  │     • Determines type, category, complexity                 │    │  │
│   │  │     • Flags human approval requirements                     │    │  │
│   │  └─────────────────────────────────────────────────────────────┘    │  │
│   │                                │                                     │  │
│   │                                ▼                                     │  │
│   │  ┌─────────────────────────────────────────────────────────────┐    │  │
│   │  │            Classification Result                             │    │  │
│   │  │                                                              │    │  │
│   │  │  {                                                          │    │  │
│   │  │    type: "simple" | "complex" | "tool_confirmation"         │    │  │
│   │  │    category: "general" | "code" | "research" | "github"     │    │  │
│   │  │    complexity: "low" | "medium" | "high"                    │    │  │
│   │  │    requiresHumanApproval: boolean                           │    │  │
│   │  │    reasoning: string                                        │    │  │
│   │  │    confidence?: number                                      │    │  │
│   │  │  }                                                          │    │  │
│   │  └─────────────────────────────────────────────────────────────┘    │  │
│   │                                │                                     │  │
│   │                                ▼                                     │  │
│   │  ┌─────────────────────────────────────────────────────────────┐    │  │
│   │  │              Route Target Decision                           │    │  │
│   │  │                                                              │    │  │
│   │  │  Priority Order:                                            │    │  │
│   │  │  1. tool_confirmation ──────────────► hitl-agent            │    │  │
│   │  │  2. complexity: high ───────────────► orchestrator-agent    │    │  │
│   │  │  3. requiresHumanApproval: true ────► hitl-agent            │    │  │
│   │  │  4. type: simple + complexity: low ─► simple-agent          │    │  │
│   │  │  5. category: code ─────────────────► code-worker           │    │  │
│   │  │  6. category: research ─────────────► research-worker       │    │  │
│   │  │  7. category: github ───────────────► github-worker         │    │  │
│   │  │  8. default ────────────────────────► simple-agent          │    │  │
│   │  └─────────────────────────────────────────────────────────────┘    │  │
│   │                                                                      │  │
│   │  State: sessionId, lastClassification, routingHistory               │  │
│   │  Storage: SQLite (Durable Object)                                   │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                │                                            │
└────────────────────────────────┼────────────────────────────────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
        ▼                        ▼                        ▼
┌───────────────┐      ┌─────────────────┐      ┌─────────────────┐
│  SIMPLE PATH  │      │  APPROVAL PATH  │      │  COMPLEX PATH   │
└───────┬───────┘      └────────┬────────┘      └────────┬────────┘
        │                       │                        │
        ▼                       ▼                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AGENT LAYER                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐ │
│  │  SimpleAgent    │  │   HITLAgent     │  │    OrchestratorAgent        │ │
│  │                 │  │                 │  │                             │ │
│  │ • Quick Q&A    │  │ • Tool approval │  │ • Task decomposition        │ │
│  │ • Greetings    │  │ • Confirmations │  │ • Parallel execution        │ │
│  │ • Help text    │  │ • State machine │  │ • Result aggregation        │ │
│  │ • Direct LLM   │  │ • Timeout/retry │  │ • Worker coordination       │ │
│  │                 │  │                 │  │                             │ │
│  │ Complexity:    │  │ States:         │  │ Components:                 │ │
│  │ Low            │  │ • IDLE          │  │ • Planner                   │ │
│  │                 │  │ • AWAITING     │  │ • Executor                  │ │
│  │                 │  │ • APPROVED     │  │ • Aggregator                │ │
│  │                 │  │ • REJECTED     │  │                             │ │
│  │                 │  │ • TIMED_OUT    │  │                             │ │
│  └────────┬────────┘  └────────┬────────┘  └─────────────┬───────────────┘ │
│           │                    │                         │                  │
│           │                    │                         ▼                  │
│           │                    │           ┌─────────────────────────────┐ │
│           │                    │           │        WORKER POOL          │ │
│           │                    │           ├─────────────────────────────┤ │
│           │                    │           │                             │ │
│           │                    │           │ ┌─────────┐ ┌─────────────┐ │ │
│           │                    │           │ │  Code   │ │  Research   │ │ │
│           │                    │           │ │ Worker  │ │   Worker    │ │ │
│           │                    │           │ ├─────────┤ ├─────────────┤ │ │
│           │                    │           │ │• Review │ │• Web search │ │ │
│           │                    │           │ │• Debug  │ │• Doc lookup │ │ │
│           │                    │           │ │• Refactor│ │• Compare   │ │ │
│           │                    │           │ │• Generate│ │• Summarize │ │ │
│           │                    │           │ └─────────┘ └─────────────┘ │ │
│           │                    │           │                             │ │
│           │                    │           │ ┌─────────────────────────┐ │ │
│           │                    │           │ │     GitHub Worker       │ │ │
│           │                    │           │ ├─────────────────────────┤ │ │
│           │                    │           │ │• PR operations          │ │ │
│           │                    │           │ │• Issue management       │ │ │
│           │                    │           │ │• Code review            │ │ │
│           │                    │           │ │• CI/CD status           │ │ │
│           │                    │           │ └─────────────────────────┘ │ │
│           │                    │           │                             │ │
│           │                    │           └──────────────┬──────────────┘ │
│           │                    │                          │                 │
│           └────────────────────┼──────────────────────────┘                 │
│                                │                                            │
└────────────────────────────────┼────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           LLM PROVIDER LAYER                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                      AI Gateway                                      │  │
│   │                  (Cloudflare Workers AI)                            │  │
│   │                                                                      │  │
│   │  • Request routing and caching                                      │  │
│   │  • Rate limiting and analytics                                      │  │
│   │  • Provider abstraction                                             │  │
│   └────────────────────────────┬────────────────────────────────────────┘  │
│                                │                                            │
│         ┌──────────────────────┼──────────────────────┐                    │
│         │                      │                      │                    │
│         ▼                      ▼                      ▼                    │
│   ┌───────────┐         ┌───────────┐         ┌───────────┐               │
│   │  Claude   │         │ OpenRouter│         │   Z.AI    │               │
│   │  (Sonnet) │         │  (Grok)   │         │  (Custom) │               │
│   └───────────┘         └───────────┘         └───────────┘               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MEMORY LAYER                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                   Memory MCP Server                                  │  │
│   │               (Cloudflare Workers D1 + KV)                          │  │
│   │                                                                      │  │
│   │  Tools:                                                             │  │
│   │  • get_memory - Retrieve conversation history                       │  │
│   │  • save_memory - Persist messages and context                       │  │
│   │  • search_memory - Semantic search across sessions                  │  │
│   │  • list_sessions - View all user sessions                          │  │
│   │                                                                      │  │
│   │  Storage:                                                           │  │
│   │  • D1: Metadata, session info, search index                        │  │
│   │  • KV: Message content, large payloads                             │  │
│   │  • Vectorize: Semantic embeddings (planned)                        │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Query Flow Examples

### Example 1: Simple Greeting

```
User: "Hello!"
  │
  ├─► Quick Pattern Match: /^hello/i ✓
  │
  └─► Classification: { type: "simple", category: "general", complexity: "low" }
        │
        └─► Route: simple-agent
              │
              └─► Response: "Hello! How can I help you today?"
```

### Example 2: Code Review Request

```
User: "Review the authentication code in auth.ts"
  │
  ├─► Quick Pattern Match: No match
  │
  └─► LLM Classification
        │
        └─► Classification: {
              type: "complex",
              category: "code",
              complexity: "medium",
              requiresHumanApproval: false
            }
              │
              └─► Route: code-worker
                    │
                    └─► Reads file, analyzes code, returns review
```

### Example 3: Complex Multi-Step Task

```
User: "Refactor the entire authentication system to use JWT"
  │
  ├─► Quick Pattern Match: No match
  │
  └─► LLM Classification
        │
        └─► Classification: {
              type: "complex",
              category: "code",
              complexity: "high",
              requiresHumanApproval: true
            }
              │
              └─► Route: orchestrator-agent
                    │
                    ├─► Planner: Decompose into subtasks
                    │     • Analyze current auth
                    │     • Design JWT schema
                    │     • Update user model
                    │     • Modify endpoints
                    │     • Update tests
                    │
                    ├─► Executor: Run subtasks (parallel where possible)
                    │     code-worker ─► code-worker ─► code-worker
                    │
                    └─► Aggregator: Combine results into final response
```

### Example 4: Tool Confirmation Flow

```
User: "Delete the old config files"
  │
  └─► Classification: {
        type: "complex",
        category: "admin",
        requiresHumanApproval: true
      }
        │
        └─► Route: hitl-agent
              │
              ├─► State: IDLE → AWAITING_APPROVAL
              │
              └─► Response: "I'll delete these files:
                           - config/old.json
                           - config/deprecated.yaml

                           Please confirm: yes/no"

User: "yes"
  │
  └─► Quick Pattern Match: /^yes$/i ✓
        │
        └─► Classification: { type: "tool_confirmation" }
              │
              └─► Route: hitl-agent
                    │
                    ├─► State: AWAITING_APPROVAL → APPROVED
                    │
                    └─► Execute deletion, return result
```

## Agent Responsibilities

| Agent | Purpose | Triggers | Complexity |
|-------|---------|----------|------------|
| **SimpleAgent** | Quick responses, direct LLM calls | Greetings, help, simple Q&A | Low |
| **HITLAgent** | Human approval workflow | Confirmations, destructive ops | Low-Medium |
| **OrchestratorAgent** | Task decomposition & coordination | Multi-step tasks, high complexity | High |
| **CodeWorker** | Code analysis & generation | Review, debug, refactor, generate | Medium |
| **ResearchWorker** | Information gathering | Web search, docs, comparisons | Medium |
| **GitHubWorker** | GitHub operations | PRs, issues, reviews, CI | Medium |

## Configuration

### Environment Variables

```bash
# Enable/disable routing (default: true)
ROUTER_ENABLED=true

# Enable debug logging (default: false)
ROUTER_DEBUG=true
```

### Feature Flags

```typescript
// packages/chat-agent/src/feature-flags.ts
export const routingFlags = {
  enabled: env.ROUTER_ENABLED !== 'false',  // Enabled by default
  debug: env.ROUTER_DEBUG === 'true',       // Disabled by default
};
```

## Monitoring

### Routing Statistics

```typescript
const stats = await routerAgent.getStats();
// {
//   totalRouted: 156,
//   byTarget: {
//     "simple-agent": 89,
//     "code-worker": 34,
//     "research-worker": 18,
//     "github-worker": 12,
//     "hitl-agent": 3
//   },
//   avgDurationMs: 245
// }
```

### Debug Logging

When `ROUTER_DEBUG=true`:

```json
{
  "timestamp": "2025-11-25T06:31:33.058Z",
  "traceId": "trace_abc123",
  "query": "review the auth code...",
  "classification": {
    "type": "complex",
    "category": "code",
    "complexity": "medium",
    "confidence": 0.92
  },
  "target": "code-worker",
  "durationMs": 234
}
```

## Durable Object Bindings

```toml
# wrangler.toml
[[durable_objects.bindings]]
name = "RouterAgent"
class_name = "RouterAgent"

[[migrations]]
tag = "v2"
new_sqlite_classes = ["RouterAgent"]
```

## Related Documentation

- [DEPLOYMENT.md](./DEPLOYMENT.md) - Deployment procedures
- [Agent Patterns Implementation](./designs/AGENT_PATTERNS_IMPLEMENTATION_STATUS.md) - Phase status
- [CLAUDE.md](../CLAUDE.md) - Project overview
