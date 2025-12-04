/**
 * Chat Agent - Durable Object Entry Point
 *
 * Serves as the primary entry point for chat conversations.
 * Manages conversation state, message history, and routing to specialized agents.
 *
 * This agent:
 * - Accepts incoming messages from platforms (Telegram, GitHub, etc.)
 * - Dispatches queries to RouterAgent for classification and routing
 * - Maintains conversation history locally
 * - Handles error recovery and thinking state rotation
 *
 * Architecture:
 * - Uses Durable Object state for persistence
 * - Queues messages for async processing with alarms
 * - Separates pending vs active execution contexts
 * - Rotates thinking messages while processing
 */

import { logger } from '@duyetbot/hono-middleware';
import { Agent, type AgentNamespace, getAgentByName } from 'agents';
import type { ExecutionContext } from '../execution/context.js';
import { createThinkingRotator } from '../format.js';
import { trimHistory } from '../history.js';
import type { ParsedInput } from '../transport.js';
import type { Message } from '../types.js';

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Extended state for ChatAgent
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
  /** Execution context waiting to be processed */
  pendingContext?: ExecutionContext;
  /** Currently active execution context */
  activeContext?: ExecutionContext;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Environment bindings for ChatAgent
 */
export interface ChatAgentEnv {
  /** RouterAgent for query classification and routing */
  RouterAgent?: AgentNamespace<Agent<ChatAgentEnv, unknown>>;
}

/**
 * Configuration for ChatAgent
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
 */
export interface ChatAgentMethods {
  /**
   * Receive an incoming message from a platform.
   * Sends immediate "thinking" response and schedules async processing.
   *
   * @param input - Parsed message input from platform
   * @returns Trace ID for tracking
   */
  receiveMessage(input: ParsedInput): Promise<{ traceId: string }>;

  /**
   * Process a pending message (called by alarm)
   */
  onProcessMessage(): Promise<void>;

  /**
   * Get current conversation history
   */
  getHistory(): Message[];

  /**
   * Clear conversation history
   */
  clearHistory(): void;
}

/**
 * Type for ChatAgent class
 */
export type ChatAgentClass<TEnv extends ChatAgentEnv> = typeof Agent<TEnv, ChatAgentState> & {
  new (
    ...args: ConstructorParameters<typeof Agent<TEnv, ChatAgentState>>
  ): Agent<TEnv, ChatAgentState> & ChatAgentMethods;
};

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a ChatAgent class
 *
 * @param config - Agent configuration
 * @returns ChatAgent class ready to be deployed as Durable Object
 *
 * @example
 * ```typescript
 * export const ChatAgent = createChatAgent({
 *   systemPrompt: 'You are a helpful assistant.',
 *   maxHistoryLength: 50,
 * });
 * ```
 */
