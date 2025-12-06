import type {
  AgentStep,
  AppSource,
  Classification,
  DebugContext,
  ObservabilityEvent,
  TokenCounts,
} from './types.js';
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
export declare class EventCollector {
  private eventId;
  private requestId?;
  private appSource;
  private eventType;
  private triggeredAt;
  private completedAt?;
  private userId?;
  private username?;
  private chatId?;
  private repo?;
  private status;
  private errorType?;
  private errorMessage?;
  private inputText?;
  private responseText?;
  private classification?;
  private agents;
  private model?;
  private metadata?;
  constructor(init: EventCollectorInit);
  /**
   * Set trigger context (user, chat, repo info).
   */
  setContext(ctx: TriggerContext): void;
  /**
   * Set the full input text.
   */
  setInput(text: string): void;
  /**
   * Set the primary model used.
   */
  setModel(model: string): void;
  /**
   * Set additional metadata.
   */
  setMetadata(metadata: Record<string, unknown>): void;
  /**
   * Add an agent step to the execution chain.
   * Tokens should be embedded in the AgentStep.
   */
  addAgent(step: AgentStep): void;
  /**
   * Update tokens for an existing agent by name.
   * Useful when tokens arrive after initial addAgent() call.
   */
  updateAgentTokens(agentName: string, tokens: TokenCounts): void;
  /**
   * Add a worker to an existing parent agent (usually orchestrator).
   */
  addWorkerToAgent(parentAgentName: string, worker: AgentStep): void;
  /**
   * Set classification result from router agent.
   */
  setClassification(classification: Classification): void;
  /**
   * Mark event as processing (in-flight).
   */
  markProcessing(): void;
  /**
   * Complete the event with final status and response.
   */
  complete(completion: EventCompletion): void;
  /**
   * Calculate aggregated token totals from all agents and workers.
   */
  private calculateTokenTotals;
  /**
   * Get the final ObservabilityEvent object for storage.
   */
  toEvent(): ObservabilityEvent;
  /**
   * Get the event ID.
   */
  getEventId(): string;
  /**
   * Check if event is completed.
   */
  isCompleted(): boolean;
  /**
   * Set agents from DebugContext (from chat-agent StepProgressTracker).
   * This converts the debug context to AgentStep[] format.
   *
   * Also extracts classification if present in debug context.
   */
  setFromDebugContext(debugContext: DebugContext): void;
  /**
   * Set agents directly (replaces existing agents).
   */
  setAgents(agents: AgentStep[]): void;
}
//# sourceMappingURL=collector.d.ts.map
