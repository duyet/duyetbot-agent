import type { TokenUsage } from '@duyetbot/observability';
import {
  getRandomMessage as getRandomThinkingMessage,
  THINKING_MESSAGES as THINKING_ROTATOR_MESSAGES,
} from '@duyetbot/progress';
import { formatClaudeCodeThinking } from '../format.js';

type StepCallback = (message: string) => Promise<void>;

export interface StepEvent {
  /** Step iteration number (optional, defaults to 0) */
  iteration?: number;
  type:
    | 'thinking'
    | 'tool_start'
    | 'tool_complete'
    | 'tool_error'
    | 'tool_execution'
    | 'responding'
    | 'routing'
    | 'llm_iteration'
    | 'preparing'
    | 'parallel_tools'
    | 'subagent';
  toolName?: string;
  agentName?: string;
  args?: Record<string, unknown>;
  result?: string | { success?: boolean; output?: string; durationMs?: number; error?: string };
  error?: string;
  thinking?: string;
  maxIterations?: number;
}

export interface StepProgressConfig {
  /** Interval in ms for rotating thinking verbs (default: 3000) */
  rotationInterval?: number;
  /** Optional callback for persisting steps (e.g., to D1 database) */
  persistStep?: (step: StepEvent) => Promise<void>;
}
export type StepType = StepEvent['type'];

/**
 * Completed step for display in progress chain
 */
export interface CompletedStep {
  type: 'thinking' | 'tool';
  text: string;
  /** Tool result (truncated) for display */
  result?: string;
  /** Tool error message */
  error?: string;
}

/**
 * Format tool arguments for compact display
 * Shows key=value pairs, truncating long values
 */
function formatToolArgsCompact(args?: Record<string, unknown>): string {
  if (!args || Object.keys(args).length === 0) {
    return '';
  }

  const parts: string[] = [];
  for (const [key, value] of Object.entries(args)) {
    let valueStr: string;
    if (typeof value === 'string') {
      // Truncate long strings
      valueStr = value.length > 30 ? `"${value.slice(0, 27)}..."` : `"${value}"`;
    } else if (typeof value === 'object') {
      valueStr = '{...}';
    } else {
      valueStr = String(value);
    }
    parts.push(`${key}: ${valueStr}`);
  }

  return parts.join(', ');
}

/**
 * Format tool result for compact display
 * Truncates to first line or 60 chars
 */
function formatToolResultCompact(
  result?: string | { success?: boolean; output?: string; error?: string }
): string {
  if (!result) {
    return '';
  }

  let text: string;
  if (typeof result === 'string') {
    text = result;
  } else if (result.output) {
    text = result.output;
  } else if (result.error) {
    return `❌ ${result.error.slice(0, 50)}`;
  } else {
    return '';
  }

  // Take first line, truncate to 60 chars
  const firstLine = text.split('\n')[0] ?? '';
  return firstLine.length > 60 ? `${firstLine.slice(0, 57)}...` : firstLine;
}

/**
 * Step progress tracker for real-time UI updates
 * @deprecated Use ProgressTracker from '../progress-adapter.js' instead.
 * This class will be removed in a future version.
 * @see ProgressTracker
 */
export class StepProgressTracker {
  private steps: StepEvent[] = [];
  private tokenUsage?: { input: number; output: number; total: number; cached?: number };
  private model?: string;
  private timer?: ReturnType<typeof setInterval> | undefined;

  // State for UI - progress chain display
  private completedChain: CompletedStep[] = [];
  private currentThinkingVerb = '';
  private currentToolName = '';
  private currentToolArgs?: Record<string, unknown>;
  private isThinking = false;
  private executionPath: string[] = [];
  private verbIndex = 0;
  private destroyed = false;

  constructor(
    private onUpdate: StepCallback,
    private config: StepProgressConfig = {}
  ) {}

