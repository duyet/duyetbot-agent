/**
 * Task Planner
 *
 * Uses LLM to decompose complex tasks into atomic execution steps.
 * Creates dependency graphs for parallel execution optimization.
 *
 * Based on Cloudflare's Orchestrator-Workers pattern:
 * https://developers.cloudflare.com/agents/patterns/orchestrator-workers/
 */
import { logger } from '@duyetbot/hono-middleware';
import { AgentMixin } from '../agents/base-agent.js';
import { ExecutionPlanSchema } from '../routing/schemas.js';

/**
 * System prompt for task planning
 */
const PLANNING_SYSTEM_PROMPT = `You are an expert task planner that decomposes complex requests into atomic execution steps.

## Your Role
- Break down complex tasks into smaller, independent steps
- Identify dependencies between steps
- Assign each step to the most appropriate worker type
- Optimize for parallel execution where possible

## Worker Types
- **code**: Code review, generation, analysis, refactoring, bug fixes
- **research**: Information gathering, documentation lookup, comparisons
- **github**: PR reviews, issue management, repository operations
- **general**: Simple questions, explanations, general assistance

## Planning Guidelines
1. Each step should be atomic (single responsibility)
2. Minimize dependencies to maximize parallelism
3. Steps with no dependencies can run in parallel
4. Use descriptive IDs (e.g., "step_research_api", "step_review_code")
5. Order steps by logical sequence
6. Estimate priority (1-10, higher = more important)

## Output Format
Return a JSON object matching this schema:
{
  "taskId": "unique_task_id",
  "summary": "Brief description of what this plan accomplishes",
  "steps": [
    {
      "id": "step_unique_id",
      "description": "What this step accomplishes",
      "workerType": "code|research|github|general",
      "task": "Specific instruction for the worker",
      "dependsOn": ["ids of steps that must complete first"],
      "priority": 1-10,
      "expectedOutput": "text|code|data|action"
    }
  ],
  "estimatedComplexity": "low|medium|high",
  "estimatedDurationSeconds": optional_number
}`;
// Log planning system prompt at module load time
logger.debug('[OrchestratorAgent/Planner] System prompt loaded', {
  promptLength: PLANNING_SYSTEM_PROMPT.length,
  promptPreview:
    PLANNING_SYSTEM_PROMPT.slice(0, 200) + (PLANNING_SYSTEM_PROMPT.length > 200 ? '...' : ''),
});
/**
 * Create an execution plan from a task description
 */
export async function createPlan(task, config, context) {
  const startTime = Date.now();
  const maxSteps = config.maxSteps ?? 10;
  AgentMixin.log('Planner', 'Creating execution plan', {
    taskLength: task.length,
    maxSteps,
  });
  try {
    // Build the prompt
    const contextParts = [];
    if (context?.platform) {
      contextParts.push(`Platform: ${context.platform}`);
    }
    if (context?.availableWorkers) {
      contextParts.push(`Available workers: ${context.availableWorkers.join(', ')}`);
    }
    if (context?.customInstructions) {
      contextParts.push(`Custom instructions: ${context.customInstructions}`);
    }
    if (context?.previousTasks?.length) {
      contextParts.push(`Recent tasks: ${context.previousTasks.slice(-3).join('; ')}`);
    }
    const contextStr = contextParts.length > 0 ? `\n\n## Context\n${contextParts.join('\n')}` : '';
    const userPrompt = `Create an execution plan for the following task:

## Task
${task}
${contextStr}

## Constraints
- Maximum ${maxSteps} steps
- Each step must be atomic and independent
- Minimize dependencies for maximum parallelism
- Return valid JSON only`;
    // Call LLM
    const response = await config.provider.chat([
      { role: 'system', content: PLANNING_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ]);
    // Parse the response
    const plan = parsePlanResponse(response.content, task);
    // Validate step count
    if (plan.steps.length > maxSteps) {
      plan.steps = plan.steps.slice(0, maxSteps);
    }
    const durationMs = Date.now() - startTime;
    AgentMixin.log('Planner', 'Plan created', {
      taskId: plan.taskId,
      stepCount: plan.steps.length,
      complexity: plan.estimatedComplexity,
      durationMs,
    });
    return plan;
  } catch (error) {
    AgentMixin.logError('Planner', 'Failed to create plan', error);
    throw error;
  }
}
/**
 * Parse LLM response into ExecutionPlan
 */
function parsePlanResponse(content, originalTask) {
  // Try to extract JSON from response
  let jsonStr = content;
  // Look for JSON in code blocks
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch?.[1]) {
    jsonStr = jsonMatch[1].trim();
  }
  // Try to find raw JSON object
  const objectMatch = content.match(/\{[\s\S]*\}/);
  if (objectMatch && !jsonMatch) {
    jsonStr = objectMatch[0];
  }
  try {
    const parsed = JSON.parse(jsonStr);
    // Validate with Zod schema
    const result = ExecutionPlanSchema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }
    // If validation fails, try to fix common issues
    return createFallbackPlan(parsed, originalTask);
  } catch {
    // If JSON parsing fails, create a simple fallback plan
    return createSimplePlan(originalTask);
  }
}
/**
 * Create a fallback plan from partially valid data
 */
