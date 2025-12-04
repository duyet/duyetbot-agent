/**
 * Result Aggregator
 *
 * Aggregates and synthesizes results from multiple workers.
 * Produces final unified responses from distributed execution.
 *
 * Based on Cloudflare's Orchestrator-Workers pattern:
 * https://developers.cloudflare.com/agents/patterns/orchestrator-workers/
 */

import { AgentMixin } from '../agents/base-agent.js';
import type { AgentProvider } from '../execution/agent-provider.js';
import type { ExecutionPlan } from '../routing/schemas.js';
import type { LLMProvider } from '../types.js';
import type { ExecutionResult } from './executor.js';

/**
 * Aggregator configuration
 */
export interface AggregatorConfig {
  /** LLM/Agent provider for synthesis */
  provider: LLMProvider | AgentProvider;
  /** Maximum tokens for aggregation response */
  maxTokens?: number;
  /** Enable detailed logging */
  debug?: boolean;
}

/**
 * Aggregation result
 */
export interface AggregationResult {
  /** Synthesized response */
  response: string;
  /** Summary of execution */
  summary: {
    totalSteps: number;
    successCount: number;
    failureCount: number;
    skippedCount: number;
    totalDurationMs: number;
  };
  /** Individual step outputs (structured) */
  stepOutputs: Array<{
    stepId: string;
    success: boolean;
    output: unknown;
    error?: string;
  }>;
  /** Any errors encountered */
  errors: Array<{
    stepId: string;
    error: string;
  }>;
}

/**
 * System prompt for result aggregation
 */
const AGGREGATION_SYSTEM_PROMPT = `You are an expert at synthesizing results from multiple task executions into a coherent response.

## Your Role
- Combine results from multiple workers into a unified response
- Highlight key findings and insights
- Maintain logical flow and organization
- Acknowledge any failures or partial results
- Provide actionable conclusions

## Output Guidelines
- Start with a brief summary/overview
- Present results in logical order
- Use appropriate formatting (headers, bullets, code blocks)
- Highlight important findings
- Note any errors or incomplete results
- End with conclusions or next steps if appropriate`;

/**
 * Aggregate execution results into a final response
 */
export async function aggregateResults(
  plan: ExecutionPlan,
  executionResult: ExecutionResult,
  config: AggregatorConfig
): Promise<AggregationResult> {
  const startTime = Date.now();

  AgentMixin.log('Aggregator', 'Starting result aggregation', {
    taskId: plan.taskId,
    successCount: executionResult.successfulSteps.length,
    failureCount: executionResult.failedSteps.length,
  });

  // Extract step outputs and errors
  const stepOutputs: AggregationResult['stepOutputs'] = [];
  const errors: AggregationResult['errors'] = [];

  for (const step of plan.steps) {
    const result = executionResult.results.get(step.id);
    if (result) {
      const stepOutput: AggregationResult['stepOutputs'][number] = {
        stepId: step.id,
        success: result.success,
        output: result.data,
      };
      if (result.error) {
        stepOutput.error = result.error;
      }
      stepOutputs.push(stepOutput);

      if (!result.success && result.error) {
        errors.push({
          stepId: step.id,
          error: result.error,
        });
      }
    }
  }

  // Build summary
  const summary = {
    totalSteps: plan.steps.length,
    successCount: executionResult.successfulSteps.length,
    failureCount: executionResult.failedSteps.length,
    skippedCount: executionResult.skippedSteps.length,
    totalDurationMs: executionResult.totalDurationMs,
  };

  // If all steps failed or were skipped, return error summary
  if (summary.successCount === 0) {
    return {
      response: formatFailureResponse(plan, errors),
      summary,
      stepOutputs,
      errors,
    };
  }

  // Use LLM to synthesize results
  try {
    const response = await synthesizeWithLLM(plan, executionResult, stepOutputs, config);

    AgentMixin.log('Aggregator', 'Aggregation completed', {
      taskId: plan.taskId,
      durationMs: Date.now() - startTime,
    });

    return {
      response,
      summary,
      stepOutputs,
      errors,
    };
  } catch (error) {
    AgentMixin.logError('Aggregator', 'LLM synthesis failed', error);

    // Fallback to simple aggregation
    return {
      response: formatSimpleAggregation(plan, executionResult, stepOutputs),
      summary,
      stepOutputs,
      errors,
    };
  }
}

/**
 * Synthesize results using LLM
 */
