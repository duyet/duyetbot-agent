/**
 * ProgressTracker adapter - thin composition over @duyetbot/progress components.
 *
 * This adapter provides backward compatibility with the legacy StepProgressTracker API
 * while delegating all functionality to the reusable @duyetbot/progress package components:
 * - StepCollector: Step collection with auto-timestamp
 * - TokenTracker: Token usage aggregation
 * - ProgressRenderer: Live progress rendering with rotation
 * - FooterRenderer: Debug footer rendering (not used in live updates)
 *
 * The adapter maps between the legacy StepEvent type and the canonical Step type
 * from @duyetbot/progress, maintaining backward compatibility while enabling code reuse.
 */

import {
  ProgressRenderer,
  type RenderFormat,
  type Step,
  type StepCollection,
  StepCollector,
  TokenTracker,
} from '@duyetbot/progress';

/**
 * Legacy StepEvent type from cloudflare-agent.
 * Maps to @duyetbot/progress Step type with some field name differences.
 */
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

/**
 * Legacy CompletedStep interface for backward compatibility.
 */
export interface CompletedStep {
  type: 'thinking' | 'tool';
  text: string;
  result?: string;
  error?: string;
}

export interface ProgressTrackerConfig {
  /** Interval in ms for rotating thinking verbs (default: 3000) */
  rotationInterval?: number;
  /** Output format for rendering (default: 'plain') */
  format?: RenderFormat;
  /** Optional callback for persisting steps (e.g., to D1 database) */
  persistStep?: (step: StepEvent) => Promise<void>;
}

/**
 * ProgressTracker adapter composing @duyetbot/progress components.
 *
 * Provides backward compatibility with the legacy StepProgressTracker API
 * while delegating to reusable progress tracking components.
 */
export class ProgressTracker {
  private collector: StepCollector;
  private tokenTracker: TokenTracker;
  private renderer: ProgressRenderer;
  private destroyed = false;
  private config: ProgressTrackerConfig;
  private onUpdate: (message: string) => Promise<void>;

  constructor(onUpdate: (message: string) => Promise<void>, config?: ProgressTrackerConfig) {
    this.onUpdate = onUpdate;
    this.config = config || {};

    // Initialize composed components
    this.collector = new StepCollector({
      onStep: (step) => {
        // Fire-and-forget persistence
        if (this.config.persistStep) {
          void this.persistLegacyStep(step).catch(() => {
            // Ignore persistence errors
          });
        }
      },
    });

    this.tokenTracker = new TokenTracker();

    // Build config with exact types (exactOptionalPropertyTypes: true)
    const rendererConfig: {
      rotationInterval?: number;
      maxResultPreview?: number;
    } = { maxResultPreview: 60 };
    if (this.config.rotationInterval !== undefined) {
      rendererConfig.rotationInterval = this.config.rotationInterval;
    }
    this.renderer = new ProgressRenderer(rendererConfig);
  }

  /**
   * Convert @duyetbot/progress Step back to legacy StepEvent for persistence.
   */
  private async persistLegacyStep(step: Step): Promise<void> {
    if (!this.config.persistStep) {
      return;
    }

    const legacyStep: StepEvent = {
      iteration: step.iteration,
      type: step.type as StepEvent['type'],
    };

    switch (step.type) {
      case 'thinking':
        if (step.thinking !== undefined) {
          legacyStep.thinking = step.thinking;
        }
        break;
      case 'tool_start':
        legacyStep.toolName = step.toolName;
        legacyStep.args = step.args;
        break;
      case 'tool_complete':
        legacyStep.toolName = step.toolName;
        legacyStep.args = step.args;
        legacyStep.result = step.result;
        break;
      case 'tool_error':
        legacyStep.toolName = step.toolName;
        legacyStep.args = step.args;
        legacyStep.error = step.error;
        break;
      case 'routing':
        legacyStep.agentName = step.agentName;
        break;
      case 'llm_iteration':
        legacyStep.maxIterations = step.maxIterations;
        break;
      case 'parallel_tools':
        legacyStep.args = { tools: step.tools };
        break;
      case 'subagent':
        legacyStep.agentName = step.agentName;
        legacyStep.args = {
          id: step.id,
          description: step.description,
          status: step.status,
          ...(step.toolUses !== undefined && { toolUses: step.toolUses }),
          ...(step.tokenCount !== undefined && { tokenCount: step.tokenCount }),
          ...(step.result !== undefined && { result: step.result }),
          ...(step.error !== undefined && { error: step.error }),
        };
        break;
    }

    await this.config.persistStep(legacyStep);
  }

