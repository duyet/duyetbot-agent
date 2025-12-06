import { debugContextToAgentSteps } from './types.js';
/**
 * EventCollector accumulates observability data during request lifecycle.
 *
 * Usage:
 * 1. Create collector at request start with initial data
 * 2. Call setContext(), setInput() to add trigger info
 * 3. Call addAgent() for each agent/worker execution
 * 4. Call updateAgentTokens() if tokens arrive after addAgent
 * 5. Call setClassification() after router classification
 * 6. Call complete() when request finishes
 * 7. Call toEvent() to get final event for storage
 */
export class EventCollector {
  eventId;
  requestId;
  appSource;
  eventType;
  triggeredAt;
  completedAt;
  userId;
  username;
  chatId;
  repo;
  status = 'pending';
  errorType;
  errorMessage;
  inputText;
  responseText;
  classification;
  agents = [];
  model;
  metadata;
  constructor(init) {
    this.eventId = init.eventId;
    this.appSource = init.appSource;
    this.eventType = init.eventType;
    this.triggeredAt = init.triggeredAt;
    if (init.requestId !== undefined) {
      this.requestId = init.requestId;
    }
  }
  /**
   * Set trigger context (user, chat, repo info).
   */
  setContext(ctx) {
    if (ctx.userId !== undefined) {
      this.userId = ctx.userId;
    }
    if (ctx.username !== undefined) {
      this.username = ctx.username;
    }
    if (ctx.chatId !== undefined) {
      this.chatId = ctx.chatId;
    }
    if (ctx.repo !== undefined) {
      this.repo = ctx.repo;
    }
  }
  /**
   * Set the full input text.
   */
  setInput(text) {
    this.inputText = text;
  }
  /**
   * Set the primary model used.
   */
  setModel(model) {
    this.model = model;
  }
  /**
   * Set additional metadata.
   */
  setMetadata(metadata) {
    this.metadata = { ...this.metadata, ...metadata };
  }
  /**
   * Add an agent step to the execution chain.
   * Tokens should be embedded in the AgentStep.
   */
  addAgent(step) {
    this.agents.push(step);
  }
  /**
   * Update tokens for an existing agent by name.
   * Useful when tokens arrive after initial addAgent() call.
   */
  updateAgentTokens(agentName, tokens) {
    const agent = this.agents.find((a) => a.name === agentName);
    if (agent) {
      agent.input_tokens = tokens.input;
      agent.output_tokens = tokens.output;
      if (tokens.cached !== undefined) {
        agent.cached_tokens = tokens.cached;
      }
      if (tokens.reasoning !== undefined) {
        agent.reasoning_tokens = tokens.reasoning;
      }
    }
  }
  /**
   * Add a worker to an existing parent agent (usually orchestrator).
   */
  addWorkerToAgent(parentAgentName, worker) {
    const parent = this.agents.find((a) => a.name === parentAgentName);
    if (parent) {
      if (!parent.workers) {
        parent.workers = [];
      }
      parent.workers.push(worker);
    }
  }
  /**
   * Set classification result from router agent.
   */
  setClassification(classification) {
    this.classification = classification;
  }
  /**
   * Mark event as processing (in-flight).
   */
  markProcessing() {
    this.status = 'processing';
  }
  /**
   * Complete the event with final status and response.
   */
  complete(completion) {
    this.completedAt = Date.now();
    this.status = completion.status;
    if (completion.responseText !== undefined) {
      this.responseText = completion.responseText;
    }
    if (completion.error) {
      this.errorType = completion.error.constructor.name;
      this.errorMessage = completion.error.message;
    }
  }
  /**
   * Calculate aggregated token totals from all agents and workers.
   */
  calculateTokenTotals() {
    let inputTokens = 0;
    let outputTokens = 0;
    let cachedTokens = 0;
    let reasoningTokens = 0;
    const sumAgentTokens = (agents) => {
      for (const agent of agents) {
        inputTokens += agent.input_tokens || 0;
        outputTokens += agent.output_tokens || 0;
        cachedTokens += agent.cached_tokens || 0;
        reasoningTokens += agent.reasoning_tokens || 0;
        if (agent.workers) {
          sumAgentTokens(agent.workers);
        }
      }
    };
    sumAgentTokens(this.agents);
    return {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      cachedTokens,
      reasoningTokens,
    };
  }
  /**
   * Get the final ObservabilityEvent object for storage.
   */
  toEvent() {
    const tokenTotals = this.calculateTokenTotals();
    // Build event object, only including optional properties when they have values
    // This is required for exactOptionalPropertyTypes compatibility
    const event = {
      eventId: this.eventId,
      appSource: this.appSource,
      eventType: this.eventType,
      triggeredAt: this.triggeredAt,
      status: this.status,
      agents: this.agents,
      ...tokenTotals,
    };
    // Conditionally add optional properties
    if (this.requestId !== undefined) {
      event.requestId = this.requestId;
    }
    if (this.userId !== undefined) {
      event.userId = this.userId;
    }
    if (this.username !== undefined) {
      event.username = this.username;
    }
    if (this.chatId !== undefined) {
      event.chatId = this.chatId;
    }
    if (this.repo !== undefined) {
      event.repo = this.repo;
    }
    if (this.completedAt !== undefined) {
      event.completedAt = this.completedAt;
      event.durationMs = this.completedAt - this.triggeredAt;
    }
    if (this.errorType !== undefined) {
      event.errorType = this.errorType;
    }
    if (this.errorMessage !== undefined) {
      event.errorMessage = this.errorMessage;
    }
    if (this.inputText !== undefined) {
      event.inputText = this.inputText;
    }
    if (this.responseText !== undefined) {
      event.responseText = this.responseText;
    }
    if (this.classification !== undefined) {
      event.classification = this.classification;
    }
    if (this.model !== undefined) {
      event.model = this.model;
    }
    if (this.metadata !== undefined) {
      event.metadata = this.metadata;
    }
    return event;
  }
  /**
   * Get the event ID.
   */
  getEventId() {
    return this.eventId;
  }
  /**
   * Check if event is completed.
   */
  isCompleted() {
    return this.status === 'success' || this.status === 'error';
  }
  /**
   * Set agents from DebugContext (from chat-agent StepProgressTracker).
   * This converts the debug context to AgentStep[] format.
   *
   * Also extracts classification if present in debug context.
   */
  setFromDebugContext(debugContext) {
    this.agents = debugContextToAgentSteps(debugContext);
    // Extract classification if present
    if (debugContext.classification) {
      this.classification = {
        type: debugContext.classification.type ?? 'unknown',
        category: debugContext.classification.category ?? 'unknown',
        complexity: debugContext.classification.complexity ?? 'unknown',
      };
    }
  }
  /**
   * Set agents directly (replaces existing agents).
   */
  setAgents(agents) {
    this.agents = agents;
  }
}
