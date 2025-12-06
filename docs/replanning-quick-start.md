# Bounded Re-Planning - Quick Start Guide

## Quick Overview

Bounded re-planning allows workers to pause execution and request additional planning when they need more context to proceed. The executor will automatically:

1. Pause execution
2. Gather context from completed steps
3. Call the planner to generate new steps
4. Resume execution (maximum 2 times)

## For Workers: How to Signal Re-Planning

### Basic Example

Return `needsMoreContext: true` when you need more information:

```typescript
// Worker returns needsMoreContext when additional context would help
return {
  stepId: step.id,
  success: true,  // Can be true even with needsMoreContext
  data: partialResults,
  durationMs: elapsed,
  needsMoreContext: true,  // Signal for re-planning
  contextSuggestion: 'Need database schema and migration history',
};
```

### Real-World Patterns

#### Pattern 1: Progressive Analysis

```typescript
// Code analysis worker needs related files
if (analysis.needsRelatedFiles) {
  return {
    stepId: step.id,
    success: true,
    data: { imports: extractedImports },
    durationMs: timing,
    needsMoreContext: true,
    contextSuggestion: 'Analyze the imported modules and their dependencies',
  };
}
```

#### Pattern 2: Research with Gaps

```typescript
// Research worker finds incomplete information
if (!hasCompleteInformation) {
  return {
    stepId: step.id,
    success: true,
    data: { foundSoFar: partialFindings },
    durationMs: timing,
    needsMoreContext: true,
    contextSuggestion: 'Research performance benchmarks and scaling patterns',
  };
}
```

#### Pattern 3: Conditional Processing

```typescript
// Worker detects it needs different approach
if (needsDifferentApproach) {
  return {
    stepId: step.id,
    success: true,
    data: { reason: 'Initial approach insufficient' },
    durationMs: timing,
    needsMoreContext: true,
    contextSuggestion: 'Implement alternative approach using X pattern',
  };
}
```

## For Orchestrators: How to Configure

### Basic Setup

```typescript
const config: ExecutorConfig = {
  dispatcher,
  maxParallel: 5,
  continueOnError: true,

  // Enable re-planning
  maxRePlanIterations: 2,      // Max 2 iterations
  plannerConfig: {
    provider: llmProvider,
    maxSteps: 10,
  },
};

const result = await executePlan(plan, context, config);
```

### Understanding the Result

```typescript
// Access re-planning information
console.log(`Iterations: ${result.rePlanIterations}`);    // 0, 1, or 2
console.log(`Original steps: ${result.originalPlan.steps.length}`);
console.log(`Final steps: ${result.finalPlan.steps.length}`);

// Compare plans to understand what changed
if (result.finalPlan.steps.length > result.originalPlan.steps.length) {
  console.log('Re-planning added new steps');
}
```

### Production Configuration

```typescript
const productionConfig: ExecutorConfig = {
  dispatcher: createWorkerDispatcher(workers),
  maxParallel: 5,
  stepTimeoutMs: 60000,        // 60 second timeout
  continueOnError: true,
  maxRePlanIterations: 2,      // Bounded iterations
  plannerConfig: {
    provider: llmProvider,
    maxSteps: 10,
    debug: false,              // Disable debug in production
  },
};
```

## Common Scenarios

### Scenario 1: Code Analysis with Dependencies

```
Initial Plan:
├─ Step 1: Analyze main module
│  └─ Returns: "Need to analyze dependencies"

Re-Planning (Iteration 1):
├─ Step 1: Analyze main module ✓ (completed)
├─ Step 2: Analyze imported modules
├─ Step 3: Map dependency graph
└─ Step 4: Identify optimizations

Result: Complete analysis with all dependencies considered
```

### Scenario 2: Research with Progressive Depth

```
Initial Plan:
├─ Step 1: Search for best practices
│  └─ Returns: "Need more details on performance"

Re-Planning (Iteration 1):
├─ Step 1: Search for best practices ✓
├─ Step 2: Research performance patterns
├─ Step 3: Benchmark approaches
└─ Step 4: Synthesize recommendations

Result: Comprehensive recommendations with performance considerations
```

### Scenario 3: Error Recovery

```
Initial Plan:
├─ Step 1: Implement feature
│  └─ Returns: "Need to verify compatibility first"

Re-Planning (Iteration 1):
├─ Step 1: Implement feature (partial) ✓
├─ Step 2: Check API compatibility
├─ Step 3: Run compatibility tests
└─ Step 4: Complete implementation

Result: Properly validated and compatible implementation
```

## Error Scenarios

### Scenario 1: Planner Fails

