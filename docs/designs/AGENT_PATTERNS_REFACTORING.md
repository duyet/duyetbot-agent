# Agent Patterns Refactoring Design

## Overview

This document outlines the design for refactoring the Cloudflare agents into **Orchestrator-Workers** and **Routing** patterns, based on [Cloudflare Agents Patterns](https://developers.cloudflare.com/agents/patterns/) and Anthropic's research on building effective agents.

### Goals

1. **Query Classification & Routing**: Intelligently route queries to specialized handlers
2. **Orchestrator-Workers**: Break complex tasks into subtasks with parallel execution
3. **Human-in-the-Loop (HITL)**: Support tool confirmation workflows
4. **Separation of Concerns**: Each agent/worker has a single responsibility
5. **Backward Compatibility**: Existing agents continue to work during migration

---

## Current Architecture Analysis

### Existing Structure

```
packages/chat-agent/src/
├── cloudflare-agent.ts    # Monolithic agent factory
├── agent.ts               # ChatAgent class (non-DO)
├── transport.ts           # Platform abstraction
├── types.ts               # Type definitions
└── ...

apps/
├── telegram-bot/src/agent.ts   # TelegramAgent (thin wrapper)
└── github-bot/src/agent.ts     # GitHubAgent (thin wrapper)
```

### Current Flow

```
Webhook → Worker → getChatAgent(name) → Durable Object → chat() → LLM
```

### Problems

1. **Single monolithic agent** - All logic in `createCloudflareChatAgent()`
2. **No query classification** - All queries handled identically
3. **No task orchestration** - Complex tasks not decomposed
4. **No human-in-the-loop** - Tools execute without confirmation
5. **Synchronous tool execution** - No parallel task capability
6. **Tight coupling** - Platform logic mixed with agent logic

---

## Proposed Architecture

### High-Level Design

```
                     ┌─────────────────────────────┐
                     │     Platform Webhooks       │
                     │  (Telegram, GitHub, API)    │
                     └─────────────┬───────────────┘
                                   │
                     ┌─────────────▼───────────────┐
                     │       Router Agent          │
                     │  (Query Classification)     │
                     │                             │
                     │  • Classify query type      │
                     │  • Assess complexity        │
                     │  • Route to specialist      │
                     └─────────────┬───────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
┌─────────▼─────────┐  ┌──────────▼──────────┐  ┌─────────▼─────────┐
│   Simple Agent    │  │  Orchestrator Agent │  │  Human-in-Loop    │
│                   │  │                     │  │     Agent         │
│  • Quick answers  │  │  • Plan complex     │  │                   │
│  • Direct LLM     │  │    tasks            │  │  • Tool confirm   │
│  • No tools       │  │  • Delegate to      │  │  • State persist  │
│                   │  │    workers          │  │  • Resume flow    │
└───────────────────┘  │  • Aggregate        │  └───────────────────┘
                       └──────────┬──────────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         │                        │                        │
┌────────▼────────┐  ┌───────────▼───────────┐  ┌────────▼────────┐
│  Code Worker    │  │   Research Worker     │  │  GitHub Worker  │
│                 │  │                       │  │                 │
│  • Code review  │  │  • Web search         │  │  • PR/Issue ops │
│  • Generation   │  │  • Documentation      │  │  • Code search  │
│  • Analysis     │  │  • Analysis           │  │  • Comments     │
└─────────────────┘  └───────────────────────┘  └─────────────────┘
```

### Agent Types

| Agent | Purpose | Durable Object | Tools |
|-------|---------|----------------|-------|
| RouterAgent | Query classification & routing | Yes (session state) | None |
| SimpleAgent | Direct LLM responses | No (stateless) | None |
| OrchestratorAgent | Task planning & delegation | Yes (execution state) | Planning |
| HITLAgent | Human-in-the-loop workflows | Yes (confirmation state) | Confirmable tools |
| CodeWorker | Code analysis/generation | No (stateless) | Code tools |
| ResearchWorker | Web research & docs | No (stateless) | Research tools |
| GitHubWorker | GitHub operations | No (stateless) | GitHub MCP |

---

## Detailed Component Design

### 1. Router Agent

The RouterAgent classifies incoming queries and routes them appropriately.

```typescript
// packages/chat-agent/src/agents/router-agent.ts

import { Agent } from 'agents';
import { generateObject } from 'ai';
import { z } from 'zod';

const ClassificationSchema = z.object({
  type: z.enum(['simple', 'complex', 'tool_confirmation']),
  category: z.enum(['general', 'code', 'research', 'github', 'admin']),
  complexity: z.enum(['low', 'medium', 'high']),
  requiresHumanApproval: z.boolean(),
  reasoning: z.string(),
});

type Classification = z.infer<typeof ClassificationSchema>;

interface RouterState {
  sessionId: string;
  lastClassification?: Classification;
  routingHistory: Array<{
    query: string;
    classification: Classification;
    routedTo: string;
    timestamp: number;
  }>;
}

export class RouterAgent extends Agent<Env, RouterState> {
  initialState: RouterState = {
    sessionId: '',
    routingHistory: [],
  };

  async route(query: string, context: RouteContext): Promise<Response> {
    const model = this.getModel();

    // Classify the query
    const { object: classification } = await generateObject({
      model,
      schema: ClassificationSchema,
      system: `You are a query classifier. Analyze queries and determine:
        - type: simple (quick answer), complex (multi-step), tool_confirmation (awaiting approval)
        - category: what domain this belongs to
        - complexity: how difficult to handle
        - requiresHumanApproval: if sensitive operations are involved`,
      prompt: `Classify this query: "${query}"

        Context: ${JSON.stringify(context)}`,
    });

    // Update routing history
    this.setState({
      ...this.state,
      lastClassification: classification,
      routingHistory: [
        ...this.state.routingHistory.slice(-9), // Keep last 10
        {
          query,
          classification,
          routedTo: this.determineRoute(classification),
          timestamp: Date.now(),
        },
      ],
    });

    // Route based on classification
    return this.routeToHandler(query, classification, context);
  }

  private determineRoute(classification: Classification): string {
    if (classification.type === 'tool_confirmation') {
      return 'hitl-agent';
    }
    if (classification.type === 'simple' || classification.complexity === 'low') {
      return 'simple-agent';
    }
    if (classification.complexity === 'high') {
      return 'orchestrator-agent';
    }
    return `${classification.category}-worker`;
  }

  private async routeToHandler(
    query: string,
    classification: Classification,
    context: RouteContext
  ): Promise<Response> {
    const route = this.determineRoute(classification);

    switch (route) {
      case 'simple-agent':
        return this.routeToSimple(query, context);
      case 'orchestrator-agent':
        return this.routeToOrchestrator(query, classification, context);
      case 'hitl-agent':
        return this.routeToHITL(query, context);
      default:
        return this.routeToWorker(query, classification.category, context);
    }
  }
}
```

### 2. Human-in-the-Loop Agent

Based on the [Cloudflare HITL pattern](https://developers.cloudflare.com/agents/patterns/), this agent handles tool confirmations.

```typescript
// packages/chat-agent/src/agents/hitl-agent.ts

import { AIChatAgent } from 'agents/ai-chat-agent';
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  stepCountIs,
  type StreamTextOnFinishCallback,
} from 'ai';

interface ToolConfirmation {
  id: string;
  toolName: string;
  toolArgs: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: number;
  respondedAt?: number;
  reason?: string;
}

interface HITLState {
  status: 'idle' | 'awaiting_confirmation' | 'executing' | 'completed';
  pendingConfirmations: ToolConfirmation[];
  executionHistory: Array<{
    toolName: string;
    args: Record<string, unknown>;
    result: unknown;
    timestamp: number;
  }>;
}

export class HumanInTheLoopAgent extends AIChatAgent<Env, HITLState> {
  initialState: HITLState = {
    status: 'idle',
    pendingConfirmations: [],
    executionHistory: [],
  };

  async onChatMessage(onFinish: StreamTextOnFinishCallback<{}>) {
    const lastMessage = this.messages[this.messages.length - 1];

    // Check if this is a tool confirmation response
    if (this.hasToolConfirmation(lastMessage)) {
      return this.processToolConfirmation(lastMessage, onFinish);
    }

    // Normal message processing with confirmable tools
    const result = streamText({
      model: this.getModel(),
      messages: convertToModelMessages(this.messages),
      tools: this.getConfirmableTools(),
      onFinish,
      stopWhen: stepCountIs(5),
    });

    return result.toUIMessageStreamResponse({
      messageMetadata: ({ part }) => this.getMessageMetadata(part),
    });
  }

  private hasToolConfirmation(message: Message): boolean {
    // Check for confirmation UI response
    return message.content?.includes('tool_confirmation:');
  }

  private async processToolConfirmation(
    message: Message,
    onFinish: StreamTextOnFinishCallback<{}>
  ) {
    const confirmation = this.extractConfirmation(message);
    const pending = this.state.pendingConfirmations.find(
      (c) => c.id === confirmation.id
    );

    if (!pending) {
      return this.respondWithError('Confirmation not found or expired');
    }

    if (confirmation.approved) {
      // Execute the confirmed tool
      const stream = createUIMessageStream({
        execute: async ({ writer }) => {
          await this.executeConfirmedTool(writer, pending);
        },
      });
      return createUIMessageStreamResponse({ stream });
    }

    // Handle rejection
    this.setState({
      ...this.state,
      status: 'idle',
      pendingConfirmations: this.state.pendingConfirmations.filter(
        (c) => c.id !== confirmation.id
      ),
    });

    return this.respondWithMessage(
      `Tool "${pending.toolName}" was not executed. ${confirmation.reason || ''}`
    );
  }

  private getConfirmableTools() {
    return {
      // Tools that require confirmation (no execute function)
      deleteFile: tool({
        description: 'Delete a file from the repository',
        parameters: z.object({
          path: z.string().describe('File path to delete'),
          reason: z.string().describe('Reason for deletion'),
        }),
        // No execute = requires confirmation
      }),

      mergePR: tool({
        description: 'Merge a pull request',
        parameters: z.object({
          prNumber: z.number(),
          strategy: z.enum(['merge', 'squash', 'rebase']),
        }),
        // No execute = requires confirmation
      }),

      // Auto-executing tools (have execute function)
      getCurrentTime: tool({
        description: 'Get current server time',
        parameters: z.object({}),
        execute: async () => new Date().toISOString(),
      }),
    };
  }
}
```

### 3. Orchestrator Agent

The OrchestratorAgent breaks complex tasks into subtasks and coordinates workers.

```typescript
// packages/chat-agent/src/agents/orchestrator-agent.ts

import { Agent, getAgentByName } from 'agents';
import { generateObject } from 'ai';
import { z } from 'zod';

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

type ExecutionPlan = z.infer<typeof ExecutionPlanSchema>;

interface OrchestratorState {
  currentPlan?: ExecutionPlan;
  stepResults: Map<string, StepResult>;
  status: 'planning' | 'executing' | 'aggregating' | 'completed' | 'failed';
}

export class OrchestratorAgent extends Agent<Env, OrchestratorState> {
  initialState: OrchestratorState = {
    stepResults: new Map(),
    status: 'planning',
  };

  async orchestrate(task: string, context: OrchestratorContext): Promise<Response> {
    // Phase 1: Planning
    this.setState({ ...this.state, status: 'planning' });
    const plan = await this.createPlan(task, context);

    // Phase 2: Execution
    this.setState({ ...this.state, currentPlan: plan, status: 'executing' });
    const results = await this.executeParallel(plan);

    // Phase 3: Aggregation
    this.setState({ ...this.state, status: 'aggregating' });
    const finalResponse = await this.aggregateResults(plan, results);

    this.setState({ ...this.state, status: 'completed' });
    return new Response(JSON.stringify(finalResponse), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private async createPlan(task: string, context: OrchestratorContext): Promise<ExecutionPlan> {
    const { object: plan } = await generateObject({
      model: openai('o1'), // Use reasoning model for planning
      schema: ExecutionPlanSchema,
      system: `You are a senior software architect planning task execution.
        Break down complex tasks into discrete steps that can be executed by specialized workers.
        Consider dependencies between steps and optimize for parallel execution where possible.`,
      prompt: `Create an execution plan for: "${task}"

        Available workers:
        - code: Code analysis, review, generation
        - research: Web search, documentation lookup
        - github: GitHub API operations (PRs, issues, comments)

        Context: ${JSON.stringify(context)}`,
    });

    return plan;
  }

  private async executeParallel(plan: ExecutionPlan): Promise<Map<string, StepResult>> {
    const results = new Map<string, StepResult>();
    const completed = new Set<string>();

    // Group steps by dependency level for parallel execution
    const groups = this.groupByDependencyLevel(plan.steps);

    for (const group of groups) {
      // Execute all steps in this group in parallel
      const groupResults = await Promise.all(
        group.map(async (step) => {
          const worker = await this.getWorker(step.workerType, step.id);

          // Pass results of dependencies
          const dependencyResults = step.dependsOn?.map((depId) => ({
            stepId: depId,
            result: results.get(depId),
          }));

          try {
            const result = await worker.execute({
              task: step.task,
              context: { dependencyResults },
            });
            return { stepId: step.id, success: true, result };
          } catch (error) {
            return { stepId: step.id, success: false, error: String(error) };
          }
        })
      );

      // Store results
      for (const result of groupResults) {
        results.set(result.stepId, result);
        completed.add(result.stepId);
      }
    }

    return results;
  }

  private async getWorker(type: string, stepId: string) {
    const workerBinding = {
      code: this.env.CodeWorker,
      research: this.env.ResearchWorker,
      github: this.env.GitHubWorker,
    }[type];

    return getAgentByName(workerBinding, `worker:${stepId}`);
  }

  private groupByDependencyLevel(steps: ExecutionPlan['steps']): ExecutionPlan['steps'][] {
    const levels: ExecutionPlan['steps'][] = [];
    const assigned = new Set<string>();

    while (assigned.size < steps.length) {
      const currentLevel = steps.filter((step) => {
        if (assigned.has(step.id)) return false;
        const deps = step.dependsOn || [];
        return deps.every((dep) => assigned.has(dep));
      });

      if (currentLevel.length === 0) {
        throw new Error('Circular dependency detected in execution plan');
      }

      levels.push(currentLevel);
      currentLevel.forEach((step) => assigned.add(step.id));
    }

    return levels;
  }

  private async aggregateResults(
    plan: ExecutionPlan,
    results: Map<string, StepResult>
  ): Promise<AggregatedResponse> {
    const { text: summary } = await generateText({
      model: openai('gpt-4o'),
      system: 'You are a technical lead synthesizing results from multiple specialized workers.',
      prompt: `Synthesize these execution results into a coherent response:

        Plan: ${plan.summary}

        Results:
        ${Array.from(results.entries())
          .map(([id, r]) => `- ${id}: ${r.success ? JSON.stringify(r.result) : r.error}`)
          .join('\n')}`,
    });

    return {
      planId: plan.taskId,
      summary,
      stepCount: plan.steps.length,
      successCount: Array.from(results.values()).filter((r) => r.success).length,
      details: Object.fromEntries(results),
    };
  }
}
```

### 4. Specialized Workers

Workers are stateless agents optimized for specific tasks.

```typescript
// packages/chat-agent/src/workers/code-worker.ts

import { Agent } from 'agents';
import { generateText, generateObject } from 'ai';
import { z } from 'zod';

const CodeReviewSchema = z.object({
  vulnerabilities: z.array(z.string()),
  riskLevel: z.enum(['low', 'medium', 'high']),
  suggestions: z.array(z.string()),
  qualityScore: z.number().min(1).max(10),
});

export class CodeWorker extends Agent<Env> {
  async execute(input: WorkerInput): Promise<WorkerResult> {
    const { task, context } = input;

    // Determine task type
    if (task.includes('review')) {
      return this.reviewCode(task, context);
    }
    if (task.includes('generate')) {
      return this.generateCode(task, context);
    }
    if (task.includes('analyze')) {
      return this.analyzeCode(task, context);
    }

    return this.generalCodeTask(task, context);
  }

  private async reviewCode(task: string, context: unknown): Promise<WorkerResult> {
    const { object: review } = await generateObject({
      model: openai('gpt-4o'),
      schema: CodeReviewSchema,
      system: `You are an expert code reviewer focusing on:
        - Security vulnerabilities and injection risks
        - Performance bottlenecks
        - Code quality and maintainability
        - Best practices adherence`,
      prompt: task,
    });

    return {
      type: 'code_review',
      data: review,
    };
  }

  private async generateCode(task: string, context: unknown): Promise<WorkerResult> {
    const { text: code } = await generateText({
      model: openai('gpt-4o'),
      system: `You are an expert programmer. Generate clean, well-documented code
        following best practices and the project's existing patterns.`,
      prompt: task,
    });

    return {
      type: 'code_generation',
      data: { code },
    };
  }
}
```

---

## File Structure

```
packages/chat-agent/src/
├── agents/
│   ├── index.ts                 # Agent exports
│   ├── base-agent.ts            # Abstract base with common DO functionality
│   ├── router-agent.ts          # Query classification & routing
│   ├── orchestrator-agent.ts    # Task decomposition & coordination
│   ├── simple-agent.ts          # Direct LLM responses (stateless)
│   └── hitl-agent.ts            # Human-in-the-loop workflows
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
├── cloudflare-agent.ts          # EXISTING - kept for backward compat
├── agent.ts                     # EXISTING - ChatAgent class
├── transport.ts                 # EXISTING - Platform abstraction
├── types.ts                     # EXISTING + new types
└── index.ts                     # Updated exports
```

---

## Migration Strategy

### Phase 1: Core Infrastructure (Week 1-2) ✅ COMPLETED

1. Create base agent abstractions
2. Implement RouterAgent
3. Implement SimpleAgent
4. Add routing schemas and classifier

**Tasks:**
- [x] Create `agents/base-agent.ts` with common DO functionality
- [x] Create `routing/schemas.ts` with classification schemas
- [x] Create `routing/classifier.ts` with LLM classification
- [x] Create `agents/router-agent.ts`
- [x] Create `agents/simple-agent.ts`
- [x] Add unit tests for routing (22 tests passing)

### Phase 2: Human-in-the-Loop (Week 2-3)

1. Implement HITL state machine
2. Create tool confirmation workflow
3. Integrate with AI SDK streaming

**Tasks:**
- [ ] Create `hitl/state-machine.ts`
- [ ] Create `hitl/confirmation.ts`
- [ ] Create `hitl/executions.ts`
- [ ] Create `agents/hitl-agent.ts`
- [ ] Add HITL integration tests

### Phase 3: Orchestrator-Workers (Week 3-4)

1. Implement OrchestratorAgent
2. Create specialized workers
3. Build parallel execution engine

**Tasks:**
- [ ] Create `orchestration/planner.ts`
- [ ] Create `orchestration/executor.ts`
- [ ] Create `orchestration/aggregator.ts`
- [ ] Create `agents/orchestrator-agent.ts`
- [ ] Create `workers/code-worker.ts`
- [ ] Create `workers/research-worker.ts`
- [ ] Create `workers/github-worker.ts`
- [ ] Add orchestration tests

### Phase 4: Platform Integration (Week 4-5)

1. Migrate TelegramAgent to use new routing
2. Migrate GitHubAgent to use new routing
3. Feature flag for gradual rollout

**Tasks:**
- [ ] Add feature flag for new routing
- [ ] Update TelegramAgent to optionally use RouterAgent
- [ ] Update GitHubAgent to optionally use RouterAgent
- [ ] Add integration tests for full flows
- [ ] Performance testing

### Phase 5: Validation & Rollout (Week 5-6)

1. A/B testing with existing system
2. Monitor metrics (latency, accuracy, cost)
3. Gradual rollout to production
4. Documentation updates

**Tasks:**
- [ ] Set up A/B testing infrastructure
- [ ] Create monitoring dashboards
- [ ] Gradual rollout (10% → 50% → 100%)
- [ ] Update CLAUDE.md and README
- [ ] Create migration guide for custom agents

---

## Configuration

### Wrangler Configuration

```toml
# wrangler.toml additions

