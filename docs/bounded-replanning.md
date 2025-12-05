# Bounded Re-Planning in the Executor

## Overview

The executor now supports **bounded re-planning** that allows workers to request additional planning iterations when they need more context to proceed. This feature enables adaptive task decomposition where the orchestrator can respond to worker feedback and generate new steps on-the-fly.

## Key Features

- **Triggered Re-Planning**: Workers can signal `needsMoreContext` flag to pause execution
- **Bounded Iterations**: Maximum 2 re-planning iterations to prevent infinite loops
- **Context Preservation**: Completed steps are retained and used as context for new steps
- **Error Resilience**: Graceful handling of planner failures
- **Full Traceability**: Original and final plans are tracked in execution results

## How It Works

### 1. Normal Execution (No Re-Planning)

```typescript
// Step executes successfully without requesting more context
const result = {
  stepId: 'step_1',
  success: true,
  data: 'Step result',
  durationMs: 100,
  needsMoreContext: false  // or omitted
};
```

Execution continues normally through the plan.

### 2. Triggering Re-Planning

When a worker needs additional context:

```typescript
// Worker returns needsMoreContext flag
const result = {
  stepId: 'step_1',
  success: true,
  data: 'Partial result',
  durationMs: 100,
  needsMoreContext: true,  // Triggers re-planning
  contextSuggestion: 'Need access to related configuration files'
};
```

Execution pauses and the executor:

1. Pauses execution at the current level
2. Gathers context from successful steps
3. Calls the planner with the re-planning request
4. Merges new steps into the plan
5. Resumes execution

### 3. Re-Planning Process

```
Initial Plan Execution
         |
         v
Worker returns needsMoreContext
         |
         v
Pause Execution (Iteration 1/2)
         |
         v
Build Context:
- Completed steps
- Their results
- Worker suggestions
         |
         v
Call Planner for New Steps
         |
         v
Merge & Continue Execution
         |
         v
(If needed) Repeat for Iteration 2
         |
         v
Max iterations reached -> Exit
```

## Configuration

### ExecutorConfig Options

```typescript
interface ExecutorConfig {
  // Existing options...
  dispatcher: WorkerDispatcher;
  maxParallel?: number;
  stepTimeoutMs?: number;
  continueOnError?: boolean;

  // New re-planning options
  maxRePlanIterations?: number;      // Default: 2
  plannerConfig?: PlannerConfig;      // Required for re-planning
}
```

### Usage Example

```typescript
const config: ExecutorConfig = {
  dispatcher: createWorkerDispatcher(workerMap),
  maxParallel: 5,
  stepTimeoutMs: 60000,
  continueOnError: true,
  maxRePlanIterations: 2,  // Bounded iterations
  plannerConfig: {
    provider: llmProvider,
    maxSteps: 10,
    debug: true,
  },
};

const result = await executePlan(plan, context, config);
```

## Execution Result Enhancements

The `ExecutionResult` now includes:

```typescript
interface ExecutionResult {
  // Existing fields...
  results: Map<string, WorkerResult>;
  successfulSteps: string[];
  failedSteps: string[];
  skippedSteps: string[];
  totalDurationMs: number;
  allSucceeded: boolean;

  // New fields for re-planning tracking
  rePlanIterations: number;          // How many re-plans occurred
  originalPlan: ExecutionPlan;       // Initial plan before any re-planning
  finalPlan: ExecutionPlan;          // Plan after all iterations
}
```

## Implementation Details

### Schema Changes

Added two fields to `WorkerResult`:

```typescript
export const WorkerResultSchema = z.object({
  stepId: z.string(),
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  durationMs: z.number(),
  tokensUsed: z.number().optional(),

  // New fields for re-planning
  needsMoreContext: z.boolean().optional(),
  contextSuggestion: z.string().optional(),
});
```

### Re-Planning Logic

**Key Algorithm Decisions:**

1. **Step ID Prefixing**: New steps from re-planning are prefixed with `_rp` to avoid ID conflicts
2. **Dependency Mapping**: Dependencies are updated to reference either completed steps or re-planned versions
3. **Context Building**: Completed step results are summarized for the planner
4. **Iteration Bound**: Maximum 2 iterations (hard limit) prevents infinite loops

### Helper Functions

#### `buildReplanningPrompt()`

Constructs a prompt for the planner that includes:
- Original task summary
- Completed steps and their results
- Failed steps
- Worker context suggestions

```typescript
// Example output:
// Original plan: Implement authentication system
// Steps completed: step_1, step_2
// Steps failed: none
// Completed results:
// - step_1: User model created with email validation
// - step_2: JWT middleware implemented
// Context suggestion from worker: Need database migration strategy
```

#### `mergeRePlanedSteps()`

Merges new steps into the existing plan:
1. Keeps successfully completed steps
2. Adds new re-planned steps with modified IDs
3. Updates dependency references
4. Combines complexity estimates

