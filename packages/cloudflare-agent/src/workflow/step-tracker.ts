import type { TokenUsage } from '@duyetbot/observability';
import {
  formatClaudeCodeThinking,
  getRandomThinkingMessage,
  THINKING_ROTATOR_MESSAGES,
} from '../agentic-loop/progress.js';
import type { DebugContext } from './debug-footer.js';

type StepCallback = (message: string) => Promise<void>;

export type StepEvent = DebugContext['steps'][0];
export interface StepProgressConfig {
  /** Interval in ms for rotating thinking verbs (default: 3000) */
  rotationInterval?: number;
}
export type StepType = StepEvent['type'];

export class StepProgressTracker {
  private steps: DebugContext['steps'] = [];
  private tokenUsage?: { input: number; output: number; total: number; cached?: number };
  private model?: string;
  private timer?: ReturnType<typeof setInterval> | undefined;

  // State for UI
  private completedSteps: string[] = [];
  private currentThinkingVerb = '';
  private currentToolName = '';
  private isThinking = false;
  private executionPath: string[] = [];
  private verbIndex = 0;
  private destroyed = false;

  constructor(
    private onUpdate: StepCallback,
    private config: { rotationInterval?: number } = {}
  ) {}

  async addStep(step: DebugContext['steps'][0] & { maxIterations?: number }): Promise<void> {
    if (this.destroyed) return;
    this.stopRotation();

    this.steps.push(step);

    switch (step.type) {
      case 'thinking':
        this.executionPath.push('thinking');
        this.isThinking = true;
        this.currentToolName = '';
        this.currentThinkingVerb = getRandomThinkingMessage();
        await this.startRotation();
        break;

      case 'routing':
        this.executionPath.push(`routing:${step.agentName}`);
        this.completedSteps.push(`[>] Router -> ${step.agentName}`);
        this.isThinking = false;
        await this.update();
        break;

      case 'tool_start':
        this.executionPath.push(`tool:${step.toolName}:start`);
        this.isThinking = false;
        this.currentToolName = step.toolName ?? '';
        await this.startRotation();
        break;

      case 'tool_complete':
        this.executionPath.push(`tool:${step.toolName}:complete`);
        this.completedSteps.push(`⏺ ${step.toolName}`);
        this.currentToolName = '';
        await this.update();
        break;

      case 'tool_error':
        this.executionPath.push(`tool:${step.toolName}:error`);
        this.completedSteps.push(`⏺ ${step.toolName} ❌`);
        this.currentToolName = '';
        await this.update();
        break;

      case 'llm_iteration':
        this.executionPath.push(`llm:${step.iteration}/${step.maxIterations}`);
        if (step.iteration && step.maxIterations && step.iteration > 1) {
          this.isThinking = true;
          this.currentThinkingVerb = getRandomThinkingMessage();
          await this.startRotation();
        }
        break;

      case 'preparing':
        this.executionPath.push('preparing');
        this.isThinking = true;
        this.currentThinkingVerb = 'Preparing';
        await this.update();
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
    this.verbIndex = 0;
    await this.update();

    if (this.config.rotationInterval) {
      this.timer = setInterval(async () => {
        if (this.destroyed) {
          this.stopRotation();
          return;
        }
        // Rotate through thinking verbs for variety
        this.verbIndex = (this.verbIndex + 1) % THINKING_ROTATOR_MESSAGES.length;
        this.currentThinkingVerb = THINKING_ROTATOR_MESSAGES[this.verbIndex] ?? 'Thinking';
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

    // Show current state based on what we're doing
    if (this.isThinking) {
      // Claude Code style thinking with token count
      const tokenCount = this.tokenUsage?.input;
      lines.push(formatClaudeCodeThinking(tokenCount, this.currentThinkingVerb));
    } else if (this.currentToolName) {
      // Tool running indicator
      lines.push(`⏺ ${this.currentToolName}`);
      lines.push('  ⎿ Running…');
    }

    const message = lines.length > 0 ? lines.join('\n') : formatClaudeCodeThinking();

    try {
      await this.onUpdate(message);
    } catch (e) {
      // Ignore update errors
    }
  }
}
