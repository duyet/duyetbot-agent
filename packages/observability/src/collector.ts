import type {
  AgentStep,
  AppSource,
  Classification,
  DebugContext,
  EventStatus,
  ObservabilityEvent,
  TokenCounts,
} from './types.js';
import { debugContextToAgentSteps } from './types.js';

/**
 * Initial event data required to create a collector.
 */
export interface EventCollectorInit {
  eventId: string;
  appSource: AppSource;
  eventType: string;
  triggeredAt: number;
  requestId?: string;
}

/**
 * Context for the event trigger.
 */
export interface TriggerContext {
  userId?: string;
  username?: string;
  chatId?: string;
  repo?: string;
}

/**
 * Completion data for the event.
 */
export interface EventCompletion {
  status: 'success' | 'error';
  responseText?: string;
  error?: Error;
}

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
  private eventId: string;
  private requestId?: string;
  private appSource: AppSource;
  private eventType: string;
  private triggeredAt: number;
  private completedAt?: number;

  private userId?: string;
  private username?: string;
  private chatId?: string;
  private repo?: string;

  private status: EventStatus = 'pending';
  private errorType?: string;
  private errorMessage?: string;

  private inputText?: string;
  private responseText?: string;

  private classification?: Classification;
  private agents: AgentStep[] = [];
  private model?: string;
  private metadata?: Record<string, unknown>;

  constructor(init: EventCollectorInit) {
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
  setContext(ctx: TriggerContext): void {
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
  setInput(text: string): void {
    this.inputText = text;
  }

  /**
   * Set the primary model used.
   */
  setModel(model: string): void {
    this.model = model;
  }

  /**
   * Set additional metadata.
   */
  setMetadata(metadata: Record<string, unknown>): void {
    this.metadata = { ...this.metadata, ...metadata };
  }

  /**
   * Add an agent step to the execution chain.
   * Tokens should be embedded in the AgentStep.
   */
  addAgent(step: AgentStep): void {
    this.agents.push(step);
  }

  /**
   * Update tokens for an existing agent by name.
   * Useful when tokens arrive after initial addAgent() call.
   */
  updateAgentTokens(agentName: string, tokens: TokenCounts): void {
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
  addWorkerToAgent(parentAgentName: string, worker: AgentStep): void {
    const parent = this.agents.find((a) => a.name === parentAgentName);
    if (parent) {
      if (!parent.workers) parent.workers = [];
      parent.workers.push(worker);
    }
  }

  /**
   * Set classification result from router agent.
   */
  setClassification(classification: Classification): void {
    this.classification = classification;
  }

  /**
   * Mark event as processing (in-flight).
   */
  markProcessing(): void {
    this.status = 'processing';
  }

  /**
   * Complete the event with final status and response.
   */
  complete(completion: EventCompletion): void {
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
  private calculateTokenTotals(): {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cachedTokens: number;
    reasoningTokens: number;
  } {
    let inputTokens = 0;
    let outputTokens = 0;
    let cachedTokens = 0;
    let reasoningTokens = 0;

    const sumAgentTokens = (agents: AgentStep[]): void => {
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
  toEvent(): ObservabilityEvent {
    const tokenTotals = this.calculateTokenTotals();

    // Build event object, only including optional properties when they have values
    // This is required for exactOptionalPropertyTypes compatibility
    const event: ObservabilityEvent = {
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
  getEventId(): string {
    return this.eventId;
  }

  /**
   * Check if event is completed.
   */
  isCompleted(): boolean {
    return this.status === 'success' || this.status === 'error';
  }

  /**
   * Set agents from DebugContext (from chat-agent StepProgressTracker).
   * This converts the debug context to AgentStep[] format.
   *
   * Also extracts classification if present in debug context.
   */
  setFromDebugContext(debugContext: DebugContext): void {
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
  setAgents(agents: AgentStep[]): void {
    this.agents = agents;
  }
}