  async addStep(step: StepEvent): Promise<void> {
    if (this.destroyed) {
      return;
    }
    this.stopRotation();

    this.steps.push(step);

    // Persist step if callback provided (fire-and-forget)
    if (this.config.persistStep) {
      void this.config.persistStep(step).catch(() => {
        // Ignore persistence errors
      });
    }

    switch (step.type) {
      case 'thinking':
        // Add previous thinking to completed chain if we had one
        if (this.isThinking && this.currentThinkingVerb) {
          this.completedChain.push({
            type: 'thinking',
            text: this.currentThinkingVerb,
          });
        }
        this.executionPath.push('thinking');
        this.isThinking = true;
        this.currentToolName = '';
        this.currentToolArgs = {};

        // Use actual thinking content if provided, otherwise use random verb
        if (step.thinking) {
          // Truncate long thinking text for display (keep first ~100 chars)
          const text = step.thinking.replace(/\n/g, ' ').trim();
          this.currentThinkingVerb = text.length > 100 ? `${text.slice(0, 97)}...` : text;
        } else {
          this.currentThinkingVerb = getRandomThinkingMessage();
        }

        await this.startRotation();
        break;

      case 'routing':
        this.executionPath.push(`routing:${step.agentName}`);
        this.completedChain.push({
          type: 'thinking',
          text: `Router → ${step.agentName}`,
        });
        this.isThinking = false;
        await this.update();
        break;

      case 'tool_start':
        // Add current thinking to completed chain before tool
        if (this.isThinking && this.currentThinkingVerb) {
          this.completedChain.push({
            type: 'thinking',
            text: this.currentThinkingVerb,
          });
        }
        this.executionPath.push(`tool:${step.toolName}:start`);
        this.isThinking = false;
        this.currentToolName = step.toolName ?? '';
        this.currentToolArgs = step.args ?? {};
        await this.startRotation();
        break;

      case 'tool_complete':
        this.executionPath.push(`tool:${step.toolName}:complete`);
        // Add completed tool to chain with result
        {
          const resultStr = formatToolResultCompact(step.result);
          const completedTool: CompletedStep = {
            type: 'tool',
            text: `${step.toolName}(${formatToolArgsCompact(step.args)})`,
          };
          if (resultStr) {
            completedTool.result = resultStr;
          }
          this.completedChain.push(completedTool);
        }
        this.currentToolName = '';
        this.currentToolArgs = {};
        await this.update();
        break;

      case 'tool_error':
        this.executionPath.push(`tool:${step.toolName}:error`);
        // Add failed tool to chain with error
        {
          const errorTool: CompletedStep = {
            type: 'tool',
            text: `${step.toolName}(${formatToolArgsCompact(step.args)})`,
          };
          if (step.error) {
            errorTool.error = step.error;
          }
          this.completedChain.push(errorTool);
        }
        this.currentToolName = '';
        this.currentToolArgs = {};
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
        // Add current thinking to completed chain
        if (this.isThinking && this.currentThinkingVerb) {
          this.completedChain.push({
            type: 'thinking',
            text: this.currentThinkingVerb,
          });
        }
        this.executionPath.push('preparing');
        this.isThinking = true;
        this.currentThinkingVerb = 'Preparing response...';
        await this.update();
        break;

      case 'parallel_tools':
        this.executionPath.push('parallel_tools');
        if (step.args && 'tools' in step.args) {
          const tools = step.args.tools as Array<{ toolName: string }>;
          const toolNames = tools.map((t) => t.toolName).join(', ');
          this.completedChain.push({
            type: 'thinking',
            text: `Parallel execution: ${toolNames}`,
          });
        }
        this.isThinking = false;
        await this.update();
        break;

      case 'subagent':
        this.executionPath.push(`subagent:${step.agentName}`);
        this.completedChain.push({
          type: 'thinking',
          text: `Sub-agent: ${step.agentName}`,
        });
        this.isThinking = false;
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

  getDebugContext(): { steps: StepEvent[] } {
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

  /**
   * Start tracking a parallel tools execution group.
   * @param tools Array of tools to track
   * @returns Group ID for updating individual tools
   */
  async addParallelTools(
    tools: Array<{
      id: string;
      toolName: string;
      args: Record<string, unknown>;
    }>
  ): Promise<string> {
    const groupId = crypto.randomUUID();
    const step: StepEvent = {
      type: 'parallel_tools' as const,
      iteration: this.steps.length,
      args: {
        tools: tools.map((t) => ({
          id: t.id,
          toolName: t.toolName,
          args: t.args,
          status: 'running' as const,
        })),
      },
    };
    await this.addStep(step);
    return groupId;
  }

  /**
   * Update a single tool within a parallel tools group.
   * @param toolId ID of the tool to update
   * @param update Status update for the tool
   */
  async updateParallelTool(
    toolId: string,
    update: {
      status: 'completed' | 'error';
      result?: string;
      error?: string;
      durationMs?: number;
    }
  ): Promise<void> {
    // Find the last parallel_tools step
    const parallelStep = [...this.steps].reverse().find((s) => s.type === 'parallel_tools');
    if (
      parallelStep?.args &&
      typeof parallelStep.args === 'object' &&
      'tools' in parallelStep.args
    ) {
      const tools = parallelStep.args.tools as Array<{
        id: string;
        status: string;
        result?: string;
        error?: string;
        durationMs?: number;
      }>;
      const tool = tools.find((t: { id: string }) => t.id === toolId);
      if (tool) {
        Object.assign(tool, update);
        await this.update();
      }
    }
  }

  /**
   * Start tracking a sub-agent execution.
   * @param agentName Name of the sub-agent (e.g., "Plan", "Explore")
   * @param description Task description for the sub-agent
   * @returns Sub-agent ID for completion updates
   */
  async addSubAgent(agentName: string, description: string): Promise<string> {
    const id = crypto.randomUUID();
    const step: StepEvent = {
      type: 'subagent' as const,
      agentName,
      iteration: this.steps.length,
      args: {
        id,
        description,
        status: 'running' as const,
      },
    };
    await this.addStep(step);
    return id;
  }

  /**
   * Complete a sub-agent execution.
   * @param id Sub-agent ID from addSubAgent
   * @param result Completion result with stats
   */
  async completeSubAgent(
    id: string,
    result: {
      toolUses?: number;
      tokenCount?: number;
      durationMs?: number;
      error?: string;
      result?: string;
    }
  ): Promise<void> {
    const subagentStep = this.steps.find(
      (s): s is StepEvent => s.type === 'subagent' && s.args?.id === id
    );
    if (subagentStep?.args) {
      Object.assign(subagentStep.args, {
        status: result.error ? 'error' : 'completed',
        ...result,
      });
      await this.update();
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.stopRotation();
  }

  private async startRotation(): Promise<void> {
    if (this.destroyed) {
      return;
    }
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
    if (this.destroyed) {
      return;
    }

    const lines: string[] = [];

    // Format completed steps with ⏺ prefix
    for (const step of this.completedChain) {
      if (step.type === 'thinking') {
        lines.push(`⏺ ${step.text}`);
      } else if (step.type === 'tool') {
        lines.push(`⏺ ${step.text}`);
        // Show result or error if available
        if (step.error) {
          lines.push(`  ⎿ ❌ ${step.error.slice(0, 60)}`);
        } else if (step.result) {
          lines.push(`  ⎿ ${step.result}`);
        }
      }
    }

    // Show current running state with * prefix
    if (this.isThinking) {
      // Show thinking text or verb with optional token count
      const tokenCount = this.tokenUsage?.input;
      const thinkingText = this.currentThinkingVerb;

      if (tokenCount && tokenCount > 0) {
        lines.push(`* ${thinkingText} (↓ ${this.formatTokenCount(tokenCount)} tokens)`);
      } else {
        lines.push(`* ${thinkingText}`);
      }
    } else if (this.currentToolName) {
      // Tool currently running with args
      const argsStr = formatToolArgsCompact(this.currentToolArgs);
      lines.push(`* ${this.currentToolName}(${argsStr})`);
      lines.push('  ⎿ Running…');
    }

    // Fallback if nothing to show
    const message = lines.length > 0 ? lines.join('\n') : formatClaudeCodeThinking();

    try {
      await this.onUpdate(message);
    } catch (_e) {
      // Ignore update errors
    }
  }

  /**
   * Format token count for compact display
   */
  private formatTokenCount(tokens: number): string {
    if (tokens >= 1000) {
      const k = tokens / 1000;
      return k >= 10 ? `${Math.round(k)}k` : `${k.toFixed(1)}k`;
    }
    return String(tokens);
  }

  /**
   * Get the completed chain for final debug footer
   */
  getCompletedChain(): CompletedStep[] {
    return [...this.completedChain];
  }
}
