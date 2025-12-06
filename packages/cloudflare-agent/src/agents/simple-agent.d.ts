/**
 * Simple Agent
 *
 * Handles simple queries that don't need tools or orchestration.
 * Provides direct LLM responses using conversation history from ExecutionContext.
 *
 * This agent is STATELESS for conversation history - history is passed via
 * ExecutionContext.conversationHistory from the parent agent (CloudflareAgent).
 * This enables centralized state management where only the parent stores history.
 *
 * SimpleAgent extends BaseAgent to leverage:
 * - Provider management for LLM calls
 * - Message sending and editing via transport
 * - Execution context tracing and debug accumulation
 * - Typing indicators and thinking status updates
 */
import { Agent } from 'agents';
import type { BaseEnv, BaseState } from '../base/index.js';
import type { AgentProvider } from '../execution/agent-provider.js';
/**
 * Simple agent state
 *
 * Extends BaseState with optional analytics. Conversation history is stateless
 * and passed via ExecutionContext.conversationHistory from the parent agent.
 */
export interface SimpleAgentState extends BaseState {
  /** Session identifier (optional) */
  sessionId?: string;
  /** Number of queries executed (for analytics) */
  queriesExecuted: number;
}
/**
 * Environment bindings for simple agent
 * Note: Actual env fields depend on the provider (OpenRouterProviderEnv, etc.)
 * This interface is kept minimal - extend with provider-specific env in your app
 */
export interface SimpleAgentEnv extends BaseEnv {}
/**
 * Web search configuration for SimpleAgent
 */
export interface WebSearchConfig {
  /** Enable web search */
  enabled: boolean;
  /** Maximum number of search results (default: 5, max: 10) */
  maxResults?: number;
  /** Search engine: 'native' uses model's built-in search, 'exa' uses Exa API */
  engine?: 'native' | 'exa';
}
/**
 * Configuration for simple agent
 */
export interface SimpleAgentConfig<TEnv extends SimpleAgentEnv> {
  /** Function to create agent provider from env */
  createProvider: (env: TEnv) => AgentProvider;
  /** System prompt for the agent */
  systemPrompt: string;
  /** Maximum messages in history */
  maxHistory?: number;
  /** Enable detailed logging */
  debug?: boolean;
  /**
   * Enable native web search via OpenRouter plugins.
   * When enabled, the model can access real-time web information.
   *
   * @example
   * ```typescript
   * webSearch: true  // Enable with defaults
   * webSearch: { enabled: true, maxResults: 3 }  // Custom config
   * ```
   */
  webSearch?: boolean | WebSearchConfig;
}
/**
 * Type for SimpleAgent class
 */
export type SimpleAgentClass<TEnv extends SimpleAgentEnv> = typeof Agent<TEnv, SimpleAgentState> & {
  new (
    ...args: ConstructorParameters<typeof Agent<TEnv, SimpleAgentState>>
  ): Agent<TEnv, SimpleAgentState>;
};
/**
 * Create a Simple Agent class
 *
 * Extends BaseAgent to provide:
 * - Provider management for LLM calls via this.chat()
 * - Message sending via this.respond()
 * - Status updates via this.updateThinking()
 * - Typing indicators via this.sendTyping()
 * - Execution tracing via this.recordExecution()
 *
 * @example
 * ```typescript
 * export const SimpleAgent = createSimpleAgent({
 *   createProvider: (env) => createAIGatewayProvider(env),
 *   systemPrompt: 'You are a helpful assistant.',
 * });
 * ```
 */
export declare function createSimpleAgent<TEnv extends SimpleAgentEnv>(
  config: SimpleAgentConfig<TEnv>
): SimpleAgentClass<TEnv>;
/**
 * Type for simple agent instance
 */
export type SimpleAgentInstance<TEnv extends SimpleAgentEnv> = InstanceType<
  ReturnType<typeof createSimpleAgent<TEnv>>
>;
//# sourceMappingURL=simple-agent.d.ts.map