function createFallbackPlan(parsed, originalTask) {
  const obj = parsed;
  // Extract what we can
  const taskId = obj.taskId || AgentMixin.generateId('task');
  const summary = obj.summary || `Execute: ${originalTask.slice(0, 50)}...`;
  // Try to salvage steps
  const rawSteps = Array.isArray(obj.steps) ? obj.steps : [];
  const steps = rawSteps
    .map((step, index) => {
      const s = step;
      return {
        id: s.id || `step_${index + 1}`,
        description: s.description || 'Execute step',
        workerType: validateWorkerType(s.workerType) || 'general',
        task: s.task || originalTask,
        dependsOn: Array.isArray(s.dependsOn) ? s.dependsOn : [],
        priority: typeof s.priority === 'number' ? Math.min(10, Math.max(1, s.priority)) : 5,
        expectedOutput: validateExpectedOutput(s.expectedOutput) || 'text',
      };
    })
    .slice(0, 10);
  // If no steps, create a single general step
  if (steps.length === 0) {
    return createSimplePlan(originalTask);
  }
  return {
    taskId,
    summary,
    steps,
    estimatedComplexity: estimateComplexity(steps.length),
    estimatedDurationSeconds: steps.length * 10,
  };
}
/**
 * Create a simple single-step plan
 */
function createSimplePlan(task) {
  const workerType = inferWorkerType(task);
  return {
    taskId: AgentMixin.generateId('task'),
    summary: `Execute: ${task.slice(0, 50)}...`,
    steps: [
      {
        id: 'step_main',
        description: 'Execute the main task',
        workerType,
        task,
        dependsOn: [],
        priority: 5,
        expectedOutput: 'text',
      },
    ],
    estimatedComplexity: 'low',
    estimatedDurationSeconds: 30,
  };
}
/**
 * Infer worker type from task description
 */
function inferWorkerType(task) {
  const taskLower = task.toLowerCase();
  if (
    taskLower.includes('code') ||
    taskLower.includes('function') ||
    taskLower.includes('review') ||
    taskLower.includes('bug') ||
    taskLower.includes('refactor')
  ) {
    return 'code';
  }
  if (
    taskLower.includes('research') ||
    taskLower.includes('find') ||
    taskLower.includes('search') ||
    taskLower.includes('documentation')
  ) {
    return 'research';
  }
  if (
    taskLower.includes('github') ||
    taskLower.includes('pr') ||
    taskLower.includes('issue') ||
    taskLower.includes('pull request')
  ) {
    return 'github';
  }
  return 'general';
}
/**
 * Validate worker type
 */
function validateWorkerType(value) {
  const validTypes = ['code', 'research', 'github', 'general'];
  if (typeof value === 'string' && validTypes.includes(value)) {
    return value;
  }
  return null;
}
/**
 * Validate expected output type
 */
function validateExpectedOutput(value) {
  const validTypes = ['text', 'code', 'data', 'action'];
  if (typeof value === 'string' && validTypes.includes(value)) {
    return value;
  }
  return null;
}
/**
 * Estimate complexity based on step count
 */
