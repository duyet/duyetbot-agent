/**
 * HITL Agent (Human-in-the-Loop)
 *
 * Manages tool confirmation workflows for sensitive operations.
 * Extends the standard agent pattern to intercept tool calls,
 * request user confirmation, and execute approved tools.
 *
 * Based on Cloudflare's HITL pattern:
 * https://developers.cloudflare.com/agents/patterns/human-in-the-loop/
 */

import { logger } from '@duyetbot/hono-middleware';
import { Agent, type Connection } from 'agents';
import {
  type RiskLevel,
  createToolConfirmation,
  formatMultipleConfirmations,
  hasToolConfirmation,
  parseConfirmationResponse,
  requiresConfirmation,
} from '../hitl/confirmation.js';
import {
  type ToolExecutor,
  executeApprovedTools,
  formatExecutionResults,
} from '../hitl/executions.js';
import {
  type HITLState,
  createInitialHITLState,
  getApprovedConfirmations,
  getExpiredConfirmationIds,
  getPendingConfirmations,
  hasExpiredConfirmations,
  isAwaitingConfirmation,
  transitionHITLState,
} from '../hitl/state-machine.js';
import type { ToolConfirmation } from '../routing/schemas.js';
import type { LLMProvider, Message } from '../types.js';
import { type AgentContext, AgentMixin, type AgentResult } from './base-agent.js';

/**
 * HITL Agent state (extends HITLState with conversation messages)
 */
export interface HITLAgentState extends HITLState {
  /** Conversation messages */
  messages: Message[];
  /** LLM-generated tool calls awaiting confirmation */
  pendingToolCalls: Array<{
    toolName: string;
    toolArgs: Record<string, unknown>;
    description: string;
  }>;
}

/**
 * Environment bindings for HITL agent
 */
export interface HITLAgentEnv {
  AI_GATEWAY_ACCOUNT_ID?: string;
  AI_GATEWAY_ID?: string;
  ANTHROPIC_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
}

/**
 * Configuration for HITL agent
 */
export interface HITLAgentConfig<TEnv extends HITLAgentEnv> {
  /** Function to create LLM provider from env */
  createProvider: (env: TEnv) => LLMProvider;
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
  handle(query: string, context: AgentContext): Promise<AgentResult>;
  processConfirmation(response: string): Promise<AgentResult>;
  getPendingCount(): number;
  getStatus(): string;
  clearHistory(): void;
}

/**
 * Type for HITLAgent class
 */
export type HITLAgentClass<TEnv extends HITLAgentEnv> = typeof Agent<TEnv, HITLAgentState> & {
  new (
    ...args: ConstructorParameters<typeof Agent<TEnv, HITLAgentState>>
  ): Agent<TEnv, HITLAgentState> & HITLAgentMethods;
};

/**
 * Tool call extracted from LLM response
 */