## Use Cases

### 1. Progressive Code Analysis

```
Initial Plan: Analyze module
Step 1: Review imports and exports
  -> Returns needsMoreContext: "Need access to dependencies"

Re-Planning:
Step 2: Analyze dependent modules
Step 3: Map dependency graph
Step 4: Identify optimization opportunities
```

### 2. Adaptive Research

```
Initial Plan: Research framework best practices
Step 1: Search documentation
  -> Returns needsMoreContext: "Need more details on performance patterns"

Re-Planning:
Step 2: Research performance optimization patterns
Step 3: Benchmark implementation approaches
Step 4: Synthesize recommendations
```

### 3. Multi-Phase Refactoring

```
Initial Plan: Refactor legacy code
Step 1: Identify issues and patterns
  -> Returns needsMoreContext: "Need test coverage analysis first"

Re-Planning:
Step 2: Analyze test coverage
Step 3: Plan test improvements
Step 4: Execute refactoring with test safety
```

## Error Handling

### Planner Failures

If the planner fails during re-planning:

```typescript
try {
  const newPlan = await createPlan(replanningPrompt, config.plannerConfig);
  // Merge and continue
} catch (error) {
  AgentMixin.logError('Executor', 'Failed during re-planning', error);
  // Break gracefully - return current results
  break;
}
```

### Missing Planner Config

If re-planning is triggered but no planner config is provided:

```typescript
if (replanNeeded && rePlanIterations < maxRePlanIterations) {
  if (config.plannerConfig) {
    // Proceed with re-planning
  } else {
    // Log warning and exit gracefully
    AgentMixin.log('Executor', 'Re-planning requested but no planner config');
    break;
  }
}
```

## Performance Characteristics

- **Bounded Iterations**: Maximum 2 re-plans ensures O(1) iteration count
- **Parallel Execution**: Steps within each level still execute in parallel
- **Early Exit**: Re-planning stops when no more context is needed
- **Context Overhead**: Planning overhead scales with completed step count

## Logging and Observability

Key log events:

```
[Executor] Starting plan execution with re-planning support
[Executor] Step needs more context - triggering re-plan
[Executor] Pausing execution for re-planning
[Executor] Calling planner for re-planning
[Executor] Plan updated with new steps from re-planning
[Executor] Max re-plan iterations reached
[Executor] Failed during re-planning
[Executor] Plan execution completed
```

Each log includes:
- `traceId`: Execution trace ID
- `rePlanIterations`: Current iteration count
- `maxRePlanIterations`: Maximum allowed
- `contextSuggestion`: Worker suggestion (first 100 chars)
- Additional step/result context

## Testing

Comprehensive test suite in `orchestration.test.ts`:

1. **Normal Execution**: Verifies no re-planning when not needed
2. **Re-Planning Trigger**: Tests context detection and re-plan initiation
3. **Iteration Bounds**: Ensures max iterations are respected
4. **Error Handling**: Tests graceful failure handling
5. **Plan Tracking**: Verifies original/final plan preservation

Run tests:

```bash
bun run test --filter @duyetbot/chat-agent -- orchestration
```

## Best Practices

### For Workers

1. **Return `needsMoreContext` only when necessary**: Avoid excessive re-planning
2. **Provide clear suggestions**: Use `contextSuggestion` to guide the planner
3. **Include partial results**: Mark `success: true` if work was partially done
4. **Estimate impact**: Only trigger re-planning if it will significantly improve outcomes

### For Orchestrators

1. **Provide planner config**: Always set `plannerConfig` if re-planning is possible
2. **Monitor iteration count**: Track `rePlanIterations` in results
3. **Compare plans**: Use `originalPlan` vs `finalPlan` for debugging
4. **Adjust bounds**: Set `maxRePlanIterations` based on domain (usually 2 is sufficient)

### For Debuggers

1. **Check trace logs**: Look for "Step needs more context" messages
2. **Review final plan**: See what new steps were added
3. **Compare results**: Original plan vs re-planned plan execution times
4. **Analyze suggestions**: Read `contextSuggestion` to understand triggers

## Future Enhancements

Potential improvements:

1. **Adaptive Bounds**: Adjust `maxRePlanIterations` based on task complexity
2. **Context Caching**: Cache common re-planning prompts for faster iteration
3. **Suggestion Ranking**: Prioritize high-confidence re-planning requests
4. **Metrics**: Track re-planning frequency and impact per worker type
5. **Batch Re-Planning**: Handle multiple workers requesting context simultaneously

## References

- **Executor**: `packages/chat-agent/src/orchestration/executor.ts`
- **Schemas**: `packages/chat-agent/src/routing/schemas.ts`
- **Tests**: `packages/chat-agent/src/__tests__/orchestration.test.ts`
- **Orchestration Pattern**: [Cloudflare Agents - Orchestrator-Workers](https://developers.cloudflare.com/agents/patterns/orchestrator-workers/)