  /**
   * Add a step and update the UI.
   * Maps legacy StepEvent to @duyetbot/progress Step type.
   */
  async addStep(step: StepEvent): Promise<void> {
    if (this.destroyed) {
      return;
    }

    // Get current iteration from collector
    const iteration = step.iteration ?? this.collector.getCurrentIteration();

    // Map legacy StepEvent to @duyetbot/progress Step types
    // We create specific step objects matching the discriminated union
    switch (step.type) {
      case 'thinking': {
        const thinkingStep = {
          type: 'thinking' as const,
          iteration,
          durationMs: 0,
          ...(step.thinking !== undefined && { thinking: step.thinking }),
        };
        this.collector.addStep(thinkingStep);
        break;
      }

      case 'routing': {
        const routingStep = {
          type: 'routing' as const,
          iteration,
          durationMs: 0,
          agentName: step.agentName!,
        };
        this.collector.addStep(routingStep);
        break;
      }

      case 'tool_start': {
        const toolStartStep = {
          type: 'tool_start' as const,
          iteration,
          durationMs: 0,
          toolName: step.toolName!,
          args: step.args || {},
        };
        this.collector.addStep(toolStartStep);
        break;
      }

      case 'tool_complete': {
        // Normalize result to string
        let resultStr: string;
        if (typeof step.result === 'string') {
          resultStr = step.result;
        } else if (step.result?.output) {
          resultStr = step.result.output;
        } else {
          resultStr = '';
        }

        const toolCompleteStep = {
          type: 'tool_complete' as const,
          iteration,
          durationMs: typeof step.result === 'object' ? step.result.durationMs || 0 : 0,
          toolName: step.toolName!,
          args: step.args || {},
          result: resultStr,
        };
        this.collector.addStep(toolCompleteStep);
        break;
      }

      case 'tool_error': {
        const toolErrorStep = {
          type: 'tool_error' as const,
          iteration,
          durationMs: 0,
          toolName: step.toolName!,
          args: step.args || {},
          error: step.error || 'Unknown error',
        };
        this.collector.addStep(toolErrorStep);
        break;
      }

      case 'llm_iteration': {
        const llmIterationStep = {
          type: 'llm_iteration' as const,
          iteration,
          durationMs: 0,
          maxIterations: step.maxIterations || 10,
        };
        this.collector.addStep(llmIterationStep);
        break;
      }

      case 'preparing': {
        const preparingStep = {
          type: 'preparing' as const,
          iteration,
          durationMs: 0,
        };
        this.collector.addStep(preparingStep);
        break;
      }

      case 'parallel_tools': {
        // Extract tools array from args
        const tools =
          step.args && 'tools' in step.args
            ? (step.args.tools as Array<{
                id: string;
                toolName: string;
                args: Record<string, unknown>;
                status?: 'running' | 'completed' | 'error';
                result?: string;
                error?: string;
                durationMs?: number;
              }>)
            : [];

        const parallelToolsStep = {
          type: 'parallel_tools' as const,
          iteration,
          durationMs: 0,
          tools: tools.map((t) => ({
            id: t.id,
            toolName: t.toolName,
            args: t.args,
            status: (t.status || 'running') as 'running' | 'completed' | 'error',
            ...(t.result !== undefined && { result: t.result }),
            ...(t.error !== undefined && { error: t.error }),
            ...(t.durationMs !== undefined && { durationMs: t.durationMs }),
          })),
        };
        this.collector.addStep(parallelToolsStep);
        break;
      }

      case 'subagent': {
        // Extract subagent data from args
        const args = step.args || {};
        const id = (args.id as string) || crypto.randomUUID();
        const description = (args.description as string) || '';
        const status = ((args.status as string) || 'running') as
          | 'running'
          | 'completed'
          | 'error';

        const subagentStep = {
          type: 'subagent' as const,
          iteration,
          durationMs: (args.durationMs as number) || 0,
          id,
          agentName: step.agentName!,
          description,
          status,
          ...(args.toolUses !== undefined && { toolUses: args.toolUses as number }),
          ...(args.tokenCount !== undefined && { tokenCount: args.tokenCount as number }),
          ...(args.result !== undefined && { result: args.result as string }),
          ...(args.error !== undefined && { error: args.error as string }),
        };
        this.collector.addStep(subagentStep);
        break;
      }

      default:
        // Unsupported types (tool_execution, responding) - ignore
        return;
    }

    // Build collection and render
    const collection = this.buildCollection();
    const rendered = this.renderer.render(collection);

    // Update UI
    try {
      await this.onUpdate(rendered);
    } catch (_e) {
      // Ignore update errors
    }
  }

