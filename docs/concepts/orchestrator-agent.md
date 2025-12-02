---
title: Orchestrator Agent
desc: "Decomposes complex tasks into parallel worker steps. Plans, executes, aggregates Code/Research/GitHub workers."
sidebar_position: 3
keywords: [orchestrator-agent, task-decomposition, parallel-workers, planner-executor, aggregation]
slug: /core-concepts/agents/orchestrator-agent
---

<!-- i18n: en -->

# Orchestrator Agent ✅

**TL;DR**: Plans high-complexity tasks. Dispatches parallel Code/Research/GitHub Workers. Aggregates results. Router → Orchestrator → Workers.

## Table of Contents
- [Flow](#flow)
- [Parallel Execution](#parallel-execution)
- [Code Snippet](#code-snippet)

## Flow

```
     Router Routes
    (high complexity)
           │
           ▼
   OrchestratorAgent
           │
           ▼
   Planner: LLM Plan
           │
           ▼
 Executor: Group Levels
           │
           ▼
  Parallel Workers
      Level 1
           │
           ▼
  Parallel Workers
      Level 2
           │
           ▼
 Aggregator: Synthesize
           │
           ▼
   Final Response
```

**Key**: Dependency levels enable parallelism. Continues on worker errors.

## Parallel Execution

| Level | Steps | Workers | Example |
|-------|-------|---------|---------|
| 0 | No deps | ResearchWorker | "Latest React docs" |
| 1 | Deps L0 | CodeWorker | Review code after research |
| 2 | Deps L1 | GitHubWorker | Comment on PR |

**Planner** → [`orchestration/planner.ts`](packages/chat-agent/src/orchestration/planner.ts:99)

**Executor** → Levels via topological sort.

## Code Snippet

[`packages/chat-agent/src/orchestration/executor.ts`](packages/chat-agent/src/orchestration/executor.ts:70)
```typescript
const stepGroups = groupStepsByLevel(plan.steps);
for (const group of stepGroups) {
  await Promise.allSettled(group.map(step => executeStep(...)));
}
```

**Quiz**: Orchestrator vs Router?  
A: Orchestrator executes multi-step; Router single dispatch ✅

**Related**: [Workers →](../tools.md) | [Router →](./router-agent.md)

**Try**: `@duyetbot "Research React hooks, review code, comment PR"` → Orchestrator live!