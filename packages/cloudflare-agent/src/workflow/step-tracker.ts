import type { TokenUsage } from '@duyetbot/observability';
import type { DebugContext } from './debug-footer.js';

type StepCallback = (message: string) => Promise<void>;

const ROTATING_SUFFIXES = ['...', 'Evaluating...', 'Processing...', 'Analyzing...'];

export type StepEvent = DebugContext['steps'][0];
export interface StepProgressConfig {
  rotationInterval?: number;
  rotatingSuffixes?: string[];
}
export type StepType = StepEvent['type'];

export class StepProgressTracker {
  private steps: DebugContext['steps'] = [];
  private tokenUsage?: { input: number; output: number; total: number; cached?: number };
  private model?: string;
  private timer?: ReturnType<typeof setInterval> | undefined;

  // State for UI
  private completedSteps: string[] = [];
  private currentPrefix = '';
  private executionPath: string[] = [];
  private suffixIndex = 0;
  private destroyed = false;

  constructor(
    private onUpdate: StepCallback,
    private config: { rotationInterval?: number; rotatingSuffixes?: string[] } = {}
  ) {}

  async addStep(step: DebugContext['steps'][0] & { maxIterations?: number }): Promise<void> {
    if (this.destroyed) return;
    this.stopRotation();

    this.steps.push(step);

    switch (step.type) {
      case 'thinking':
        this.executionPath.push('thinking');
        this.currentPrefix = '[~] Thinking';
        await this.startRotation();
        break;

      case 'routing':
        this.executionPath.push(`routing:${step.agentName}`);
        this.completedSteps.push(`[>] Router -> ${step.agentName}`);
        await this.update();
        break;

      case 'tool_start':
        this.executionPath.push(`tool:${step.toolName}:start`);
        this.currentPrefix = `[~] ${step.toolName} running`;
        await this.startRotation();
        break;

      case 'tool_complete':
        this.executionPath.push(`tool:${step.toolName}:complete`);
        this.completedSteps.push(`[ok] ${step.toolName} returned`);
        this.currentPrefix = '';
        await this.update();
        break;

      case 'tool_error':
        this.executionPath.push(`tool:${step.toolName}:error`);
        this.completedSteps.push(`[x] ${step.toolName}: ${step.error}`);
        this.currentPrefix = '';
        await this.update();
        break;

      case 'llm_iteration':
        this.executionPath.push(`llm:${step.iteration}/${step.maxIterations}`);
        if (step.iteration && step.maxIterations && step.iteration > 1) {
          this.currentPrefix = `[~] Processing (${step.iteration}/${step.maxIterations})`;
          await this.startRotation();
        }
        break;

      case 'preparing':
        this.executionPath.push('preparing');
        this.currentPrefix = '[...] Preparing response';
        await this.startRotation();
        break;
    }
  }

  addTokenUsage(usage: TokenUsage): void {
    if (!this.tokenUsage) {
      this.tokenUsage = { input: 0, output: 0, total: 0 };
    }
    this.tokenUsage.input += usage.inputTokens || 0;
    this.tokenUsage.output += usage.outputTokens || 0;
    this.tokenUsage.total += usage.totalTokens || 0;
    if (usage.cachedTokens) {
      this.tokenUsage.cached = (this.tokenUsage.cached || 0) + usage.cachedTokens;
    }
  }

  getTokenUsage() {
    return this.tokenUsage;
  }

  getModel() {
    return this.model;
  }

  setModel(model: string): void {
    this.model = model;
  }

  getDebugContext(): DebugContext {
    return {
      steps: this.steps,
    };
  }

  /**
   * Get the execution path for debug footer
   */
  getExecutionPath(): string[] {
    return [...this.executionPath];
  }

  /**
   * Get formatted execution path as string
   */
  getExecutionPathString(): string {
    return this.executionPath
      .map((step) => {
        if (step.startsWith('tool:')) {
          const parts = step.split(':');
          return `${parts[1]}`;
        }
        if (step.startsWith('routing:')) {
          return step.split(':')[1];
        }
        return step;
      })
      .join(' → ');
  }

  destroy(): void {
    this.destroyed = true;
    this.stopRotation();
  }

  private async startRotation(): Promise<void> {
    if (this.destroyed) return;
    this.suffixIndex = 0;
    await this.update();

    if (this.config.rotationInterval) {
      this.timer = setInterval(async () => {
        if (this.destroyed) {
          this.stopRotation();
          return;
        }
        this.suffixIndex =
          (this.suffixIndex + 1) % (this.config.rotatingSuffixes || ROTATING_SUFFIXES).length;
        await this.update();
      }, this.config.rotationInterval);
    }
  }

  private stopRotation(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private async update(): Promise<void> {
    if (this.destroyed) return;

    const lines = [...this.completedSteps];
    if (this.currentPrefix) {
      const suffixes = this.config.rotatingSuffixes || ROTATING_SUFFIXES;
      const suffix = suffixes[this.suffixIndex] || '...';
      lines.push(`${this.currentPrefix}. ${suffix}`);
    }

    const message = lines.length > 0 ? lines.join('\n') : '[~] Starting...';

    try {
      await this.onUpdate(message);
    } catch (e) {
      // Ignore update errors
    }
  }
}
