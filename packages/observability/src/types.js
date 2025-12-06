/**
 * Observability types for tracking webhook events, agent executions, and token usage.
 */
/**
 * Convert DebugContext from chat-agent to AgentStep[] for observability storage.
 *
 * @param debugContext - The debug context from StepProgressTracker
 * @returns Array of AgentStep objects with embedded token counts
 */
export function debugContextToAgentSteps(debugContext) {
  const steps = [];
  for (const flow of debugContext.routingFlow) {
    const step = {
      name: flow.agent,
      type: 'agent',
      duration_ms: flow.durationMs ?? 0,
      input_tokens: flow.tokenUsage?.inputTokens ?? 0,
      output_tokens: flow.tokenUsage?.outputTokens ?? 0,
    };
    // Add optional token fields
    if (flow.tokenUsage?.cachedTokens !== undefined) {
      step.cached_tokens = flow.tokenUsage.cachedTokens;
    }
    if (flow.tokenUsage?.reasoningTokens !== undefined) {
      step.reasoning_tokens = flow.tokenUsage.reasoningTokens;
    }
    // Add error if present
    if (flow.error) {
      step.error = flow.error;
    }
    steps.push(step);
  }
  // Add workers as nested steps under orchestrator (if present)
  if (debugContext.workers && debugContext.workers.length > 0) {
    // Find orchestrator in steps
    const orchestratorIndex = steps.findIndex(
      (s) => s.name === 'orchestrator-agent' || s.name === 'orchestrator'
    );
    const workerSteps = debugContext.workers.map((w) => {
      const workerStep = {
        name: w.name,
        type: 'worker',
        duration_ms: w.durationMs ?? 0,
        input_tokens: w.tokenUsage?.inputTokens ?? 0,
        output_tokens: w.tokenUsage?.outputTokens ?? 0,
      };
      if (w.tokenUsage?.cachedTokens !== undefined) {
        workerStep.cached_tokens = w.tokenUsage.cachedTokens;
      }
      if (w.tokenUsage?.reasoningTokens !== undefined) {
        workerStep.reasoning_tokens = w.tokenUsage.reasoningTokens;
      }
      return workerStep;
    });
    const orchestrator = steps[orchestratorIndex];
    if (orchestratorIndex >= 0 && orchestrator) {
      // Nest workers under orchestrator
      orchestrator.workers = workerSteps;
    } else {
      // No orchestrator found, add workers as top-level steps
      steps.push(...workerSteps);
    }
  }
  return steps;
}
