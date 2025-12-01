---
title: Router Agent
desc: Hybrid pattern+LLM classifier routes queries across 8 agents. Instant patterns cover 80%. Semantic fallback.
sidebar_position: 1
keywords: [router-agent, hybrid-classify, routing, classifier, patterns, llm]
slug: /core-concepts/agents/router-agent
---

<!-- i18n: en -->

# Router Agent ✅

**TL;DR**: Analyzes queries with patterns (instant) then LLM. Routes to Simple/Orchestrator/HITL/etc. Saves 75% tokens via smart dispatch.

## Table of Contents
- [Hybrid Flow](#hybrid-flow)
- [Decision Tree](#decision-tree)
- [Code Snippet](#code-snippet)

## Hybrid Flow

RouterAgent uses two-phase classification:

```mermaid
graph TD
  A[User Query] --> B{Pattern Match<br/>10-50ms}
  B -->|hi/help| C[SimpleAgent]
  B -->|No| D[LLM Classify<br/>200-500ms]
  D --> E{type/category<br/>complexity}
  E -->|tool_confirmation| F[HITLAgent]
  E -->|requiresApproval| F
  E -->|duyet| G[DuyetInfoAgent]
  E -->|research medium/high| H[LeadResearcher]
  E -->|high complexity| I[OrchestratorAgent]
  E -->|simple/low| C
  E -->|code/research/github| I
```

**Key**: Patterns hit 80% cases instantly. LLM fallback for semantics.

## Decision Tree

| Priority | Condition | Route |
|----------|-----------|-------|
| 1 | `type: tool_confirmation` | hitl-agent ✅ |
| 2 | `requiresHumanApproval: true` | hitl-agent |
| 3 | `category: duyet` | duyet-info-agent |
| 4 | `research + medium/high` | lead-researcher-agent |
| 5 | `complexity: high` | orchestrator-agent |
| 6 | `simple + low` | simple-agent |
| 7 | `code/research/github` | orchestrator-agent (→workers) |

## Code Snippet

[`packages/chat-agent/src/routing/classifier.ts`](packages/chat-agent/src/routing/classifier.ts:143)
```typescript
export function determineRouteTarget(classification: QueryClassification): RouteTarget {
  if (classification.type === 'tool_confirmation') return 'hitl-agent';
  // ... hybrid logic
}
```

**Quiz**: Router vs Simple?  
A: Router classifies/routs; Simple answers directly ✅

**Glossary**: [Hybrid Classify →](/core-concepts/agents/router-agent#hybrid-flow)

**Related**: [Orchestrator →](./orchestrator-agent.md) | [Architecture →](../architecture.md)

**Try**: `@duyetbot classify "fix this code"` → See routing live!