```typescript
// If planner.chat() throws an error:
// - Executor logs the error
// - Execution continues with current results
// - No crash, graceful degradation

// Check logs for: "Failed during re-planning"
```

### Scenario 2: No Planner Config

```typescript
// If re-planning triggered but no plannerConfig:
const config: ExecutorConfig = {
  dispatcher,
  // Missing plannerConfig - re-planning disabled!
};

// Executor logs: "Re-planning requested but no planner config provided"
// Execution exits gracefully
```

### Scenario 3: Max Iterations Reached

```typescript
// If worker keeps requesting context:
// Iteration 1: Re-planning triggered
// Iteration 2: Re-planning triggered again
// Max reached: Executor stops re-planning

// Result: rePlanIterations = 2
// Log: "Max re-plan iterations reached"
```

## Monitoring and Debugging

### Key Metrics to Track

```typescript
// From result
result.rePlanIterations;        // How many re-plans occurred
result.originalPlan.steps.length;   // Initial complexity
result.finalPlan.steps.length;      // Final complexity

// Calculate re-planning impact
const stepsAdded = result.finalPlan.steps.length - result.originalPlan.steps.length;
const rePlanningRatio = result.rePlanIterations / result.finalPlan.steps.length;
```

### Debug Logging

```
[Executor] Starting plan execution with re-planning support
[Executor] Executing plan iteration 0
[Executor] Step needs more context - triggering re-plan
[Executor] Pausing execution for re-planning
[Executor] Calling planner for re-planning
[Executor] Plan updated with new steps from re-planning
[Executor] Plan execution completed
```

### Analyze Plans

```typescript
// See what steps were added
const addedSteps = result.finalPlan.steps.filter(
  step => !result.originalPlan.steps.some(orig => orig.id === step.id)
);

console.log('New steps added by re-planning:', addedSteps.map(s => s.id));
```

## Best Practices

### DO

✓ Return `needsMoreContext: true` only when genuinely needed
✓ Provide clear `contextSuggestion` text
✓ Include partial `data` with what was accomplished
✓ Use `success: true` if you made progress
✓ Log why re-planning is being requested

### DON'T

✗ Return `needsMoreContext: true` on every execution
✗ Use vague suggestions like "need more info"
✗ Make `needsMoreContext: true` the default response
✗ Expect more than 2 re-planning iterations
✗ Ignore planner errors silently

## Testing Re-Planning

### Unit Test Example

```typescript
it('should trigger re-planning when needsMoreContext', async () => {
  const dispatcher = async () => ({
    stepId: 'step_1',
    success: true,
    data: 'Partial work',
    durationMs: 100,
    needsMoreContext: true,
    contextSuggestion: 'Need more info',
  });

  const config: ExecutorConfig = {
    dispatcher,
    maxRePlanIterations: 2,
    plannerConfig: { provider: llm },
  };

  const result = await executePlan(plan, context, config);

  expect(result.rePlanIterations).toBeGreaterThan(0);
  expect(result.finalPlan.steps.length).toBeGreaterThan(
    result.originalPlan.steps.length
  );
});
```

## FAQ

### Q: Can I use re-planning with Cloudflare Workers?

A: Yes! Re-planning is fully compatible with Cloudflare Workers runtime. The bounded iteration ensures it completes within reasonable timeouts.

### Q: What if I need more than 2 iterations?

A: The limit is set to 2 by default to prevent infinite loops. If you genuinely need more, this usually indicates:
1. Workers should be smarter about context requests
2. Initial planning should be more comprehensive
3. Consider redesigning the task decomposition

### Q: Does re-planning increase costs?

A: Yes, slightly. Each re-planning iteration calls the planner (LLM). However, better context leads to fewer total steps, so the overall impact is often neutral or positive.

### Q: How do I know if re-planning happened?

A: Check `result.rePlanIterations > 0`. Compare `result.originalPlan` with `result.finalPlan` to see what changed.

### Q: What if the planner fails during re-planning?

A: The executor catches the error and continues with current results. Check logs for error messages and consider:
1. Is the LLM provider rate-limited?
2. Is the re-planning prompt too complex?
3. Is the planner misconfigured?

## Examples

See full examples in:
- `docs/bounded-replanning.md` - Comprehensive guide
- `packages/cloudflare-agent/src/__tests__/orchestration.test.ts` - Test suite with real examples

## Next Steps

1. Implement `needsMoreContext` in your workers
2. Configure `plannerConfig` in executor
3. Test with a sample plan
4. Monitor `rePlanIterations` in production
5. Iterate on context suggestions based on results

---

For more detailed information, see `/docs/bounded-replanning.md`
