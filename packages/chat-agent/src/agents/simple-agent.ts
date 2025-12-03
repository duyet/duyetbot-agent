/**
 * Simple Agent
 *
 * Handles simple queries that don't need tools or orchestration.
 * Provides direct LLM responses using conversation history from parent agent.
 *
 * This agent is STATELESS for conversation history - history is passed via
 * AgentContext.conversationHistory from the parent agent (CloudflareAgent).
 * This enables centralized state management where only the parent stores history.
 */

import { logger } from '@duyetbot/hono-middleware';
import { Agent, type Connection } from 'agents';
import type { ExecutionStep } from '../execution-state.js';
import type { PlatformEnv, ResponseTarget } from '../platform-response.js';
import {
  generateProgressMessage,
  sendPlatformResponse,
  sendProgressUpdate,
} from '../platform-response.js';
import type { ChatOptions, LLMProvider, Message } from '../types.js';
import { type AgentContext, AgentMixin, type AgentResult } from './base-agent.js';
import { agentRegistry } from './registry.js';

// =============================================================================
// Agent Self-Registration
// =============================================================================

/**
 * Register SimpleAgent with the agent registry.
 * This is the fallback agent for general queries that don't match other agents.
 * Priority is low (10) to ensure specialized agents are checked first.
 */
agentRegistry.register({
  name: 'simple-agent',
  description:
    'Handles simple questions that can be answered directly without tools. Used for greetings, explanations, general knowledge, help requests, and any query that does not require web search, code tools, or external APIs.',
  examples: [
    'hello',
    'hi there',
    'what is machine learning',
    'explain this code',
    'help',
    'what can you do',
    'thank you',
  ],
  triggers: {
    patterns: [
      /^(hi|hello|hey|good\s+(morning|afternoon|evening))[\s!.]*$/i,
      /^(help|\/help|\?|what can you do)[\s?]*$/i,
      /^(thanks?|thank you|thx)[\s!.]*$/i,
    ],
    categories: ['general'],
  },
  capabilities: {
    tools: [], // No tools - LLM only
    complexity: 'low',
  },
  priority: 10, // Lowest priority - fallback agent
});

/**
 * Simple agent state
 *
 * NOTE: This agent is intentionally stateless for conversation history.
 * Conversation history is passed via AgentContext.conversationHistory from the parent agent.
 * This enables centralized state management where only the parent (CloudflareAgent) stores history.
 */
export interface SimpleAgentState {
  /** Session identifier */
  sessionId: string;
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
  /** Number of queries executed (for analytics) */
  queriesExecuted: number;
  /** Current async execution (for alarm handler) */
  currentExecution?:
    | {
        /** Unique execution ID: simple:${platform}:${userId}:${messageId} */
        executionId: string;
        /** Original user query */
        query: string;
        /** Agent context for execution */
        context: AgentContext;
        /** Response target for platform response delivery */
        responseTarget: ResponseTarget;
        /** Progress message ID for editing (Telegram) */
        progressMessageId: number | undefined;
        /** Execution start timestamp */
        startTime: number;
        /** Current execution step */
        step: ExecutionStep;
      }
    | undefined;
}

/**
 * Environment bindings for simple agent
 * Extends PlatformEnv to access bot tokens for platform response delivery.
 * Note: Actual env fields depend on the provider (OpenRouterProviderEnv, etc.)
 * This interface is kept minimal - extend with provider-specific env in your app
 */
export interface SimpleAgentEnv extends PlatformEnv {}

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
  /** Function to create LLM provider from env and optional context */
  createProvider: (env: TEnv, context?: AgentContext) => LLMProvider;
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
 * Methods exposed by SimpleAgent
 */
export interface SimpleAgentMethods {
  execute(query: string, context: AgentContext): Promise<AgentResult>;
  getMessageCount(): number;
  clearHistory(): void;
  getHistory(): Message[];
}

/**
 * Type for SimpleAgent class
 */
export type SimpleAgentClass<TEnv extends SimpleAgentEnv> = typeof Agent<TEnv, SimpleAgentState> & {
  new (
    ...args: ConstructorParameters<typeof Agent<TEnv, SimpleAgentState>>
  ): Agent<TEnv, SimpleAgentState> & SimpleAgentMethods;
};

/**
 * Create a Simple Agent class
 *
 * @example
 * ```typescript
 * export const SimpleAgent = createSimpleAgent({
 *   createProvider: (env) => createAIGatewayProvider(env),
 *   systemPrompt: 'You are a helpful assistant.',
 * });
 * ```
 */
