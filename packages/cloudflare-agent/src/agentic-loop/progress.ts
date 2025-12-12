/**
 * Progress Tracker for Real-Time Feedback
 *
 * Manages real-time status updates for agent execution, providing users
 * with continuous feedback during the agentic loop. Updates are formatted
 * for display on Telegram and GitHub platforms.
 *
 * @example
 * ```typescript
 * const tracker = createProgressTracker(
 *   (text) => transport.edit(ctx, messageRef, text),
 *   { maxDisplayedUpdates: 5 }
 * );
 *
 * await tracker.thinking(1);
 * // Shows: "🤔 Thinking... (step 1)"
 *
 * await tracker.toolStart('search', 1);
 * // Shows:
 * // 🤔 Thinking... (step 1)
 * // 🔧 Running search...
 *
 * await tracker.toolComplete('search', {
 *   success: true,
 *   durationMs: 234,
 * }, 1);
 * // Shows:
 * // 🤔 Thinking... (step 1)
 * // ✅ search completed (234ms)
 * ```
 */

import type { ProgressUpdate, ToolResult } from './types.js';

/**
 * Progress message templates for user-facing updates
 */
export const PROGRESS_MESSAGES = {
  thinking: (iteration: number) => `🤔 Thinking... (step ${iteration})`,
  tool_start: (tool: string) => `🔧 Running ${tool}...`,
  tool_complete: (tool: string, durationMs: number) => `✅ ${tool} completed (${durationMs}ms)`,
  tool_error: (tool: string, error: string) => `❌ ${tool} failed: ${error.slice(0, 50)}`,
  responding: () => `📝 Generating response...`,
};

/**
 * Tracks and formats progress updates for real-time user feedback
 *
 * Features:
 * - Records thinking steps and iteration numbers
 * - Tracks tool execution start/completion/errors
 * - Formats updates for display (last N updates)
 * - Provides execution summary statistics
 * - Async callback integration with transport layer
 */
export class ProgressTracker {
  private updates: ProgressUpdate[];
  private maxDisplayedUpdates: number;
  private onUpdate: ((formatted: string) => Promise<void>) | undefined;

  /**
   * Create a new progress tracker
   *
   * @param options - Optional configuration
   * @param options.maxDisplayedUpdates - Maximum number of recent updates to display (default: 5)
   * @param options.onUpdate - Callback to send formatted updates (e.g., transport.edit)
   */
  constructor(options?: {
    maxDisplayedUpdates?: number;
    onUpdate?: (formatted: string) => Promise<void>;
  }) {
    this.updates = [];
    this.maxDisplayedUpdates = options?.maxDisplayedUpdates ?? 5;
    this.onUpdate = options?.onUpdate ?? undefined;
  }

  /**
   * Record a thinking step
   *
   * @param iteration - Step iteration number (1-indexed)
   */
  async thinking(iteration: number): Promise<void> {
    await this.addUpdate({
      type: 'thinking',
      message: PROGRESS_MESSAGES.thinking(iteration),
      iteration,
      timestamp: Date.now(),
    });
  }

  /**
   * Record tool execution start
   *
   * @param toolName - Name of the tool being executed
   * @param iteration - Current agentic loop iteration
   */
  async toolStart(toolName: string, iteration: number): Promise<void> {
    await this.addUpdate({
      type: 'tool_start',
      message: PROGRESS_MESSAGES.tool_start(toolName),
      toolName,
      iteration,
      timestamp: Date.now(),
    });
  }

  /**
   * Record tool execution completion or failure
   *
   * @param toolName - Name of the tool that was executed
   * @param result - Tool execution result with success flag and duration
   * @param iteration - Current agentic loop iteration
   */
  async toolComplete(toolName: string, result: ToolResult, iteration: number): Promise<void> {
    const message = result.success
      ? PROGRESS_MESSAGES.tool_complete(toolName, result.durationMs)
      : PROGRESS_MESSAGES.tool_error(toolName, result.error ?? 'Unknown error');

    await this.addUpdate({
      type: result.success ? 'tool_complete' : 'tool_error',
      message,
      toolName,
      iteration,
      timestamp: Date.now(),
      durationMs: result.durationMs,
    });
  }

  /**
   * Record final response generation step
   *
   * @param iteration - Current agentic loop iteration
   */
  async responding(iteration: number): Promise<void> {
    await this.addUpdate({
      type: 'responding',
      message: PROGRESS_MESSAGES.responding(),
      iteration,
      timestamp: Date.now(),
    });
  }

  /**
   * Add an update and trigger callback
   *
   * @param update - The progress update to record
   */
  private async addUpdate(update: ProgressUpdate): Promise<void> {
    this.updates.push(update);

    if (this.onUpdate) {
      const formatted = this.format();
      await this.onUpdate(formatted);
    }
  }

  /**
   * Format recent updates for display
   *
   * Shows the last N updates in a readable format, one per line.
   * Useful for streaming progress to users.
   *
   * @returns Formatted string with recent updates separated by newlines
   */
  format(): string {
    const recent = this.updates.slice(-this.maxDisplayedUpdates);
    return recent.map((u) => u.message).join('\n');
  }

  /**
   * Get all recorded updates
   *
   * Useful for debugging, logging, and audit trails.
   *
   * @returns Array of all progress updates (chronological order)
   */
  getAll(): ProgressUpdate[] {
    return [...this.updates];
  }

  /**
   * Get execution summary statistics
   *
   * Provides high-level metrics about the execution:
   * - Total updates recorded
   * - Number of agentic loop iterations
   * - Tools executed (successes + failures)
   * - Total time spent in tools
   *
   * @returns Summary object with execution metrics
   */
  getSummary(): {
    totalUpdates: number;
    iterations: number;
    toolsExecuted: number;
    totalToolDurationMs: number;
  } {
    const toolUpdates = this.updates.filter(
      (u) => u.type === 'tool_complete' || u.type === 'tool_error'
    );
    return {
      totalUpdates: this.updates.length,
      iterations: Math.max(...this.updates.map((u) => u.iteration), 0),
      toolsExecuted: toolUpdates.length,
      totalToolDurationMs: toolUpdates.reduce((sum, u) => sum + (u.durationMs ?? 0), 0),
    };
  }

  /**
   * Reset tracker for new execution
   *
   * Clears all recorded updates. Useful when reusing the same tracker
   * across multiple execution cycles.
   */
  reset(): void {
    this.updates = [];
  }
}

/**
 * Create a progress tracker connected to a transport's edit function
 *
 * Convenience factory for the most common use case: updating a message
 * via the transport layer (Telegram, GitHub, etc.).
 *
 * @param editMessage - Transport edit function (e.g., transport.edit(ctx, ref, text))
 * @param options - Optional configuration
 * @returns Configured ProgressTracker instance
 *
 * @example
 * ```typescript
 * const tracker = createProgressTracker(
 *   (text) => transport.edit(ctx, messageRef, text),
 *   { maxDisplayedUpdates: 5 }
 * );
 *
 * await tracker.thinking(1);
 * await tracker.toolStart('search', 1);
 * ```
 */
export function createProgressTracker(
  editMessage: (text: string) => Promise<void>,
  options?: { maxDisplayedUpdates?: number }
): ProgressTracker {
  return new ProgressTracker({
    ...options,
    onUpdate: editMessage,
  });
}
