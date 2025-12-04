/**
 * Chat Agent
 *
 * DEPRECATED: This module is no longer actively used. The new architecture uses:
 * - RouterAgent for query classification and routing
 * - Specialized agents (SimpleAgent, OrchestratorAgent, etc.) for handling queries
 * - ExecutionContext for state and tracing across agent calls
 *
 * This file is maintained for backward compatibility but should not be used
 * in new implementations. It exports empty stubs to prevent breaking changes.
 *
 * Migration Guide:
 * 1. Use createRouterAgent() as the entry point for query routing
 * 2. Use createSimpleAgent() for basic Q&A queries
 * 3. Use createOrchestratorAgent() for complex task decomposition
 * 4. Store conversation history centrally (e.g., in parent CloudflareAgent)
 *
 * @see ./router-agent.ts
 * @see ./simple-agent.ts
 * @see ./orchestrator-agent.ts
 */

import { logger } from '@duyetbot/hono-middleware';
import { Agent, type AgentNamespace } from 'agents';
import type { Message } from '../types.js';

// =============================================================================
// Type Definitions (for backward compatibility)
// =============================================================================

/**
 * Extended state for ChatAgent
 * @deprecated Use ExecutionContext from './execution/context.js' instead
 */
export interface ChatAgentState {
  /** Conversation history */
  messages: Message[];
  /** User identifier */
  userId?: string | number;
  /** Chat/conversation identifier */
  chatId?: string | number;
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Environment bindings for ChatAgent
 * @deprecated Use RouterAgentEnv instead
 */
export interface ChatAgentEnv {
  /** RouterAgent for query classification and routing */
  RouterAgent?: AgentNamespace<Agent<ChatAgentEnv, unknown>>;
}

/**
 * Configuration for ChatAgent
 * @deprecated Use RouterAgentConfig instead
 */
export interface ChatAgentConfig {
  /** System prompt for the agent */
  systemPrompt: string;
  /** Maximum conversation history length (default: 50) */
  maxHistoryLength?: number;
  /** Enable detailed logging */
  debug?: boolean;
}

/**
 * Methods exposed by ChatAgent
 * @deprecated Use RouterAgentMethods instead
 */
export type ChatAgentMethods = {};

/**
 * Type for ChatAgent class
 * @deprecated Use RouterAgentClass instead
 */
export type ChatAgentClass<TEnv extends ChatAgentEnv> = typeof Agent<TEnv, ChatAgentState> & {
  new (
    ...args: ConstructorParameters<typeof Agent<TEnv, ChatAgentState>>
  ): Agent<TEnv, ChatAgentState> & ChatAgentMethods;
};

// =============================================================================
// Factory Function (stub - do not use)
// =============================================================================

/**
 * Create a ChatAgent class
 *
 * @deprecated This function creates an incomplete implementation.
 * Use createRouterAgent() instead for new implementations.
 *
 * @param config - Agent configuration
 * @returns ChatAgent class (non-functional)
 *
 * @example
 * ```typescript
 * // DEPRECATED - do not use
 * // Instead, use:
 * // export const RouterAgent = createRouterAgent({
 * //   createProvider: (env) => createAIGatewayProvider(env),
 * // });
 * ```
 */
export function createChatAgent<TEnv extends ChatAgentEnv>(
  config: ChatAgentConfig
): ChatAgentClass<TEnv> {
  const debug = config.debug ?? false;

  if (debug) {
    logger.warn(
      '[ChatAgent] DEPRECATED: createChatAgent is deprecated. Use createRouterAgent() instead.'
    );
  }

  return class ChatAgent extends Agent<TEnv, ChatAgentState> {
    /**
     * Stub implementation - initializes minimal state
     */
    override initialState: ChatAgentState = {
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  } as unknown as ChatAgentClass<TEnv>;
}