export function createSimpleAgent<TEnv extends SimpleAgentEnv>(
  config: SimpleAgentConfig<TEnv>
): SimpleAgentClass<TEnv> {
  const maxHistory = config.maxHistory ?? 20;
  const debug = config.debug ?? false;

  // Log system prompt at agent creation time
  logger.debug('[SimpleAgent] System prompt loaded', {
    promptLength: config.systemPrompt.length,
    promptPreview:
      config.systemPrompt.slice(0, 200) + (config.systemPrompt.length > 200 ? '...' : ''),
  });
  if (debug) {
    logger.debug(`[SimpleAgent] Full system prompt:\n${config.systemPrompt}`);
  }

  const AgentClass = class SimpleAgent extends Agent<TEnv, SimpleAgentState> {
    override initialState: SimpleAgentState = {
      sessionId: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      queriesExecuted: 0,
    };

    /**
     * Handle state updates
     */
    override onStateUpdate(state: SimpleAgentState, source: 'server' | Connection): void {
      if (debug) {
        logger.info('[SimpleAgent] State updated', {
          source,
          queriesExecuted: state.queriesExecuted,
        });
      }
    }

    /**
     * Execute a simple query
     *
     * Uses conversation history from context.conversationHistory (passed by parent agent)
     * instead of maintaining local state. This enables centralized state management.
     */
    async execute(query: string, context: AgentContext): Promise<AgentResult> {
      const startTime = Date.now();
      const traceId = context.traceId ?? AgentMixin.generateId('trace');

      // Use conversation history from context (passed by parent agent)
      const conversationHistory = context.conversationHistory ?? [];

      AgentMixin.log('SimpleAgent', 'Executing query', {
        traceId,
        queryLength: query.length,
        historyLength: conversationHistory.length,
      });

      try {
        // Get LLM provider (pass context for platformConfig credentials)
        const env = (this as unknown as { env: TEnv }).env;
        const provider = config.createProvider(env, context);

        // Build messages for LLM using history from context
        // Trim to maxHistory to prevent context overflow
        const trimmedHistory = AgentMixin.trimHistory(conversationHistory, maxHistory);
        const llmMessages = [
          { role: 'system' as const, content: config.systemPrompt },
          ...trimmedHistory.map((m) => ({
            role: m.role as 'user' | 'assistant' | 'system',
            content: m.content,
          })),
          { role: 'user' as const, content: query },
        ];

        // Build chat options with web search if enabled
        // Uses :online model suffix for reliable passthrough via AI Gateway
        let chatOptions: ChatOptions | undefined;
        if (config.webSearch) {
          const webConfig =
            typeof config.webSearch === 'boolean'
              ? { enabled: config.webSearch }
              : config.webSearch;

          if (webConfig.enabled) {
            chatOptions = { webSearch: true };

            if (debug) {
              logger.debug('[SimpleAgent] Web search enabled via :online suffix', {
                traceId,
              });
            }
          }
        }

        // Call LLM
        const response = await provider.chat(llmMessages, undefined, chatOptions);

        // Update state with query count (not messages - those are managed by parent)
        this.setState({
          ...this.state,
          sessionId: this.state.sessionId || context.chatId?.toString() || traceId,
          queriesExecuted: this.state.queriesExecuted + 1,
          updatedAt: Date.now(),
        });

        const durationMs = Date.now() - startTime;

        AgentMixin.log('SimpleAgent', 'Query complete', {
          traceId,
          durationMs,
          responseLength: response.content.length,
        });

        // Return result with new messages for parent to save
        return AgentMixin.createResult(true, response.content, durationMs, {
          data: {
            // Return new messages so parent can append to its state
            newMessages: [
              { role: 'user' as const, content: query },
              { role: 'assistant' as const, content: response.content },
            ],
          },
        });
      } catch (error) {
        const durationMs = Date.now() - startTime;
        AgentMixin.logError('SimpleAgent', 'Query failed', error, {
          traceId,
          durationMs,
        });
        return AgentMixin.createErrorResult(error, durationMs);
      }
    }

    /**
     * Start async execution with unique ID pattern: simple:${platform}:${userId}:${messageId}
     *
     * Uses Agent SDK's setState() for state management (not raw ctx.storage).
     * Follows DuyetInfoAgent pattern for alarm-based execution.
     *
     * @param query - User query to execute
     * @param context - Agent context with user/chat info
     * @param responseTarget - Platform-specific response target (built by caller)
     * @returns Unique execution ID
     */
    async startExecution(
      query: string,
      context: AgentContext,
      responseTarget: ResponseTarget
    ): Promise<string> {
      // Generate unique ID at message level: simple:platform:userId:messageId
      const platform = context.platform || 'api';
      const userId = context.userId || 'unknown';
      const messageId = responseTarget.messageRef?.messageId || Date.now();
      const executionId = `simple:${platform}:${userId}:${messageId}`;

      // Clear any stale execution before starting new one
      if (this.state.currentExecution) {
        logger.warn('[SimpleAgent] Clearing stale execution', {
          staleId: this.state.currentExecution.executionId,
          newId: executionId,
        });
      }

      const env = (this as unknown as { env: TEnv }).env;
      const startTime = Date.now();

      AgentMixin.log('SimpleAgent', 'Starting async execution', {
        executionId,
        platform,
        userId,
        queryLength: query.length,
        existingMessageId: responseTarget.messageRef?.messageId,
      });

      // Update existing progress message (created by CloudflareAgent)
      // instead of sending a new one - this enables rolling updates on a single message
      const progressText = generateProgressMessage('init', query, {
        mcpConnected: false,
        toolCount: 0,
        toolsExecuted: [],
        llmCalls: 0,
        startTime,
      });

      // Use existing message ID from responseTarget (set by CloudflareAgent)
      const progressMessageId = responseTarget.messageRef?.messageId;
      if (progressMessageId && progressMessageId > 0) {
        try {
          await sendProgressUpdate(env, responseTarget, progressText);
        } catch (err) {
          logger.warn('[SimpleAgent] Failed to update progress message', {
            error: err instanceof Error ? err.message : String(err),
            messageId: progressMessageId,
          });
        }
      }

      // Store execution state using setState (Agent SDK pattern)
      this.setState({
        ...this.state,
        currentExecution: {
          executionId,
          query,
          context,
          responseTarget,
          progressMessageId,
          startTime,
          step: 'init' as ExecutionStep,
        },
      });

      // Schedule alarm (100ms delay to allow state persistence)
      await this.schedule(100, 'onExecutionAlarm', { executionId });
      return executionId;
    }

    /**
     * Alarm handler for async execution
     *
     * Executes the LLM call and sends the final response to the platform.
     * Uses Agent SDK's setState() to clear execution state after completion.
     */
    async onExecutionAlarm(alarmData: { executionId: string }): Promise<void> {
      const execution = this.state.currentExecution;

      if (!execution || execution.executionId !== alarmData.executionId) {
        logger.warn('[SimpleAgent] Execution not found or ID mismatch', {
          executionId: alarmData.executionId,
          hasExecution: !!execution,
        });
        return;
      }

      const env = (this as unknown as { env: TEnv }).env;
      const { query, context, responseTarget, progressMessageId, startTime } = execution;

      try {
        // Update progress to llm_calling
        if (progressMessageId) {
          const progressText = generateProgressMessage('llm_calling', query, {
            mcpConnected: false,
            toolCount: 0,
            toolsExecuted: [],
            llmCalls: 1,
            startTime,
          });
          await sendProgressUpdate(
            env,
            { ...responseTarget, messageRef: { messageId: progressMessageId } },
            progressText
          );
        }

        // Execute the query
        const result = await this.execute(query, context);
        const finalResponse = result.content || 'No response generated.';

        // Send final response
        await sendPlatformResponse(env, responseTarget, finalResponse);

        AgentMixin.log('SimpleAgent', 'Async execution completed', {
          executionId: execution.executionId,
          durationMs: Date.now() - startTime,
        });

        // Clear execution state
        this.setState({
          ...this.state,
          currentExecution: undefined,
          queriesExecuted: this.state.queriesExecuted + 1,
          updatedAt: Date.now(),
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);

        AgentMixin.logError('SimpleAgent', 'Async execution failed', error, {
          executionId: execution.executionId,
        });

        await sendPlatformResponse(env, responseTarget, `Error: ${errorMsg}`);

        // Clear execution state on error
        this.setState({
          ...this.state,
          currentExecution: undefined,
          updatedAt: Date.now(),
        });
      }
    }

    /**
     * Get current message count
     * @deprecated This agent is stateless for messages. Returns 0.
     */
    getMessageCount(): number {
      return 0; // Stateless - history is in parent agent
    }

    /**
     * Clear conversation history
     * @deprecated This agent is stateless for messages. No-op.
     */
    clearHistory(): void {
      // No-op - history is managed by parent agent
      logger.info('[SimpleAgent] clearHistory called - no-op (stateless agent)');
    }

    /**
     * Get conversation history
     * @deprecated This agent is stateless for messages. Returns empty array.
     */
    getHistory(): Message[] {
      return []; // Stateless - history is in parent agent
    }
  };

  return AgentClass as SimpleAgentClass<TEnv>;
}

/**
 * Type for simple agent instance
 */
export type SimpleAgentInstance<TEnv extends SimpleAgentEnv> = InstanceType<
  ReturnType<typeof createSimpleAgent<TEnv>>
>;