async function synthesizeWithLLM(
  plan: ExecutionPlan,
  executionResult: ExecutionResult,
  stepOutputs: AggregationResult['stepOutputs'],
  config: AggregatorConfig
): Promise<string> {
  // Build context from results
  const resultContext = stepOutputs
    .filter((s) => s.success)
    .map((s) => {
      const step = plan.steps.find((p) => p.id === s.stepId);
      const outputStr = typeof s.output === 'string' ? s.output : JSON.stringify(s.output, null, 2);
      return `### ${step?.description || s.stepId}\n${outputStr.slice(0, 2000)}${outputStr.length > 2000 ? '...' : ''}`;
    })
    .join('\n\n');

  // Build error context if any
  const errorContext =
    stepOutputs.filter((s) => !s.success).length > 0
      ? `\n\n## Errors\n${stepOutputs
          .filter((s) => !s.success)
          .map((s) => `- ${s.stepId}: ${s.error}`)
          .join('\n')}`
      : '';

  const userPrompt = `Synthesize the following execution results into a coherent response.

## Original Task
${plan.summary}

## Execution Results
${resultContext}
${errorContext}

## Statistics
- Steps: ${plan.steps.length} total, ${executionResult.successfulSteps.length} succeeded, ${executionResult.failedSteps.length} failed
- Duration: ${executionResult.totalDurationMs}ms

Please provide a unified response that addresses the original task.`;

  const response = await config.provider.chat([
    { role: 'system', content: AGGREGATION_SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ]);

  return response.content;
}

/**
 * Format a failure response when all steps failed
 */
function formatFailureResponse(plan: ExecutionPlan, errors: AggregationResult['errors']): string {
  const errorList = errors.map((e) => `- **${e.stepId}**: ${e.error}`).join('\n');

  return `## Task Failed

Unfortunately, the task "${plan.summary}" could not be completed.

### Errors Encountered
${errorList}

### Suggestions
- Check the error messages for specific issues
- Verify that all required resources are available
- Consider breaking down the task into smaller parts
- Retry individual steps that may have failed due to temporary issues`;
}

/**
 * Format simple aggregation without LLM
 */
function formatSimpleAggregation(
  plan: ExecutionPlan,
  executionResult: ExecutionResult,
  stepOutputs: AggregationResult['stepOutputs']
): string {
  const sections: string[] = [];

  sections.push(`## ${plan.summary}\n`);

  // Add successful results
  const successfulOutputs = stepOutputs.filter((s) => s.success);
  if (successfulOutputs.length > 0) {
    sections.push('### Results\n');
    for (const output of successfulOutputs) {
      const step = plan.steps.find((s) => s.id === output.stepId);
      const outputStr =
        typeof output.output === 'string' ? output.output : JSON.stringify(output.output, null, 2);
      sections.push(`#### ${step?.description || output.stepId}`);
      sections.push(outputStr.slice(0, 1000) + (outputStr.length > 1000 ? '...' : ''));
      sections.push('');
    }
  }

  // Add errors if any
  const failedOutputs = stepOutputs.filter((s) => !s.success);
  if (failedOutputs.length > 0) {
    sections.push('### Errors\n');
    for (const output of failedOutputs) {
      sections.push(`- **${output.stepId}**: ${output.error}`);
    }
    sections.push('');
  }

  // Add summary
  sections.push('### Summary');
  sections.push(
    `- ${executionResult.successfulSteps.length} of ${plan.steps.length} steps completed successfully`
  );
  sections.push(`- Total execution time: ${executionResult.totalDurationMs}ms`);

  return sections.join('\n');
}

/**
 * Quick aggregation without LLM (for simple results)
 */
export function quickAggregate(
  plan: ExecutionPlan,
  executionResult: ExecutionResult
): AggregationResult {
  const stepOutputs: AggregationResult['stepOutputs'] = [];
  const errors: AggregationResult['errors'] = [];

  for (const step of plan.steps) {
    const result = executionResult.results.get(step.id);
    if (result) {
      const stepOutput: AggregationResult['stepOutputs'][number] = {
        stepId: step.id,
        success: result.success,
        output: result.data,
      };
      if (result.error) {
        stepOutput.error = result.error;
      }
      stepOutputs.push(stepOutput);

      if (!result.success && result.error) {
        errors.push({
          stepId: step.id,
          error: result.error,
        });
      }
    }
  }

  const summary = {
    totalSteps: plan.steps.length,
    successCount: executionResult.successfulSteps.length,
    failureCount: executionResult.failedSteps.length,
    skippedCount: executionResult.skippedSteps.length,
    totalDurationMs: executionResult.totalDurationMs,
  };

  return {
    response: formatSimpleAggregation(plan, executionResult, stepOutputs),
    summary,
    stepOutputs,
    errors,
  };
}

/**
 * Extract key findings from aggregation result
 */
export function extractKeyFindings(result: AggregationResult): string[] {
  const findings: string[] = [];

  // Look for patterns in successful outputs
  for (const output of result.stepOutputs) {
    if (!output.success) {
      continue;
    }

    if (typeof output.output === 'string') {
      // Extract bullet points or key statements
      const bullets = output.output.match(/^[•\-*]\s+.+$/gm);
      if (bullets) {
        findings.push(...bullets.slice(0, 3).map((b) => b.replace(/^[•\-*]\s+/, '')));
      }
    } else if (typeof output.output === 'object' && output.output !== null) {
      // Extract from structured data
      const obj = output.output as Record<string, unknown>;
      if (obj.findings && Array.isArray(obj.findings)) {
        findings.push(...(obj.findings as string[]).slice(0, 3));
      }
      if (obj.summary && typeof obj.summary === 'string') {
        findings.push(obj.summary);
      }
    }
  }

  return findings.slice(0, 5); // Limit to 5 key findings
}