export function createChatAgent<TEnv extends ChatAgentEnv>(
  config: ChatAgentConfig
): ChatAgentClass<TEnv> {
  const maxHistoryLength = config.maxHistoryLength ?? 50;
  const debug = config.debug ?? false;

  return class ChatAgent extends Agent<TEnv, ChatAgentState> {
    // =========================================================================
    // Durable Object Lifecycle
    // =========================================================================

    /**
     * Initialize or restore Durable Object state
     */
    async initialize(): Promise<void> {
      const existing = await this.state.get<ChatAgentState>('state');

      if (!existing) {
        const newState: ChatAgentState = {
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await this.state.put('state', newState);
      }

      if (debug) {
        logger.info('[ChatAgent] Initialized', { hasExisting: !!existing });
      }
    }

    /**
     * Get current state
     */
    private async getState(): Promise<ChatAgentState> {
      const state = await this.state.get<ChatAgentState>('state');
      if (!state) {
        throw new Error('ChatAgent state not initialized');
      }
      return state;
    }

    /**
     * Update state
     */
    private async setState(state: ChatAgentState): Promise<void> {
      state.updatedAt = Date.now();
      await this.state.put('state', state);
    }

    // =========================================================================
    // Main RPC Methods
    // =========================================================================

    /**
     * Receive an incoming message from a platform.
     * Sends immediate "thinking" response and schedules async processing.
     *
     * @param input - Parsed message input from platform
     * @returns Trace ID for tracking
     */
    async receiveMessage(input: ParsedInput): Promise<{ traceId: string }> {
      const state = await this.getState();

      // Create execution context from parsed input
      const { createExecutionContext } = await import('../execution/context.js');
      const ctx = createExecutionContext(input);

      // Set platform information
      ctx.platform = (input.metadata?.platform as any) || 'api';
      ctx.userId = input.userId;
      ctx.chatId = input.chatId;
      ctx.username = input.username;
      ctx.userMessageId = input.messageRef || 0;

      // Set conversation history
      ctx.conversationHistory = state.messages;

      if (debug) {
        logger.info('[ChatAgent.receiveMessage]', {
          traceId: ctx.traceId,
          query: input.text.slice(0, 100),
          historyLength: state.messages.length,
        });
      }

      // Store as pending context
      state.pendingContext = ctx;
      await this.setState(state);

      // Schedule processing
      await this.state.blockConcurrencyWhile(async () => {
        this.state.blockConcurrencyWhile(async () => {
          await this.state.storage.put('ALARM_SCHEDULED', true);
        });
      });

      // Set alarm to process (minimal delay)
      this.state.blockConcurrencyWhile(async () => {
        this.state.blockConcurrencyWhile(async () => {
          const alarmId = await this.state.storage.getAlarm();
          if (!alarmId) {
            await this.state.storage.setAlarm(Date.now() + 100);
          }
        });
      });

      return { traceId: ctx.traceId };
    }

    /**
     * Process pending message (called by alarm)
     * Implements atomic transition: pendingContext → activeContext
     */
    async onProcessMessage(): Promise<void> {
      const state = await this.getState();

      // Get pending context
      const ctx = state.pendingContext;
      if (!ctx) {
        if (debug) {
          logger.info('[ChatAgent.onProcessMessage] No pending context');
        }
        return;
      }

      // Atomic transition: move to active
      state.activeContext = ctx;
      state.pendingContext = undefined;
      await this.setState(state);

      if (debug) {
        logger.info('[ChatAgent.onProcessMessage] Starting', {
          traceId: ctx.traceId,
          query: ctx.query.slice(0, 100),
        });
      }

      // Create thinking rotator
      const rotator = createThinkingRotator({
        interval: 3000,
        random: true,
      });

      try {
        // Start rotation
        rotator.start(async (message) => {
          if (debug) {
            logger.debug('[ChatAgent] Thinking message', { message });
          }
          // Note: In real implementation, would call transport.edit() here
          // For now, just rotate the message
        });

        // Process query
        const result = await this.processQuery(ctx);

        // Save to history
        await this.saveToHistory(ctx, result);

        if (debug) {
          logger.info('[ChatAgent] Query processed', {
            traceId: ctx.traceId,
            resultSuccess: result.success,
            resultLength: result.content?.length || 0,
          });
        }
      } catch (error) {
        // Handle error
        await this.handleError(ctx, error);

        if (debug) {
          logger.error('[ChatAgent] Error processing query', {
            traceId: ctx.traceId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      } finally {
        // Stop rotator
        rotator.stop();

        // Clear active context
        const finalState = await this.getState();
        finalState.activeContext = undefined;
        await this.setState(finalState);
      }
    }

    // =========================================================================
    // Private Methods
    // =========================================================================

    /**
     * Process query by dispatching to RouterAgent
     */
    private async processQuery(ctx: ExecutionContext): Promise<AgentResult> {
      const routerAgent = getAgentByName(this.env.RouterAgent as any, 'router-agent');

      if (!routerAgent) {
        throw new Error('RouterAgent not available');
      }

      if (debug) {
        logger.debug('[ChatAgent] Dispatching to RouterAgent', {
          traceId: ctx.traceId,
        });
      }

      // Call RouterAgent's execute or route method
      // Implementation depends on RouterAgent's exposed methods
      try {
        const result = await (routerAgent as any).route(ctx);
        return result;
      } catch (error) {
        logger.error('[ChatAgent] RouterAgent error', {
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }

    /**
     * Build response for sending to user
     */
    private buildResponse(ctx: ExecutionContext, result: AgentResult): string {
      if (!result.success) {
        return `Error: ${result.error || 'Unknown error'}`;
      }

      if (!result.content) {
        return 'No response generated';
      }

      // Add debug footer for admin users
      let response = result.content;

      if (ctx.debug && result.debug) {
        response += '\n\n---\n\n**Debug Info:**\n';
        if (result.debug.tools?.length) {
          response += `Tools: ${result.debug.tools.join(', ')}\n`;
        }
        if (result.debug.metadata?.fallback) {
          response += `Fallback: Yes (${result.debug.metadata.originalError})\n`;
        }
      }

      return response;
    }

    /**
     * Save user message and assistant response to history
     */
    private async saveToHistory(ctx: ExecutionContext, result: AgentResult): Promise<void> {
      const state = await this.getState();

      // Add user message
      state.messages.push({
        role: 'user',
        content: ctx.query,
      });

      // Add assistant response
      if (result.content) {
        state.messages.push({
          role: 'assistant',
          content: result.content,
        });
      }

      // Trim history
      state.messages = trimHistory(state.messages, maxHistoryLength);

      await this.setState(state);

      if (debug) {
        logger.debug('[ChatAgent.saveToHistory]', {
          historyLength: state.messages.length,
        });
      }
    }

    /**
     * Handle execution error
     */
    private async handleError(ctx: ExecutionContext, error: unknown): Promise<void> {
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error('[ChatAgent] Execution error', {
        traceId: ctx.traceId,
        error: errorMessage,
      });

      // Save error to history
      const state = await this.getState();

      state.messages.push({
        role: 'user',
        content: ctx.query,
      });

      state.messages.push({
        role: 'assistant',
        content: `Error: ${errorMessage}`,
      });

      state.messages = trimHistory(state.messages, maxHistoryLength);
      await this.setState(state);

      // Note: In real implementation, would call transport.edit() to show error message
    }

    // =========================================================================
    // History Management
    // =========================================================================

    /**
     * Get current conversation history
     */
    getHistory(): Message[] {
      return this.getState()
        .then((state) => state.messages)
        .catch(() => []);
    }

    /**
     * Clear conversation history
     */
    async clearHistory(): Promise<void> {
      const state = await this.getState();
      state.messages = [];
      await this.setState(state);

      if (debug) {
        logger.info('[ChatAgent] History cleared');
      }
    }
  } as unknown as ChatAgentClass<TEnv>;
}

// =============================================================================
// Types
// =============================================================================

/**
 * Result from agent execution
 */
export interface AgentResult {
  /** Whether execution succeeded */
  success: boolean;
  /** Response content */
  content: string | undefined;
  /** Error message if failed */
  error: string | undefined;
  /** Execution duration in ms */
  durationMs: number;
  /** Debug information */
  debug?: {
    tools?: string[];
    metadata?: {
      fallback?: boolean;
      originalError?: string;
    };
  };
}
