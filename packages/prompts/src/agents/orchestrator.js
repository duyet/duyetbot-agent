/**
 * Orchestrator Agent Prompt
 *
 * Complex task decomposition and orchestration.
 * Plans tasks into atomic steps, executes in parallel, aggregates results.
 */
import { createPrompt } from '../builder.js';

/**
 * Orchestrator capabilities
 */
const ORCHESTRATOR_CAPABILITIES = [
  'Break down complex tasks into atomic steps',
  'Execute multiple steps in parallel when possible',
  'Coordinate between specialized workers',
  'Aggregate and synthesize results from multiple sources',
  'Handle failures gracefully with fallback strategies',
];
/**
 * Get the system prompt for OrchestratorAgent
 *
 * Uses platform-neutral `outputFormat` for format specification.
 *
 * @param config - Optional configuration overrides
 * @param config.outputFormat - Format: 'telegram-html', 'telegram-markdown', 'github-markdown', 'plain'
 */
export function getOrchestratorPrompt(config) {
  const builder = createPrompt(config)
    .withIdentity()
    .withPolicy()
    .withCapabilities(ORCHESTRATOR_CAPABILITIES)
    .withCustomSection(
      'orchestration_guidelines',
      `
## Task Decomposition
When given a complex task:
1. Analyze the task to identify atomic sub-tasks
2. Determine dependencies between sub-tasks
3. Group independent tasks for parallel execution
4. Assign each sub-task to the appropriate worker

## Worker Assignment
- CodeWorker: Code review, generation, refactoring, analysis
- ResearchWorker: Information gathering, documentation lookup, comparisons
- GitHubWorker: GitHub operations (PRs, issues, comments)
- GeneralWorker: General tasks that don't fit other categories

## Execution Strategy
- Execute independent tasks in parallel to minimize latency
- Wait for dependencies before starting dependent tasks
- Collect all results before aggregating
- Handle partial failures gracefully

## Result Aggregation
- Combine results from all workers into a coherent response
- Resolve any conflicts between worker outputs
- Present information in a logical, organized manner
- Cite which worker provided each piece of information
`
    );
  // Apply output format if specified
  if (config?.outputFormat) {
    builder.withOutputFormat(config.outputFormat);
  }
  return builder.withGuidelines().build();
}
/**
 * Get the planning prompt for task decomposition
 */
export function getPlanningPrompt() {
  return `You are a task planning assistant. Given a complex task, break it down into atomic steps.

For each step, provide:
1. description: What needs to be done
2. workerType: code, research, github, or general
3. dependencies: Array of step indices this step depends on (empty if none)
4. estimatedComplexity: low, medium, or high

Output a JSON array of steps in execution order.

Guidelines:
- Keep steps atomic and focused
- Identify parallelizable steps (no dependencies on each other)
- Consider error handling and fallback strategies
- Estimate complexity conservatively`;
}
/**
 * Get the aggregation prompt for result synthesis
 */
export function getAggregationPrompt() {
  return `You are a result aggregation assistant. Given outputs from multiple workers, synthesize them into a coherent response.

Guidelines:
- Combine information logically
- Resolve any conflicts between sources
- Present information clearly and organized
- Maintain consistency in tone and style
- Credit sources where appropriate`;
}
