/**
 * Step Progress Tracker
 *
 * Tracks agent execution steps and provides real-time visual feedback.
 * Steps accumulate (completed steps stay visible) while the current active
 * step shows a rotating loading message.
 *
 * @example
 * ```typescript
 * const tracker = new StepProgressTracker(async (msg) => {
 *   await transport.edit(ctx, messageRef, msg);
 * });
 *
 * await tracker.addStep({ type: 'thinking' });
 * // Shows: "🔄 Thinking..."
 *
 * await tracker.addStep({ type: 'routing', agentName: 'SimpleAgent' });
 * // Shows:
 * // "📡 Router → SimpleAgent
 * //  🔄 Thinking..."
 *
 * await tracker.addStep({ type: 'tool_start', toolName: 'get_posts' });
 * // Shows:
 * // "📡 Router → SimpleAgent
 * //  ⚙️ get_posts running..."
 *
 * tracker.destroy();
 * ```
 */

/**
 * Types of steps in the agent execution flow
 */
export type StepType =
  | 'thinking' // Initial thinking state
  | 'routing' // Router dispatching to an agent
  | 'tool_start' // Tool execution starting
  | 'tool_complete' // Tool execution completed
  | 'tool_error' // Tool execution failed
  | 'llm_iteration' // LLM processing iteration
  | 'preparing'; // Preparing final response

/**
 * Event data for a step update
 */
export interface StepEvent {
  /** Type of step */
  type: StepType;
  /** Agent name (for routing steps) */
  agentName?: string;
  /** Tool name (for tool steps) */
  toolName?: string;
  /** Result preview (for tool_complete) */
  result?: string;
  /** Error message (for tool_error) */
  error?: string;
  /** Current iteration number (for llm_iteration) */
  iteration?: number;
  /** Max iterations (for llm_iteration) */
  maxIterations?: number;
}

/**
 * Rotating suffixes for long-running steps
 * These provide visual feedback that the system is still working
 */
const ROTATING_SUFFIXES = [
  '...',
  'Evaluating...',
  'Processing...',
  'Analyzing...',
  'Flambéing...',
  'Cogitating...',
  'Pondering...',
  'Computing...',
];

/**
 * Format byte size as human-readable string
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes}B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)}KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * Truncate string with ellipsis
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return `${str.slice(0, maxLength - 3)}...`;
}

/**
 * Configuration for StepProgressTracker
 */
export interface StepProgressConfig {
  /** Interval for rotating suffixes in ms (default: 5000) */
  rotationInterval?: number;
  /** Maximum length for result previews (default: 50) */
  maxResultPreview?: number;
  /** Custom rotating suffixes */
  rotatingSuffixes?: string[];
}

/**
 * Tracks execution steps and provides accumulative visual progress feedback.
 *
 * Features:
 * - Accumulates completed steps (they stay visible)
 * - Rotates loading messages for active steps
 * - Provides detailed previews of tool results
 * - Tracks execution path for debug footer
 */
export class StepProgressTracker {
  private completedSteps: string[] = [];
  private currentPrefix = '';
  private suffixIndex = 0;
  private rotationTimer: ReturnType<typeof setInterval> | null = null;
  private onUpdate: (message: string) => Promise<void>;
  private executionPath: string[] = [];
  private config: Required<StepProgressConfig>;
  private isDestroyed = false;

  /**
   * Create a new step progress tracker
   *
   * @param onUpdate - Callback to send updated message (e.g., transport.edit)
   * @param config - Optional configuration
   */
  constructor(onUpdate: (message: string) => Promise<void>, config: StepProgressConfig = {}) {
    this.onUpdate = onUpdate;
    this.config = {
      rotationInterval: config.rotationInterval ?? 5000,
      maxResultPreview: config.maxResultPreview ?? 50,
      rotatingSuffixes: config.rotatingSuffixes ?? ROTATING_SUFFIXES,
    };
  }

