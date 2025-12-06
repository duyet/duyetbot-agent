/**
 * Step Progress Tracker
 *
 * Tracks agent execution steps and provides real-time visual feedback.
 * Steps accumulate (completed steps stay visible) while the current active
 * step shows a rotating loading message.
 *
 * Also tracks debug context for progressive footer display during loading.
 * The debug context accumulates routing flow, workers, and timing information.
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
import type { DebugContext, ExecutionStatus, TokenUsage } from './types.js';
/**
 * Types of steps in the agent execution flow
 */
export type StepType =
  | 'thinking'
  | 'routing'
  | 'tool_start'
  | 'tool_complete'
  | 'tool_error'
  | 'llm_iteration'
  | 'preparing';
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
 * - Tracks debug context for progressive footer during loading
 */
export declare class StepProgressTracker {
  private completedSteps;
  private currentPrefix;
  private suffixIndex;
  private rotationTimer;
  private onUpdate;
  private executionPath;
  private config;
  private isDestroyed;
  /**
   * Debug context for progressive footer display
   * Accumulates routing flow, timing, and worker information
   */
  private debugContext;
  /** Track tools used by the current agent */
  private currentAgentTools;
  /** Router start time for measuring classification duration */
  private routerStartTime;
  /** Current target agent start time */
  private targetAgentStartTime;
  /** Accumulated token usage for the entire request */
  private aggregatedTokenUsage;
  /** Token usage for current routing step (router or target agent) */
  private currentStepTokenUsage;
  /** Model used for current routing step */
  private currentStepModel;
  /**
   * Create a new step progress tracker
   *
   * @param onUpdate - Callback to send updated message (e.g., transport.edit)
   * @param config - Optional configuration
   */
  constructor(onUpdate: (message: string) => Promise<void>, config?: StepProgressConfig);
  /**
   * Mark router as started (begins timing for routerDurationMs)
   */
  startRouter(): void;
  /**
   * Mark router as complete and record the target agent
   *
   * @param targetAgent - The agent routed to (e.g., 'simple-agent', 'orchestrator-agent')
   * @param classification - Optional classification result
   */
  completeRouter(targetAgent: string, classification?: DebugContext['classification']): void;
  /**
   * Add or update a worker in the debug context
   *
   * @param workerName - Worker name (e.g., 'research-worker')
   * @param status - Execution status
   * @param durationMs - Optional duration if completed
   */
  updateWorker(workerName: string, status: ExecutionStatus, durationMs?: number): void;
  /**
   * Mark target agent as complete
   *
   * @param durationMs - Optional explicit duration (uses calculated time if not provided)
   */
  completeTargetAgent(durationMs?: number): void;
  /**
   * Get the current debug context for progressive footer display
   */
  getDebugContext(): DebugContext;
  /**
   * Set the full debug context (useful when receiving from routed agent)
   *
   * @param context - The debug context to set
   */
  setDebugContext(context: DebugContext): void;
  /**
   * Add token usage from an LLM call to the current step and aggregate totals
   *
   * @param usage - Token usage from the LLM response
   */
  addTokenUsage(usage: TokenUsage): void;
  /**
   * Set the model used for the current routing step
   *
   * @param model - Model identifier (e.g., 'claude-3-5-sonnet-20241022')
   */
  setModel(model: string): void;
  /**
   * Finalize token usage for the current routing step (router or target agent)
   * This attaches the accumulated tokens to the current step in routingFlow
   */
  finalizeStepTokenUsage(): void;
  /**
   * Add token usage to a specific worker
   *
   * @param workerName - The worker name
   * @param usage - Token usage for the worker
   */
  addWorkerTokenUsage(workerName: string, usage: TokenUsage): void;
  /**
   * Get the aggregated token usage for all steps
   */
  getAggregatedTokenUsage(): TokenUsage;
  /**
   * Add a step event and update the display
   *
   * @param event - The step event to add
   */
  addStep(event: StepEvent): Promise<void>;
  /**
   * Start rotating suffix for the current step
   */
  private startRotation;
  /**
   * Stop the rotation timer
   */
  stopRotation(): void;
  /**
   * Build the current message and send it via onUpdate
   */
  private update;
  /**
   * Get the execution path for debug footer
   */
  getExecutionPath(): string[];
  /**
   * Get formatted execution path as string
   */
  getExecutionPathString(): string;
  /**
   * Clean up the tracker
   */
  destroy(): void;
  /**
   * Check if the tracker has been destroyed
   */
  get destroyed(): boolean;
}
/**
 * Create a step progress tracker with common defaults
 *
 * @param editFn - Function to edit the message
 * @param config - Optional configuration
 * @returns StepProgressTracker instance
 */
export declare function createStepProgressTracker(
  editFn: (message: string) => Promise<void>,
  config?: StepProgressConfig
): StepProgressTracker;
//# sourceMappingURL=step-progress.d.ts.map
