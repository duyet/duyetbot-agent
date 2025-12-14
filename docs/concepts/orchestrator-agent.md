---
title: Orchestrator Agent (LEGACY)
description: DEPRECATED - This document describes the legacy OrchestratorAgent which was removed in December 2024.
deprecated: true
---

<!-- i18n: en -->

> **DEPRECATION NOTICE**: This document describes the legacy OrchestratorAgent which was removed in December 2024 as part of the loop-based agent refactoring. The system now uses a single `CloudflareChatAgent` with tool iterations and the `plan` tool for task decomposition. See [architecture.md](../architecture.md) for current implementation.

## Legacy Documentation

**TL;DR** (Historical): Planned high-complexity tasks. Dispatched parallel Code/Research/GitHub Workers. Aggregated results. Router -> Orchestrator -> Workers.

## Table of Contents
- [Flow](#flow)
- [Parallel Execution](#parallel-execution)
- [Code Snippet](#code-snippet)

## Flow

```
    Router Routes
   (high complexity)
          |
          v
  OrchestratorAgent
          |
          v
  Planner: LLM Plan
          |
          v
 Executor: Group Levels
          |
          v
 Parallel Workers
     Level 1
          |
          v
 Parallel Workers
     Level 2
          |
          v
 Aggregator: Synthesize
          |
          v
  Final Response
```

**Key**: Dependency levels enable parallelism. Continues on worker errors.

## Parallel Execution

| Level | Steps | Workers | Example |
|-------|-------|---------|---------|
| 0 | No deps | ResearchWorker | "Latest React docs" |
| 1 | Deps L0 | CodeWorker | Review code after research |
| 2 | Deps L1 | GitHubWorker | Comment on PR |

**Planner** -> [`orchestration/planner.ts`](packages/cloudflare-agent/src/orchestration/planner.ts:99)

**Executor** -> Levels via topological sort.

## Code Snippet

[`packages/cloudflare-agent/src/orchestration/executor.ts`](packages/cloudflare-agent/src/orchestration/executor.ts:70)
```typescript
const stepGroups = groupStepsByLevel(plan.steps);
for (const group of stepGroups) {
  await Promise.allSettled(group.map(step => executeStep(...)));
}
```

**Quiz**: Orchestrator vs Router?  
A: Orchestrator executes multi-step; Router single dispatch ✅

**Related**: [Workers ->](../tools.md) | [Router ->](./router-agent.md)

**Try**: `@duyetbot "Research React hooks, review code, comment PR"` -> Orchestrator live!