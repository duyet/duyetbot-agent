---
title: Router Agent (LEGACY)
description: DEPRECATED - This document describes the legacy multi-agent routing system that was removed in December 2024.
deprecated: true
---

<!-- i18n: en -->

> **DEPRECATION NOTICE**: This document describes the legacy RouterAgent which was removed in December 2024 as part of the loop-based agent refactoring. The system now uses a single `CloudflareChatAgent` with tool iterations instead of multi-agent routing. See [architecture.md](../architecture.md) for current implementation.

## Legacy Documentation

**TL;DR** (Historical): Analyzed queries with patterns (instant) then LLM. Routed to Simple/Orchestrator/HITL/etc. Saved 75% tokens via smart dispatch.

## Table of Contents
- [Hybrid Flow](#hybrid-flow)
- [Decision Tree](#decision-tree)
- [Code Snippet](#code-snippet)

## Hybrid Flow

RouterAgent uses two-phase classification:

```
                       User Query
                           |
                           v
                   Pattern Match?
                  (10-50ms check)
                    |         |
                 YES|         |NO
                    |         v
                    |    LLM Classify
                    |    (200-500ms)
                    |         |
                    |         v
                    |    Classify result?
                    |  (type/category/complexity)
                    |         |
       +----+----+----+----+----+------+----------+
       |    |    |    |    |    |      |          |
    hi/help tool_ duyet research  high code/ research
       |    confm |        |(med) complex github
       |    |    |        | ity |
       v    v    v        v     v     v          v
    Simple HITL Duyet LeadResearch Orchestr Orchestr
    Agent Agent Agent    Worker    Agent    Agent
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
| 7 | `code/research/github` | orchestrator-agent (->workers) |

## Code Snippet

[`packages/cloudflare-agent/src/routing/classifier.ts`](packages/cloudflare-agent/src/routing/classifier.ts:143)
```typescript
export function determineRouteTarget(classification: QueryClassification): RouteTarget {
  if (classification.type === 'tool_confirmation') return 'hitl-agent';
  // ... hybrid logic
}
```

**Quiz**: Router vs Simple?  
A: Router classifies/routs; Simple answers directly ✅

**Glossary**: [Hybrid Classify ->](/core-concepts/agents/router-agent#hybrid-flow)

**Related**: [Orchestrator ->](./orchestrator-agent.md) | [Architecture ->](../architecture.md)

**Try**: `@duyetbot classify "fix this code"` -> See routing live!