  /**
   * Add token usage.
   * Delegates to TokenTracker.
   */
  addTokenUsage(usage: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    cachedTokens?: number;
  }): void {
    const normalizedUsage: {
      input?: number;
      output?: number;
      total?: number;
      cached?: number;
    } = {};

    if (usage.inputTokens !== undefined) {
      normalizedUsage.input = usage.inputTokens;
    }
    if (usage.outputTokens !== undefined) {
      normalizedUsage.output = usage.outputTokens;
    }
    if (usage.totalTokens !== undefined) {
      normalizedUsage.total = usage.totalTokens;
    }
    if (usage.cachedTokens !== undefined) {
      normalizedUsage.cached = usage.cachedTokens;
    }

    this.tokenTracker.addUsage(normalizedUsage);
  }

  /**
   * Set model identifier.
   */
  setModel(model: string): void {
    this.tokenTracker.setModel(model);
  }

  /**
   * Get aggregated token usage.
   */
  getTokenUsage(): { input: number; output: number; total: number; cached?: number } {
    const usage = this.tokenTracker.getUsage();
    const result: { input: number; output: number; total: number; cached?: number } = {
      input: usage.input,
      output: usage.output,
      total: usage.total,
    };
    if (usage.cached !== undefined) {
      result.cached = usage.cached;
    }
    return result;
  }

  /**
   * Get model identifier.
   */
  getModel(): string | undefined {
    return this.tokenTracker.getModel();
  }

  /**
   * Get debug context (legacy API).
   */
  getDebugContext(): { steps: StepEvent[] } {
    // Convert @duyetbot/progress Step back to legacy StepEvent
    const steps = this.collector.getSteps();
    const legacySteps: StepEvent[] = steps.map((step) => {
      const legacy: StepEvent = {
        iteration: step.iteration,
        type: step.type as StepEvent['type'],
      };

      switch (step.type) {
        case 'thinking':
          if (step.thinking !== undefined) {
            legacy.thinking = step.thinking;
          }
          break;
        case 'tool_start':
          legacy.toolName = step.toolName;
          legacy.args = step.args;
          break;
        case 'tool_complete':
          legacy.toolName = step.toolName;
          legacy.args = step.args;
          legacy.result = step.result;
          break;
        case 'tool_error':
          legacy.toolName = step.toolName;
          legacy.args = step.args;
          legacy.error = step.error;
          break;
        case 'routing':
          legacy.agentName = step.agentName;
          break;
        case 'llm_iteration':
          legacy.maxIterations = step.maxIterations;
          break;
        case 'parallel_tools':
          legacy.args = { tools: step.tools };
          break;
        case 'subagent':
          legacy.agentName = step.agentName;
          legacy.args = {
            id: step.id,
            description: step.description,
            status: step.status,
            ...(step.toolUses !== undefined && { toolUses: step.toolUses }),
            ...(step.tokenCount !== undefined && { tokenCount: step.tokenCount }),
            ...(step.result !== undefined && { result: step.result }),
            ...(step.error !== undefined && { error: step.error }),
          };
          break;
      }

      return legacy;
    });

    return { steps: legacySteps };
  }

  /**
   * Get execution path.
   * Delegates to StepCollector.
   */
  getExecutionPath(): string[] {
    return this.collector.getExecutionPath();
  }

  /**
   * Get formatted execution path as string (legacy API).
   */
  getExecutionPathString(): string {
    return this.collector
      .getExecutionPath()
      .map((step) => {
        if (step.startsWith('tool:')) {
          const parts = step.split(':');
          return parts[1];
        }
        if (step.startsWith('routing:')) {
          return step.split(':')[1];
        }
        return step;
      })
      .join(' → ');
  }

  /**
   * Get completed chain for final debug footer (legacy API).
   */
  getCompletedChain(): CompletedStep[] {
    const steps = this.collector.getSteps();
    const chain: CompletedStep[] = [];

    for (const step of steps) {
      switch (step.type) {
        case 'thinking':
          if (step.thinking) {
            chain.push({
              type: 'thinking',
              text: step.thinking.replace(/\n/g, ' ').trim().slice(0, 100),
            });
          }
          break;

        case 'tool_complete':
          chain.push({
            type: 'tool',
            text: `${step.toolName}(${this.formatToolArgsCompact(step.args)})`,
            result: this.formatToolResultCompact(step.result),
          });
          break;

        case 'tool_error':
          chain.push({
            type: 'tool',
            text: `${step.toolName}(${this.formatToolArgsCompact(step.args)})`,
            error: step.error,
          });
          break;

        case 'routing':
          chain.push({
            type: 'thinking',
            text: `Router → ${step.agentName}`,
          });
          break;
      }
    }

    return chain;
  }

  /**
   * Start tracking a parallel tools execution group.
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
      iteration: this.collector.getCurrentIteration(),
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
    // Find the last parallel_tools step in collector
    const steps = this.collector.getSteps();
    const parallelStep = [...steps].reverse().find((s) => s.type === 'parallel_tools');

    if (parallelStep && parallelStep.type === 'parallel_tools') {
      const tool = parallelStep.tools.find((t) => t.id === toolId);
      if (tool) {
        Object.assign(tool, update);

        // Re-render with updated collection
        const collection = this.buildCollection();
        const rendered = this.renderer.render(collection);

        try {
          await this.onUpdate(rendered);
        } catch (_e) {
          // Ignore update errors
        }
      }
    }
  }

  /**
   * Start tracking a sub-agent execution.
   */
  async addSubAgent(agentName: string, description: string): Promise<string> {
    const id = crypto.randomUUID();
    const step: StepEvent = {
      type: 'subagent' as const,
      agentName,
      iteration: this.collector.getCurrentIteration(),
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
    const steps = this.collector.getSteps();
    const subagentStep = steps.find((s) => s.type === 'subagent' && s.id === id);

    if (subagentStep && subagentStep.type === 'subagent') {
      Object.assign(subagentStep, {
        status: result.error ? 'error' : 'completed',
        ...result,
      });

      // Re-render with updated collection
      const collection = this.buildCollection();
      const rendered = this.renderer.render(collection);

      try {
        await this.onUpdate(rendered);
      } catch (_e) {
        // Ignore update errors
      }
    }
  }

  /**
   * Destroy tracker and clean up resources.
   */
  destroy(): void {
    this.destroyed = true;
    this.renderer.destroy();
  }

  // Private helper methods

  /**
   * Build StepCollection from current state.
   */
  private buildCollection(): StepCollection {
    const model = this.tokenTracker.getModel();
    const collection: StepCollection = {
      steps: this.collector.getSteps(),
      tokenUsage: this.tokenTracker.getUsage(),
      startedAt: new Date().toISOString(),
    };

    // Only include model if defined (exactOptionalPropertyTypes: true)
    if (model !== undefined) {
      collection.model = model;
    }

    return collection;
  }

  /**
   * Format tool arguments for compact display (legacy helper).
   */
  private formatToolArgsCompact(args?: Record<string, unknown>): string {
    if (!args || Object.keys(args).length === 0) {
      return '';
    }

    const parts: string[] = [];
    for (const [key, value] of Object.entries(args)) {
      let valueStr: string;
      if (typeof value === 'string') {
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
   * Format tool result for compact display (legacy helper).
   */
  private formatToolResultCompact(result?: string): string {
    if (!result) {
      return '';
    }

    const firstLine = result.split('\n')[0] ?? '';
    return firstLine.length > 60 ? `${firstLine.slice(0, 57)}...` : firstLine;
  }
}
