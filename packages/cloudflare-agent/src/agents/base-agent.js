/**
 * Base Agent
 *
 * Abstract base class for all agents in the routing/orchestration system.
 * Provides common functionality for Durable Object agents.
 */
import { logger } from '@duyetbot/hono-middleware';
/**
 * Helper to create a base state
 */
export function createBaseState(sessionId) {
  return {
    sessionId,
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
/**
 * Mixin to add common agent functionality
 *
 * Since we can't use abstract classes with Durable Objects easily,
 * this provides utility functions that agents can use.
 */
export const AgentMixin = {
  /**
   * Trim message history to max length
   */
  trimHistory(messages, maxHistory) {
    if (messages.length <= maxHistory) {
      return messages;
    }
    // Keep system messages and trim from the beginning
    const systemMessages = messages.filter((m) => m.role === 'system');
    const nonSystemMessages = messages.filter((m) => m.role !== 'system');
    const trimmed = nonSystemMessages.slice(-(maxHistory - systemMessages.length));
    return [...systemMessages, ...trimmed];
  },
  /**
   * Generate a unique ID
   */
  generateId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  },
  /**
   * Log agent activity
   */
  log(agentName, action, data) {
    logger.info(`[${agentName}] ${action}`, data);
  },
  /**
   * Log agent error
   */
  logError(agentName, action, error, data) {
    logger.error(`[${agentName}] ${action}`, {
      ...data,
      error: error instanceof Error ? error.message : String(error),
    });
  },
  /**
   * Measure execution time
   */
  async timed(fn) {
    const start = Date.now();
    const result = await fn();
    return { result, durationMs: Date.now() - start };
  },
  /**
   * Create agent result
   */
  createResult(success, content, durationMs, extra) {
    return {
      success,
      content,
      durationMs,
      data: undefined,
      error: undefined,
      tokensUsed: undefined,
      nextAction: undefined,
      ...extra,
    };
  },
  /**
   * Create error result
   */
  createErrorResult(error, durationMs) {
    return {
      success: false,
      content: undefined,
      data: undefined,
      error: error instanceof Error ? error.message : String(error),
      durationMs,
      tokensUsed: undefined,
      nextAction: undefined,
    };
  },
};
/**
 * Type guard to check if an object is an Agent
 */
export function isAgent(obj) {
  return typeof obj === 'object' && obj !== null && 'state' in obj && 'setState' in obj;
}
/**
 * Helper to safely get agent by name with proper typing
 */
export async function getTypedAgent(namespace, name) {
  const id = namespace.idFromName(name);
  return namespace.get(id);
}