[[durable_objects.bindings]]
name = "RouterAgent"
class_name = "RouterAgent"

[[durable_objects.bindings]]
name = "OrchestratorAgent"
class_name = "OrchestratorAgent"

[[durable_objects.bindings]]
name = "HITLAgent"
class_name = "HITLAgent"

[[durable_objects.bindings]]
name = "CodeWorker"
class_name = "CodeWorker"

[[durable_objects.bindings]]
name = "ResearchWorker"
class_name = "ResearchWorker"

[[durable_objects.bindings]]
name = "GitHubWorker"
class_name = "GitHubWorker"

[[migrations]]
tag = "v2"
new_classes = ["RouterAgent", "OrchestratorAgent", "HITLAgent", "CodeWorker", "ResearchWorker", "GitHubWorker"]
```

### Environment Types

```typescript
// packages/chat-agent/src/types/env.ts

import type { AgentNamespace } from 'agents';

export interface AgentEnv {
  // Existing
  TelegramAgent: AgentNamespace<TelegramAgent>;
  GitHubAgent: AgentNamespace<GitHubAgent>;

  // New - Routing Layer
  RouterAgent: AgentNamespace<RouterAgent>;

  // New - Orchestration Layer
  OrchestratorAgent: AgentNamespace<OrchestratorAgent>;
  HITLAgent: AgentNamespace<HITLAgent>;

