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
function formatSize(bytes) {
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
function truncate(str, maxLength) {
  if (str.length <= maxLength) {
    return str;
  }
  return `${str.slice(0, maxLength - 3)}...`;
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
export class StepProgressTracker {
  completedSteps = [];
  currentPrefix = '';
  suffixIndex = 0;
  rotationTimer = null;
  onUpdate;
  executionPath = [];
  config;
  isDestroyed = false;
  /**
   * Debug context for progressive footer display
   * Accumulates routing flow, timing, and worker information
   */
  debugContext = {
    routingFlow: [],
  };
  /** Track tools used by the current agent */
  currentAgentTools = [];
  /** Router start time for measuring classification duration */
  routerStartTime;
  /** Current target agent start time */
  targetAgentStartTime;
  /** Accumulated token usage for the entire request */
  aggregatedTokenUsage = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  };
  /** Token usage for current routing step (router or target agent) */
  currentStepTokenUsage;
  /** Model used for current routing step */
  currentStepModel;
  /**
   * Create a new step progress tracker
   *
   * @param onUpdate - Callback to send updated message (e.g., transport.edit)
   * @param config - Optional configuration
   */
  constructor(onUpdate, config = {}) {
    this.onUpdate = onUpdate;
    this.config = {
      rotationInterval: config.rotationInterval ?? 5000,
      maxResultPreview: config.maxResultPreview ?? 50,
      rotatingSuffixes: config.rotatingSuffixes ?? ROTATING_SUFFIXES,
    };
  }
  // ============================================================================
  // Debug Context Methods
  // ============================================================================
  /**
   * Mark router as started (begins timing for routerDurationMs)
   */
  startRouter() {
    this.routerStartTime = Date.now();
    // Add router to routing flow with 'running' status
    this.debugContext.routingFlow.push({
      agent: 'router-agent',
      status: 'running',
    });
  }
  /**
   * Mark router as complete and record the target agent
   *
   * @param targetAgent - The agent routed to (e.g., 'simple-agent', 'orchestrator-agent')
   * @param classification - Optional classification result
   */
  completeRouter(targetAgent, classification) {
    // Calculate router duration
    if (this.routerStartTime) {
      this.debugContext.routerDurationMs = Date.now() - this.routerStartTime;
    }
    // Update router status to completed
    const routerStep = this.debugContext.routingFlow.find((s) => s.agent === 'router-agent');
    if (routerStep) {
      routerStep.status = 'completed';
      if (this.debugContext.routerDurationMs) {
        routerStep.durationMs = this.debugContext.routerDurationMs;
      }
    }
    // Add target agent with 'running' status
    this.debugContext.routingFlow.push({
      agent: targetAgent,
      status: 'running',
    });
    // Store classification if provided
    if (classification) {
      this.debugContext.classification = classification;
    }
    // Start timing target agent
    this.targetAgentStartTime = Date.now();
  }
  /**
   * Add or update a worker in the debug context
   *
   * @param workerName - Worker name (e.g., 'research-worker')
   * @param status - Execution status
   * @param durationMs - Optional duration if completed
   */
  updateWorker(workerName, status, durationMs) {
    if (!this.debugContext.workers) {
      this.debugContext.workers = [];
    }
    // Find existing worker or add new one
    const existingIndex = this.debugContext.workers.findIndex((w) => w.name === workerName);
    // Build worker info with explicit type to handle exactOptionalPropertyTypes
    const workerInfo = {
      name: workerName,
      status,
    };
    if (durationMs !== undefined) {
      workerInfo.durationMs = durationMs;
    }
    if (existingIndex >= 0) {
      this.debugContext.workers[existingIndex] = workerInfo;
    } else {
      this.debugContext.workers.push(workerInfo);
    }
  }
  /**
   * Mark target agent as complete
   *
   * @param durationMs - Optional explicit duration (uses calculated time if not provided)
   */
  completeTargetAgent(durationMs) {
    const targetStep = this.debugContext.routingFlow.find(
      (s) => s.agent !== 'router-agent' && s.status === 'running'
    );
    if (targetStep) {
      targetStep.status = 'completed';
      const duration =
        durationMs ??
        (this.targetAgentStartTime ? Date.now() - this.targetAgentStartTime : undefined);
      if (duration !== undefined) {
        targetStep.durationMs = duration;
      }
      // Add toolChain to the target step
      if (this.currentAgentTools.length > 0) {
        targetStep.toolChain = [...this.currentAgentTools];
      }
    }
    // Calculate total duration
    if (this.routerStartTime) {
      this.debugContext.totalDurationMs = Date.now() - this.routerStartTime;
    }
  }
  /**
   * Get the current debug context for progressive footer display
   */
  getDebugContext() {
    // Include aggregated token usage in metadata
    const context = { ...this.debugContext };
    if (this.aggregatedTokenUsage.totalTokens > 0) {
      context.metadata = {
        ...context.metadata,
        tokenUsage: { ...this.aggregatedTokenUsage },
      };
    }
    return context;
  }
  /**
   * Set the full debug context (useful when receiving from routed agent)
   *
   * @param context - The debug context to set
   */
  setDebugContext(context) {
    this.debugContext = { ...context };
    // Import token usage from context if present
    if (context.metadata?.tokenUsage) {
      this.aggregatedTokenUsage = { ...context.metadata.tokenUsage };
    }
  }
  // ============================================================================
  // Token Usage Tracking Methods
  // ============================================================================
  /**
   * Add token usage from an LLM call to the current step and aggregate totals
   *
   * @param usage - Token usage from the LLM response
   */
  addTokenUsage(usage) {
    // Accumulate to current step
    if (!this.currentStepTokenUsage) {
      this.currentStepTokenUsage = {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      };
    }
    this.currentStepTokenUsage.inputTokens += usage.inputTokens;
    this.currentStepTokenUsage.outputTokens += usage.outputTokens;
    this.currentStepTokenUsage.totalTokens += usage.totalTokens;
    if (usage.cachedTokens) {
      this.currentStepTokenUsage.cachedTokens =
        (this.currentStepTokenUsage.cachedTokens ?? 0) + usage.cachedTokens;
    }
    if (usage.reasoningTokens) {
      this.currentStepTokenUsage.reasoningTokens =
        (this.currentStepTokenUsage.reasoningTokens ?? 0) + usage.reasoningTokens;
    }
    // Accumulate to aggregate totals
    this.aggregatedTokenUsage.inputTokens += usage.inputTokens;
    this.aggregatedTokenUsage.outputTokens += usage.outputTokens;
    this.aggregatedTokenUsage.totalTokens += usage.totalTokens;
    if (usage.cachedTokens) {
      this.aggregatedTokenUsage.cachedTokens =
        (this.aggregatedTokenUsage.cachedTokens ?? 0) + usage.cachedTokens;
    }
    if (usage.reasoningTokens) {
      this.aggregatedTokenUsage.reasoningTokens =
        (this.aggregatedTokenUsage.reasoningTokens ?? 0) + usage.reasoningTokens;
    }
  }
  /**
   * Set the model used for the current routing step
   *
   * @param model - Model identifier (e.g., 'claude-3-5-sonnet-20241022')
   */
  setModel(model) {
    this.currentStepModel = model;
  }
  /**
   * Finalize token usage for the current routing step (router or target agent)
   * This attaches the accumulated tokens to the current step in routingFlow
   */
  finalizeStepTokenUsage() {
    // Nothing to finalize if neither tokens nor model are set
    if (!this.currentStepTokenUsage && !this.currentStepModel) {
      return;
    }
    const routingFlow = this.debugContext.routingFlow;
    if (routingFlow.length === 0) {
      this.currentStepTokenUsage = undefined;
      this.currentStepModel = undefined;
      return;
    }
    // Find the current active step (last one with 'running' or most recent)
    // Use reverse loop since findLast may not be available in all environments
    let currentStep = routingFlow[routingFlow.length - 1];
    for (let i = routingFlow.length - 1; i >= 0; i--) {
      const step = routingFlow[i];
      if (step && step.status === 'running') {
        currentStep = step;
        break;
      }
    }
    if (currentStep) {
      if (this.currentStepTokenUsage && this.currentStepTokenUsage.totalTokens > 0) {
        currentStep.tokenUsage = { ...this.currentStepTokenUsage };
      }
      if (this.currentStepModel) {
        currentStep.model = this.currentStepModel;
      }
    }
    // Reset for next step
    this.currentStepTokenUsage = undefined;
    this.currentStepModel = undefined;
  }
  /**
   * Add token usage to a specific worker
   *
   * @param workerName - The worker name
   * @param usage - Token usage for the worker
   */
  addWorkerTokenUsage(workerName, usage) {
    if (!this.debugContext.workers) {
      return;
    }
    const worker = this.debugContext.workers.find((w) => w.name === workerName);
    if (worker) {
      worker.tokenUsage = { ...usage };
    }
    // Also add to aggregate (workers are part of total)
    this.aggregatedTokenUsage.inputTokens += usage.inputTokens;
    this.aggregatedTokenUsage.outputTokens += usage.outputTokens;
    this.aggregatedTokenUsage.totalTokens += usage.totalTokens;
    if (usage.cachedTokens) {
      this.aggregatedTokenUsage.cachedTokens =
        (this.aggregatedTokenUsage.cachedTokens ?? 0) + usage.cachedTokens;
    }
    if (usage.reasoningTokens) {
      this.aggregatedTokenUsage.reasoningTokens =
        (this.aggregatedTokenUsage.reasoningTokens ?? 0) + usage.reasoningTokens;
    }
  }
  /**
   * Get the aggregated token usage for all steps
   */
  getAggregatedTokenUsage() {
    return { ...this.aggregatedTokenUsage };
  }
  /**
   * Add a step event and update the display
   *
   * @param event - The step event to add
   */
  async addStep(event) {
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
        // Reset tools list for the new agent
        this.currentAgentTools = [];
        await this.update();
        break;
      case 'tool_start':
        this.executionPath.push(`tool:${event.toolName}:start`);
        this.currentPrefix = `⚙️ ${event.toolName} running`;
        // Track this tool for the current agent
        if (event.toolName && !this.currentAgentTools.includes(event.toolName)) {
          this.currentAgentTools.push(event.toolName);
        }
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
  async startRotation() {
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
  stopRotation() {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
      this.rotationTimer = null;
    }
  }
  /**
   * Build the current message and send it via onUpdate
   */
  async update() {
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
  getExecutionPath() {
    return [...this.executionPath];
  }
  /**
   * Get formatted execution path as string
   */
  getExecutionPathString() {
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
  destroy() {
    this.isDestroyed = true;
    this.stopRotation();
  }
  /**
   * Check if the tracker has been destroyed
   */
  get destroyed() {
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
export function createStepProgressTracker(editFn, config) {
  return new StepProgressTracker(editFn, config);
}
