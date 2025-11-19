/**
 * Plan Tool
 *
 * Creates structured plans for complex tasks by breaking them down into manageable steps
 */

import type { Tool, ToolInput, ToolOutput } from '@duyetbot/types';
import { ToolExecutionError } from '@duyetbot/types';
import { z } from 'zod';

// Maximum task description length
const MAX_TASK_LENGTH = 5000;

// Input schema for plan tool
const planInputSchema = z.union([
  z
    .string()
    .min(1, 'Task cannot be empty')
    .transform((task) => ({ task })),
  z.object({
    task: z.string().min(1, 'Task cannot be empty'),
    context: z.string().optional(),
    constraints: z.array(z.string()).optional(),
  }),
]);

/**
 * Step in a plan
 */
interface PlanStep {
  title: string;
  description: string;
  estimatedTime?: string;
}

/**
 * Complexity levels
 */
type Complexity = 'low' | 'medium' | 'high';

/**
 * Plan tool implementation
 */
export class PlanTool implements Tool {
  name = 'plan';
  description =
    'Create structured plans for complex tasks. Breaks down tasks into manageable steps with estimates and considerations.';
  inputSchema = planInputSchema;

  /**
   * Validate input
   */
  validate(input: ToolInput): boolean {
    const result = this.inputSchema.safeParse(input.content);
    if (!result.success) {
      return false;
    }

    return result.data.task.length <= MAX_TASK_LENGTH;
  }