  // New - Worker Layer
  CodeWorker: AgentNamespace<CodeWorker>;
  ResearchWorker: AgentNamespace<ResearchWorker>;
  GitHubWorker: AgentNamespace<GitHubWorker>;

  // AI Bindings
  AI: Ai;
}
```

---

## Testing Strategy

### Unit Tests

```typescript
// packages/chat-agent/src/__tests__/routing/classifier.test.ts

describe('QueryClassifier', () => {
  it('classifies simple queries correctly', async () => {
    const result = await classifier.classify('What time is it?');
    expect(result.type).toBe('simple');
    expect(result.complexity).toBe('low');
  });

  it('classifies complex queries correctly', async () => {
    const result = await classifier.classify(
      'Review this PR for security issues, then create a summary and post it to Slack'
    );
    expect(result.type).toBe('complex');
    expect(result.complexity).toBe('high');
  });

  it('identifies HITL queries', async () => {
    const result = await classifier.classify('Delete all test files');
    expect(result.requiresHumanApproval).toBe(true);
  });
});
```

### Integration Tests

```typescript
// packages/chat-agent/src/__tests__/orchestration/e2e.test.ts

describe('Orchestrator E2E', () => {
  it('plans and executes multi-step tasks', async () => {
    const orchestrator = await getAgentByName(env.OrchestratorAgent, 'test');

    const result = await orchestrator.orchestrate(
      'Review the authentication code and summarize security concerns',
      { repo: 'test/repo' }
    );

    expect(result.stepCount).toBeGreaterThan(1);
    expect(result.successCount).toBe(result.stepCount);
    expect(result.summary).toContain('security');
  });
});
```

---

## Metrics & Monitoring

### Key Metrics

1. **Routing Accuracy**: % of queries routed to correct handler
2. **Orchestration Efficiency**: Parallel vs sequential execution ratio
3. **HITL Conversion**: % of confirmations approved
4. **Latency**: P50, P95, P99 for each agent type
5. **Cost**: Token usage per query type

### Logging

```typescript
// Structured logging for observability
logger.info('[ROUTER] Query classified', {
  queryId,
  type: classification.type,
  category: classification.category,
  complexity: classification.complexity,
  routedTo: route,
  latencyMs: Date.now() - startTime,
});
```

---

## References

- [Cloudflare Agents Patterns](https://developers.cloudflare.com/agents/patterns/)
- [Cloudflare Agents API](https://developers.cloudflare.com/agents/api-reference/)
- [Building Agents with OpenAI and Cloudflare](https://blog.cloudflare.com/building-agents-with-openai-and-cloudflares-agents-sdk/)
- [Anthropic: Building Effective Agents](https://www.anthropic.com/engineering/building-effective-agents)
- [AI SDK Documentation](https://sdk.vercel.ai/docs)

---

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2025-11-25 | Claude | Initial design document |
| 2025-11-25 | Claude | Phase 1 completed: base-agent, router-agent, simple-agent, routing schemas/classifier, 22 tests |

## Implementation Status

See [AGENT_PATTERNS_IMPLEMENTATION_STATUS.md](./AGENT_PATTERNS_IMPLEMENTATION_STATUS.md) for detailed progress tracking.
