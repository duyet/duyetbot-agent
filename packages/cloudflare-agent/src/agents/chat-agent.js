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
import { Agent } from 'agents';
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
export function createChatAgent(config) {
  const debug = config.debug ?? false;
  if (debug) {
    logger.warn(
      '[ChatAgent] DEPRECATED: createChatAgent is deprecated. Use createRouterAgent() instead.'
    );
  }
  return class ChatAgent extends Agent {
    /**
     * Stub implementation - initializes minimal state
     */
    initialState = {
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  };
}