  /**
   * Execute planning
   */
  async execute(input: ToolInput): Promise<ToolOutput> {
    const startTime = Date.now();

    try {
      // Validate and parse input
      const parsed = this.inputSchema.safeParse(input.content);
      if (!parsed.success) {
        return {
          status: 'error',
          content: 'Invalid input',
          error: {
            message: `Invalid input: ${parsed.error.message}`,
            code: 'INVALID_INPUT',
          },
        };
      }

      const data = parsed.data;
      const task = data.task;
      const context = 'context' in data ? data.context : undefined;
      const constraints = 'constraints' in data ? data.constraints : undefined;

      // Check maximum task length
      if (task.length > MAX_TASK_LENGTH) {
        return {
          status: 'error',
          content: `Task description too long (max ${MAX_TASK_LENGTH} characters)`,
          error: {
            message: `Task length ${task.length} exceeds maximum ${MAX_TASK_LENGTH}`,
            code: 'TASK_TOO_LONG',
          },
        };
      }

      // Generate plan
      const steps = this.generateSteps(task, context);
      const complexity = this.estimateComplexity(task, steps.length);
      const formattedPlan = this.formatPlan(task, steps, context, constraints);

      const endTime = Date.now();

      return {
        status: 'success',
        content: formattedPlan,
        metadata: {
          task,
          steps,
          complexity,
          ...(context ? { context } : {}),
          ...(constraints ? { constraints } : {}),
          ...(input.metadata?.reason ? { reason: input.metadata.reason } : {}),
          duration: endTime - startTime,
        },
      };
    } catch (error) {
      // Handle unexpected errors
      throw new ToolExecutionError(
        'plan',
        error instanceof Error ? error.message : 'Unknown error',
        'EXECUTION_ERROR',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Generate plan steps from task description
   */
  private generateSteps(task: string, context?: string): PlanStep[] {
    const steps: PlanStep[] = [];
    const taskLower = task.toLowerCase();
    const fullContext = context ? `${task} ${context}`.toLowerCase() : taskLower;

    // Step 1: Research and Requirements
    if (
      fullContext.includes('build') ||
      fullContext.includes('create') ||
      fullContext.includes('develop')
    ) {
      steps.push({
        title: 'Research and Requirements Gathering',
        description: 'Define requirements, research existing solutions, and identify constraints',
        estimatedTime: '2-4 hours',
      });
    }

    // Step 2: Design/Planning
    if (
      fullContext.includes('api') ||
      fullContext.includes('architecture') ||
      fullContext.includes('system')
    ) {
      steps.push({
        title: 'Architecture and Design',
        description: 'Design system architecture, data models, and API contracts',
        estimatedTime: '4-8 hours',
      });
    }

    // Step 3: Setup
    if (
      fullContext.includes('project') ||
      fullContext.includes('setup') ||
      fullContext.includes('initialize')
    ) {
      steps.push({
        title: 'Project Setup',
        description: 'Initialize project structure, configure tools, and setup dependencies',
        estimatedTime: '1-2 hours',
      });
    }

    // Step 4: Core Implementation
    steps.push({
      title: 'Core Implementation',
      description: `Implement the main functionality for: ${task}`,
      estimatedTime: '8-16 hours',
    });

    // Step 5: Database/Storage
    if (
      fullContext.includes('database') ||
      fullContext.includes('storage') ||
      fullContext.includes('persist')
    ) {
      steps.push({
        title: 'Database and Data Layer',
        description: 'Setup database schema, migrations, and data access layer',
        estimatedTime: '4-6 hours',
      });
    }

    // Step 6: Testing
    if (
      !fullContext.includes('test') ||
      fullContext.includes('build') ||
      fullContext.includes('develop')
    ) {
      steps.push({
        title: 'Testing',
        description: 'Write unit tests, integration tests, and perform manual testing',
        estimatedTime: '4-8 hours',
      });
    }

    // Step 7: Deployment
    if (
      fullContext.includes('deploy') ||
      fullContext.includes('production') ||
      fullContext.includes('ci/cd') ||
      fullContext.includes('pipeline')
    ) {
      steps.push({
        title: 'Deployment Setup',
        description: 'Configure deployment pipeline, environment variables, and monitoring',
        estimatedTime: '2-4 hours',
      });
    }

    // Step 8: Documentation
    if (steps.length > 2) {
      steps.push({
        title: 'Documentation',
        description: 'Write API documentation, setup guides, and usage examples',
        estimatedTime: '2-3 hours',
      });
    }

    // Step 9: Migration specific
    if (fullContext.includes('migrate') || fullContext.includes('migration')) {
      return [
        {
          title: 'Pre-migration Analysis',
          description: 'Analyze current system, data structures, and dependencies',
          estimatedTime: '4-6 hours',
        },
        {
          title: 'Migration Strategy',
          description: 'Design migration approach, rollback plan, and data mapping',
          estimatedTime: '4-8 hours',
        },
        {
          title: 'Testing Environment',
          description: 'Setup staging environment and test migration process',
          estimatedTime: '3-5 hours',
        },
        {
          title: 'Data Migration',
          description: 'Execute migration with validation and monitoring',
          estimatedTime: '6-12 hours',
        },
        {
          title: 'Post-migration Validation',
          description: 'Verify data integrity, performance, and functionality',
          estimatedTime: '3-4 hours',
        },
      ];
    }

    // Ensure at least 3 steps
    if (steps.length < 3) {
      steps.unshift({
        title: 'Planning and Analysis',
        description: 'Analyze requirements and plan approach',
        estimatedTime: '1-2 hours',
      });
    }

    return steps;
  }

  /**
   * Estimate task complexity
   */
  private estimateComplexity(task: string, stepCount: number): Complexity {
    const taskLower = task.toLowerCase();

    // High complexity indicators
    const highComplexityKeywords = [
      'migrate',
      'architecture',
      'distributed',
      'scalable',
      'enterprise',
      'oauth',
      'authentication',
    ];

    // Medium complexity indicators
    const mediumComplexityKeywords = ['api', 'integration', 'database', 'deployment', 'ci/cd'];

    if (stepCount >= 7 || highComplexityKeywords.some((keyword) => taskLower.includes(keyword))) {
      return 'high';
    }

    if (stepCount >= 4 || mediumComplexityKeywords.some((keyword) => taskLower.includes(keyword))) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Format plan as markdown
   */
  private formatPlan(
    task: string,
    steps: PlanStep[],
    context?: string,
    constraints?: string[]
  ): string {
    let markdown = `# Plan: ${task}\n\n`;

    if (context) {
      markdown += `## Context\n${context}\n\n`;
    }

    if (constraints && constraints.length > 0) {
      markdown += `## Constraints\n${constraints.map((c) => `- ${c}`).join('\n')}\n\n`;
    }

    markdown += '## Steps\n\n';

    for (const [index, step] of steps.entries()) {
      markdown += `### Step ${index + 1}: ${step.title}\n\n`;
      markdown += `${step.description}\n\n`;
      if (step.estimatedTime) {
        markdown += `**Estimated Time:** ${step.estimatedTime}\n\n`;
      }
    }

    return markdown;
  }
}

/**
 * Create and export singleton instance
 */
export const planTool = new PlanTool();
