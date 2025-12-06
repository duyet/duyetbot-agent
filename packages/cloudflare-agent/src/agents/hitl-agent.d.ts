/**
 * HITL Agent (Human-in-the-Loop)
 *
 * Manages tool confirmation workflows for sensitive operations.
 * Extends BaseAgent to intercept tool calls, request user confirmation, and execute approved tools.
 *
 * This agent is STATELESS for conversation history - history is passed via
 * ExecutionContext.conversationHistory from the parent agent (CloudflareAgent).
 * This enables centralized state management where only the parent stores history.
 *
 * Based on Cloudflare's HITL pattern:
 * https://developers.cloudflare.com/agents/patterns/human-in-the-loop/
 */
import { BaseAgent } from '../base/base-agent.js';
import type { AgentResult, BaseEnv, BaseState } from '../base/index.js';
import type { AgentProvider } from '../execution/agent-provider.js';
import type { ExecutionContext } from '../execution/context.js';
import { type RiskLevel } from '../hitl/confirmation.js';
import { type ToolExecutor } from '../hitl/executions.js';
import { type HITLState } from '../hitl/state-machine.js';
/**
 * HITL Agent state (extends BaseState and HITLState)
 *
 * Combines BaseState timestamps with HITL confirmation state machine fields.
 * This agent is intentionally stateless for conversation history.
 * Conversation history is passed via ExecutionContext.conversationHistory from the parent agent.
 * This enables centralized state management where only the parent (CloudflareAgent) stores history.
 */
export interface HITLAgentState extends BaseState, HITLState {
  /** LLM-generated tool calls awaiting confirmation */
  pendingToolCalls: Array<{
    toolName: string;
    toolArgs: Record<string, unknown>;
    description: string;
  }>;
}
/**
 * Environment bindings for HITL agent (extends BaseEnv)
 * Note: Actual env fields depend on the provider (OpenRouterProviderEnv, etc.)
 * This interface is kept minimal - extend with provider-specific env in your app
 */
export interface HITLAgentEnv extends BaseEnv {}
/**
 * Configuration for HITL agent
 */
export interface HITLAgentConfig<TEnv extends HITLAgentEnv> {
  /** Function to create agent provider from env */
  createProvider: (env: TEnv) => AgentProvider;
  /** System prompt for the agent */
  systemPrompt: string;
  /** Maximum messages in history */
  maxHistory?: number;
  /** Risk threshold for requiring confirmation */
  confirmationThreshold?: RiskLevel;
  /** Tool executor function */
  toolExecutor?: ToolExecutor;
  /** Available tools */
  tools?: Array<{
    name: string;
    description: string;
  }>;
  /** Enable detailed logging */
  debug?: boolean;
}
/**
 * Methods exposed by HITLAgent
 */
export interface HITLAgentMethods {
  handle(ctx: ExecutionContext): Promise<AgentResult>;
  processConfirmation(ctx: ExecutionContext, response: string): Promise<AgentResult>;
  getPendingCount(): number;
  getStatus(): string;
  clearHistory(): void;
}
/**
 * Type for HITLAgent class
 */
export type HITLAgentClass<TEnv extends HITLAgentEnv> = typeof BaseAgent<TEnv, HITLAgentState> & {
  new (
    ...args: ConstructorParameters<typeof BaseAgent<TEnv, HITLAgentState>>
  ): BaseAgent<TEnv, HITLAgentState> & HITLAgentMethods;
};
/**
 * Create a HITL Agent class
 *
 * @example
 * ```typescript
 * export const HITLAgent = createHITLAgent({
 *   createProvider: (env) => createAIGatewayProvider(env),
 *   systemPrompt: 'You are a helpful assistant.',
 *   confirmationThreshold: 'medium',
 *   toolExecutor: async (toolName, args) => {
 *     // Execute tool and return result
 *   },
 * });
 * ```
 */
export declare function createHITLAgent<TEnv extends HITLAgentEnv>(
  config: HITLAgentConfig<TEnv>
): HITLAgentClass<TEnv>;
/**
 * Type for HITL agent instance
 */
export type HITLAgentInstance<TEnv extends HITLAgentEnv> = InstanceType<
  ReturnType<typeof createHITLAgent<TEnv>>
>;
//# sourceMappingURL=hitl-agent.d.ts.map
