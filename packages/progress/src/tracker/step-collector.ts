import type { Step } from '../types.js';

export interface StepCollectorConfig {
  onStep?: (step: Step) => void;
}

export class StepCollector {
  private steps: Step[] = [];
  private config: StepCollectorConfig;

  constructor(config?: StepCollectorConfig) {
    this.config = config || {};
  }

  /**
   * Add a step with auto-generated timestamp.
   */
  addStep(step: Omit<Step, 'timestamp'>): void {
    const fullStep: Step = {
      ...step,
      timestamp: new Date().toISOString(),
    } as Step;

    this.steps.push(fullStep);

    if (this.config.onStep) {
      this.config.onStep(fullStep);
    }
  }

  /**
   * Get all steps (returns a copy to prevent mutation).
   */
  getSteps(): Step[] {
    return [...this.steps];
  }

  /**
   * Get current iteration (max iteration from steps, or 0).
   */
  getCurrentIteration(): number {
    if (this.steps.length === 0) {
      return 0;
    }

    return Math.max(...this.steps.map((step) => step.iteration));
  }

  /**
   * Get execution path as string array.
   * Examples:
   * - 'thinking'
   * - 'routing:SimpleAgent'
   * - 'tool:get_posts:start'
   * - 'tool:get_posts:complete'
   * - 'tool:get_posts:error'
   * - 'llm_iteration'
   * - 'preparing'
   */
  getExecutionPath(): string[] {
    return this.steps.map((step) => {
      switch (step.type) {
        case 'thinking':
          return 'thinking';
        case 'routing':
          return `routing:${step.agentName}`;
        case 'tool_start':
          return `tool:${step.toolName}:start`;
        case 'tool_complete':
          return `tool:${step.toolName}:complete`;
        case 'tool_error':
          return `tool:${step.toolName}:error`;
        case 'llm_iteration':
          return 'llm_iteration';
        case 'preparing':
          return 'preparing';
        case 'parallel_tools':
          return `parallel_tools:${step.tools.length}`;
        case 'subagent':
          return `subagent:${step.agentName}:${step.status}`;
        default: {
          // TypeScript exhaustiveness check
          const _exhaustive: never = step;
          return _exhaustive;
        }
      }
    });
  }

  /**
   * Clear all steps.
   */
  reset(): void {
    this.steps = [];
  }
}