interface ExtractedToolCall {
  toolName: string;
  toolArgs: Record<string, unknown>;
  description: string;
}

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
export function createHITLAgent<TEnv extends HITLAgentEnv>(
  config: HITLAgentConfig<TEnv>
): HITLAgentClass<TEnv> {
  const maxHistory = config.maxHistory ?? 20;
  const confirmationThreshold = config.confirmationThreshold ?? 'high';
  const debug = config.debug ?? false;

  const AgentClass = class HITLAgent extends Agent<TEnv, HITLAgentState> {
    override initialState: HITLAgentState = {
      ...createInitialHITLState(''),
      messages: [],
      pendingToolCalls: [],
    };

    /**
     * Handle state updates
     */
    override onStateUpdate(state: HITLAgentState, source: 'server' | Connection): void {
      if (debug) {
        logger.info('[HITLAgent] State updated', {
          source,
          status: state.status,
          pendingConfirmations: state.pendingConfirmations.length,
          messageCount: state.messages.length,
        });
      }
    }

    /**
     * Main entry point - handle incoming query
     */
    async handle(query: string, context: AgentContext): Promise<AgentResult> {
      const startTime = Date.now();
      const traceId = context.traceId ?? AgentMixin.generateId('trace');

      AgentMixin.log('HITLAgent', 'Handling query', {
        traceId,
        queryLength: query.length,
        currentStatus: this.state.status,
      });

      try {
        // Check for expired confirmations first
        if (hasExpiredConfirmations(this.state)) {
          this.handleExpiredConfirmations();
        }

        // Check if this is a confirmation response
        if (hasToolConfirmation(query) && isAwaitingConfirmation(this.state)) {
          return this.processConfirmation(query);
        }

        // Check if we're waiting for confirmation
        if (isAwaitingConfirmation(this.state)) {
          const pending = getPendingConfirmations(this.state);
          return AgentMixin.createResult(
            true,
            formatMultipleConfirmations(pending),
            Date.now() - startTime,
            { nextAction: 'await_confirmation' }
          );
        }

        // Process new query through LLM
        return this.processQuery(query, context, traceId);
      } catch (error) {
        const durationMs = Date.now() - startTime;
        AgentMixin.logError('HITLAgent', 'Handle failed', error, {
          traceId,
          durationMs,
        });
        return AgentMixin.createErrorResult(error, durationMs);
      }
    }

    /**
     * Process a new query through the LLM
     */
    private async processQuery(
      query: string,
      context: AgentContext,
      traceId: string
    ): Promise<AgentResult> {
      const startTime = Date.now();
      const env = (this as unknown as { env: TEnv }).env;

      try {
        const provider = config.createProvider(env);

        // Add user message
        const userMessage: Message = { role: 'user', content: query };
        const updatedMessages = [...this.state.messages, userMessage];

        // Build messages for LLM
        const llmMessages = [
          { role: 'system' as const, content: config.systemPrompt },
          ...updatedMessages.map((m) => ({
            role: m.role as 'user' | 'assistant' | 'system',
            content: m.content,
          })),
        ];

        // Call LLM
        const response = await provider.chat(llmMessages);

        // Check if response contains tool calls that need confirmation
        const toolCalls = this.extractToolCalls(response.content);

        if (toolCalls.length > 0) {
          // Check which tools need confirmation
          const needsConfirmation = toolCalls.filter((tc) =>
            requiresConfirmation(tc.toolName, tc.toolArgs, confirmationThreshold)
          );

          if (needsConfirmation.length > 0) {
            // Create confirmations and transition state
            return this.requestConfirmations(needsConfirmation, traceId, updatedMessages);
          }
        }

        // No confirmation needed - normal response
        const assistantMessage: Message = {
          role: 'assistant',
          content: response.content,
        };

        const newMessages = AgentMixin.trimHistory(
          [...updatedMessages, assistantMessage],
          maxHistory
        );

        this.setState({
          ...this.state,
          sessionId: this.state.sessionId || context.chatId?.toString() || traceId,
          messages: newMessages,
          lastActivityAt: Date.now(),
        });

        return AgentMixin.createResult(true, response.content, Date.now() - startTime, {
          nextAction: 'complete',
        });
      } catch (error) {
        return AgentMixin.createErrorResult(error, Date.now() - startTime);
      }
    }

    /**
     * Extract tool calls from LLM response
     * This is a simplified implementation - in practice, you'd parse
     * the response format used by your LLM provider
     */
    private extractToolCalls(content: string): ExtractedToolCall[] {
      const toolCalls: ExtractedToolCall[] = [];

      // Look for tool call patterns like:
      // <tool_call name="bash">{"command": "rm -rf /"}</tool_call>
      const toolCallPattern = /<tool_call\s+name="([^"]+)"[^>]*>([^<]*)<\/tool_call>/gi;
      const toolCallMatches = content.matchAll(toolCallPattern);

      for (const match of toolCallMatches) {
        try {
          const toolName = match[1];
          const argsJson = match[2]?.trim();
          if (!toolName) {
            continue;
          }
          const toolArgs = argsJson ? JSON.parse(argsJson) : {};

          toolCalls.push({
            toolName,
            toolArgs,
            description: `Execute ${toolName} with provided arguments`,
          });
        } catch {
          // Skip invalid tool calls
        }
      }

      // Also check for function call format
      // {"function": "bash", "arguments": {"command": "ls"}}
      const functionCallPattern =
        /\{[^{}]*"function"\s*:\s*"([^"]+)"[^{}]*"arguments"\s*:\s*(\{[^{}]*\})[^{}]*\}/gi;
      const functionCallMatches = content.matchAll(functionCallPattern);

      for (const match of functionCallMatches) {
        try {
          const toolName = match[1];
          const argsStr = match[2];
          if (!toolName || !argsStr) {
            continue;
          }
          const toolArgs = JSON.parse(argsStr);

          toolCalls.push({
            toolName,
            toolArgs,
            description: `Execute ${toolName} with provided arguments`,
          });
        } catch {
          // Skip invalid function calls
        }
      }

      return toolCalls;
    }

    /**
     * Request confirmations for tool calls
     */
    private requestConfirmations(
      toolCalls: ExtractedToolCall[],
      traceId: string,
      messages: Message[]
    ): AgentResult {
      const startTime = Date.now();

      // Create confirmation requests
      const confirmations: ToolConfirmation[] = toolCalls.map((tc) =>
        createToolConfirmation(tc.toolName, tc.toolArgs, tc.description)
      );

      // Update state with pending confirmations
      let baseState: HITLState = this.state;
      for (const confirmation of confirmations) {
        baseState = transitionHITLState(baseState, {
          type: 'REQUEST_CONFIRMATION',
          confirmation,
        });
      }

      this.setState({
        ...this.state,
        ...baseState,
        sessionId: this.state.sessionId || traceId,
        messages,
        pendingToolCalls: toolCalls,
      });

      AgentMixin.log('HITLAgent', 'Requesting confirmations', {
        traceId,
        count: confirmations.length,
        tools: confirmations.map((c) => c.toolName),
      });

      const response = formatMultipleConfirmations(confirmations);

      return AgentMixin.createResult(true, response, Date.now() - startTime, {
        nextAction: 'await_confirmation',
      });
    }

    /**
     * Process user confirmation response
     */
    async processConfirmation(response: string): Promise<AgentResult> {
      const startTime = Date.now();

      const parseResult = parseConfirmationResponse(response);

      if (!parseResult.isConfirmation) {
        // Not a valid confirmation - ask again
        const pending = getPendingConfirmations(this.state);
        return AgentMixin.createResult(
          true,
          `I didn't understand that. ${formatMultipleConfirmations(pending)}`,
          Date.now() - startTime,
          { nextAction: 'await_confirmation' }
        );
      }

      AgentMixin.log('HITLAgent', 'Processing confirmation', {
        action: parseResult.action,
        targetId: parseResult.targetConfirmationId,
      });

      const pending = getPendingConfirmations(this.state);

      if (parseResult.action === 'approve') {
        // Approve all pending or specific one
        let baseState: HITLState = this.state;
        const toApprove = parseResult.targetConfirmationId
          ? pending.filter((c) => c.id === parseResult.targetConfirmationId)
          : pending;

        for (const confirmation of toApprove) {
          baseState = transitionHITLState(baseState, {
            type: 'USER_APPROVED',
            confirmationId: confirmation.id,
          });
        }

        this.setState({
          ...this.state,
          ...baseState,
        });

        // Execute approved tools
        return this.executeApproved();
      }
      if (parseResult.action === 'reject') {
        // Reject all pending or specific one
        let baseState: HITLState = this.state;
        const toReject = parseResult.targetConfirmationId
          ? pending.filter((c) => c.id === parseResult.targetConfirmationId)
          : pending;

        for (const confirmation of toReject) {
          baseState = transitionHITLState(baseState, {
            type: 'USER_REJECTED',
            confirmationId: confirmation.id,
            ...(parseResult.reason ? { reason: parseResult.reason } : {}),
          });
        }

        this.setState({
          ...this.state,
          ...baseState,
          pendingToolCalls: [],
        });

        return AgentMixin.createResult(
          true,
          '❌ Tool execution cancelled.',
          Date.now() - startTime,
          { nextAction: 'complete' }
        );
      }

      // Shouldn't reach here
      return AgentMixin.createResult(
        true,
        formatMultipleConfirmations(pending),
        Date.now() - startTime,
        { nextAction: 'await_confirmation' }
      );
    }

    /**
     * Execute approved tools
     */
    private async executeApproved(): Promise<AgentResult> {
      const startTime = Date.now();
      const approved = getApprovedConfirmations(this.state);

      if (approved.length === 0) {
        return AgentMixin.createResult(true, 'No tools to execute.', Date.now() - startTime, {
          nextAction: 'complete',
        });
      }

      // Get executor
      const executor =
        config.toolExecutor ??
        (async (toolName: string, _args: Record<string, unknown>) => {
          return {
            success: false,
            error: `No executor configured for ${toolName}`,
          };
        });

      AgentMixin.log('HITLAgent', 'Executing approved tools', {
        count: approved.length,
        tools: approved.map((c) => c.toolName),
      });

      // Execute tools
      const result = await executeApprovedTools(approved, executor, {}, (entry, index, total) => {
        AgentMixin.log('HITLAgent', 'Tool execution progress', {
          toolName: entry.toolName,
          success: entry.success,
          index: index + 1,
          total,
        });

        // Update state with execution result
        const baseState = transitionHITLState(this.state, {
          type: 'EXECUTION_COMPLETED',
          entry,
        });

        this.setState({
          ...this.state,
          ...baseState,
        });
      });

      // Clear pending tool calls
      this.setState({
        ...this.state,
        pendingToolCalls: [],
      });

      const responseText = formatExecutionResults(result);

      return AgentMixin.createResult(true, responseText, Date.now() - startTime, {
        data: result,
        nextAction: 'complete',
      });
    }

    /**
     * Handle expired confirmations
     */
    private handleExpiredConfirmations(): void {
      const expiredIds = getExpiredConfirmationIds(this.state);

      let baseState: HITLState = this.state;
      for (const id of expiredIds) {
        baseState = transitionHITLState(baseState, {
          type: 'CONFIRMATION_EXPIRED',
          confirmationId: id,
        });
      }

      this.setState({
        ...this.state,
        ...baseState,
      });

      AgentMixin.log('HITLAgent', 'Expired confirmations handled', {
        count: expiredIds.length,
      });
    }

    /**
     * Get number of pending confirmations
     */
    getPendingCount(): number {
      return getPendingConfirmations(this.state).length;
    }

    /**
     * Get current status
     */
    getStatus(): string {
      return this.state.status;
    }

    /**
     * Clear conversation history
     */
    clearHistory(): void {
      this.setState({
        ...createInitialHITLState(this.state.sessionId),
        messages: [],
        pendingToolCalls: [],
      });
    }
  };

  return AgentClass as HITLAgentClass<TEnv>;
}

/**
 * Type for HITL agent instance
 */
export type HITLAgentInstance<TEnv extends HITLAgentEnv> = InstanceType<
  ReturnType<typeof createHITLAgent<TEnv>>
>;