function estimateComplexity(stepCount) {
  if (stepCount <= 2) {
    return 'low';
  }
  if (stepCount <= 5) {
    return 'medium';
  }
  return 'high';
}
/**
 * Validate plan dependencies (check for cycles and invalid refs)
 */
export function validatePlanDependencies(plan) {
  const errors = [];
  const stepIds = new Set(plan.steps.map((s) => s.id));
  // Check for invalid dependency references
  for (const step of plan.steps) {
    for (const depId of step.dependsOn) {
      if (!stepIds.has(depId)) {
        errors.push(`Step "${step.id}" depends on non-existent step "${depId}"`);
      }
      if (depId === step.id) {
        errors.push(`Step "${step.id}" cannot depend on itself`);
      }
    }
  }
  // Check for cycles using DFS
  const visited = new Set();
  const recursionStack = new Set();
  function hasCycle(stepId) {
    visited.add(stepId);
    recursionStack.add(stepId);
    const step = plan.steps.find((s) => s.id === stepId);
    if (step) {
      for (const depId of step.dependsOn) {
        if (!visited.has(depId)) {
          if (hasCycle(depId)) {
            return true;
          }
        } else if (recursionStack.has(depId)) {
          return true;
        }
      }
    }
    recursionStack.delete(stepId);
    return false;
  }
  for (const step of plan.steps) {
    if (!visited.has(step.id)) {
      if (hasCycle(step.id)) {
        errors.push('Plan contains circular dependencies');
        break;
      }
    }
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}
/**
 * Optimize plan by reordering steps and adjusting dependencies
 */
export function optimizePlan(plan) {
  // Topological sort to determine optimal execution order
  const sortedSteps = topologicalSort(plan.steps);
  // Adjust priorities based on dependency depth
  const depthMap = calculateDependencyDepths(plan.steps);
  const optimizedSteps = sortedSteps.map((step) => ({
    ...step,
    priority: Math.max(1, 10 - (depthMap.get(step.id) || 0)),
  }));
  return {
    ...plan,
    steps: optimizedSteps,
  };
}
/**
 * Topological sort of steps
 */
function topologicalSort(steps) {
  const stepMap = new Map(steps.map((s) => [s.id, s]));
  const visited = new Set();
  const result = [];
  function visit(stepId) {
    if (visited.has(stepId)) {
      return;
    }
    visited.add(stepId);
    const step = stepMap.get(stepId);
    if (step) {
      for (const depId of step.dependsOn) {
        visit(depId);
      }
      result.push(step);
    }
  }
  for (const step of steps) {
    visit(step.id);
  }
  return result;
}
/**
 * Calculate dependency depths for each step
 */
function calculateDependencyDepths(steps) {
  const stepMap = new Map(steps.map((s) => [s.id, s]));
  const depths = new Map();
  function getDepth(stepId) {
    if (depths.has(stepId)) {
      return depths.get(stepId);
    }
    const step = stepMap.get(stepId);
    if (!step || step.dependsOn.length === 0) {
      depths.set(stepId, 0);
      return 0;
    }
    const maxDepDependency = Math.max(...step.dependsOn.map((depId) => getDepth(depId)));
    const depth = maxDepDependency + 1;
    depths.set(stepId, depth);
    return depth;
  }
  for (const step of steps) {
    getDepth(step.id);
  }
  return depths;
}
/**
 * Group steps by dependency level for parallel execution
 */
export function groupStepsByLevel(steps) {
  const depths = calculateDependencyDepths(steps);
  const maxDepth = Math.max(...Array.from(depths.values()), 0);
  const groups = [];
  for (let i = 0; i <= maxDepth; i++) {
    groups.push([]);
  }
  for (const step of steps) {
    const depth = depths.get(step.id) || 0;
    const group = groups[depth];
    if (group) {
      group.push(step);
    }
  }
  // Sort each group by priority (higher first)
  for (const group of groups) {
    if (group) {
      group.sort((a, b) => b.priority - a.priority);
    }
  }
  return groups.filter((g) => g.length > 0);
}