  /**
   * Add a step event and update the display
   *
   * @param event - The step event to add
   */
  async addStep(event: StepEvent): Promise<void> {
    if (this.isDestroyed) {
      return;
    }

    // Stop any existing rotation before processing new step
    this.stopRotation();

    switch (event.type) {
      case 'thinking':
        this.executionPath.push('thinking');
        this.currentPrefix = '🔄 Thinking';
        await this.startRotation();
        break;

      case 'routing':
        this.executionPath.push(`routing:${event.agentName}`);
        this.completedSteps.push(`📡 Router → ${event.agentName}`);
        await this.update();
        break;

      case 'tool_start':
        this.executionPath.push(`tool:${event.toolName}:start`);
        this.currentPrefix = `⚙️ ${event.toolName} running`;
        await this.startRotation();
        break;

      case 'tool_complete': {
        this.executionPath.push(`tool:${event.toolName}:complete`);
        const resultLength = event.result?.length ?? 0;
        const size = resultLength > 0 ? ` (${formatSize(resultLength)})` : '';
        this.completedSteps.push(`✅ ${event.toolName} returned${size}`);
        this.currentPrefix = '';
        await this.update();
        break;
      }

      case 'tool_error': {
        this.executionPath.push(`tool:${event.toolName}:error`);
        const errorMsg = event.error ? truncate(event.error, 50) : 'Unknown error';
        this.completedSteps.push(`❌ ${event.toolName}: ${errorMsg}`);
        this.currentPrefix = '';
        await this.update();
        break;
      }

      case 'llm_iteration':
        this.executionPath.push(`llm:${event.iteration}/${event.maxIterations}`);
        if (event.iteration && event.maxIterations && event.iteration > 1) {
          this.currentPrefix = `🔄 Processing (${event.iteration}/${event.maxIterations})`;
          await this.startRotation();
        }
        break;

      case 'preparing':
        this.executionPath.push('preparing');
        this.currentPrefix = '📦 Preparing response';
        await this.startRotation();
        break;
    }
  }

  /**
   * Start rotating suffix for the current step
   */
  private async startRotation(): Promise<void> {
    if (this.isDestroyed) {
      return;
    }

    this.suffixIndex = 0;
    await this.update();

    this.rotationTimer = setInterval(async () => {
      if (this.isDestroyed) {
        this.stopRotation();
        return;
      }
      this.suffixIndex = (this.suffixIndex + 1) % this.config.rotatingSuffixes.length;
      await this.update();
    }, this.config.rotationInterval);
  }

  /**
   * Stop the rotation timer
   */
  stopRotation(): void {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
      this.rotationTimer = null;
    }
  }

  /**
   * Build the current message and send it via onUpdate
   */
  private async update(): Promise<void> {
    if (this.isDestroyed) {
      return;
    }

    const lines = [...this.completedSteps];

    if (this.currentPrefix) {
      const suffix = this.config.rotatingSuffixes[this.suffixIndex] || '...';
      lines.push(`${this.currentPrefix}. ${suffix}`);
    }

    // If no lines yet, show a default
    const message = lines.length > 0 ? lines.join('\n') : '🔄 Starting...';

    try {
      await this.onUpdate(message);
    } catch (error) {
      // Log but don't throw - we don't want update failures to break the flow
      console.error('[StepProgress] Update failed:', error);
    }
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
        // Simplify tool steps for display
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
   * Clean up the tracker
   */
  destroy(): void {
    this.isDestroyed = true;
    this.stopRotation();
  }

  /**
   * Check if the tracker has been destroyed
   */
  get destroyed(): boolean {
    return this.isDestroyed;
  }
}

/**
 * Create a step progress tracker with common defaults
 *
 * @param editFn - Function to edit the message
 * @param config - Optional configuration
 * @returns StepProgressTracker instance
 */
export function createStepProgressTracker(
  editFn: (message: string) => Promise<void>,
  config?: StepProgressConfig
): StepProgressTracker {
  return new StepProgressTracker(editFn, config);
}
