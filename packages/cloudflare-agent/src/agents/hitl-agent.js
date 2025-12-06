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
import { logger } from '@duyetbot/hono-middleware';
import { agentRegistry } from './registry.js';

// =============================================================================
// Agent Self-Registration
// =============================================================================
/**
 * Register HITLAgent with the agent registry.
 * Handles operations requiring human approval (destructive actions, sensitive commands).
 * Priority is highest (100) - always check first for confirmation responses.
 */
agentRegistry.register({
  name: 'hitl-agent',
  description:
    'Handles operations requiring human approval such as destructive actions, sensitive commands, and tool execution confirmations. Also processes user confirmation responses (yes/no/approve/reject).',
  examples: [
    'yes',
    'no',
    'approve',
    'reject',
    'confirm',
    'cancel',
    'delete this file',
    'merge this PR',
    'reset the database',
  ],
  triggers: {
    patterns: [
      // Confirmation responses - these must be checked first
      /^(yes|no|y|n|approve|reject|confirm|cancel)[\s!.]*$/i,
      /^(approve|reject)\s+(all|#?\d+)/i,
      // Destructive action requests
      /\b(delete|remove|drop|reset|destroy)\s+(this|the|all)\b/i,
      /\bforce\s+(push|merge|delete)\b/i,
    ],
    keywords: ['approve', 'reject', 'confirm', 'cancel'],
    categories: ['admin', 'destructive', 'confirmation'],
  },
  capabilities: {
    tools: ['bash', 'git', 'file_operations'],
    complexity: 'medium',
    requiresApproval: true,
  },
  priority: 100, // Highest priority - always check first for confirmations
});

import { BaseAgent } from '../base/base-agent.js';
import {
  createErrorResult as createErrorResultFn,
  createSuccessResult as createSuccessResultFn,
} from '../base/index.js';
import {
  createToolConfirmation,
  formatMultipleConfirmations,
  hasToolConfirmation,
  parseConfirmationResponse,
  requiresConfirmation,
} from '../hitl/confirmation.js';
import { executeApprovedTools, formatExecutionResults } from '../hitl/executions.js';
import {
  createInitialHITLState,
  getApprovedConfirmations,
  getExpiredConfirmationIds,
  getPendingConfirmations,
  hasExpiredConfirmations,
  isAwaitingConfirmation,
  transitionHITLState,
} from '../hitl/state-machine.js';

/**
 * Convert unknown error to Error | string type for error handling
 *
 * @param error - Unknown error from catch block
 * @returns Error if Error instance, otherwise string representation
 */
function normalizeError(error) {
  if (error instanceof Error) {
    return error;
  }
  return String(error);
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
export function createHITLAgent(config) {
  const maxHistory = config.maxHistory ?? 20;
  const confirmationThreshold = config.confirmationThreshold ?? 'high';
  const debug = config.debug ?? false;
  const AgentClass = class HITLAgent extends BaseAgent {
    initialState = {
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...createInitialHITLState(''),
      sessionId: '',
      pendingToolCalls: [],
    };
    /**
     * Handle state updates
     */
    onStateUpdate(state) {
      if (debug) {
        logger.info('[HITLAgent] State updated', {
          status: state.status,
          pendingConfirmations: state.pendingConfirmations.length,
        });
      }
    }
    /**
     * Main entry point - handle execution context
     *
     * Checks for:
     * 1. Expired confirmations (clean them up)
     * 2. Confirmation responses (user approved/rejected)
     * 3. Pending confirmations (ask user again if waiting)
     * 4. New queries (process through LLM)
     *
     * @param ctx - ExecutionContext containing user query and conversation history
     * @returns AgentResult with next action indicator
     */
    async handle(ctx) {
      const startTime = Date.now();
      logger.debug('[HITLAgent] Handling execution', {
        spanId: ctx.spanId,
        queryLength: ctx.query.length,
        currentStatus: this.state.status,
      });
      try {
        // Check for expired confirmations first
        if (hasExpiredConfirmations(this.state)) {
          this.handleExpiredConfirmations();
        }
        // Check if this is a confirmation response
        if (hasToolConfirmation(ctx.query) && isAwaitingConfirmation(this.state)) {
          return await this.processConfirmation(ctx, ctx.query);
        }
        // Check if we're waiting for confirmation
        if (isAwaitingConfirmation(this.state)) {
          const pending = getPendingConfirmations(this.state);
          return createSuccessResultFn(
            formatMultipleConfirmations(pending),
            Date.now() - startTime,
            { nextAction: 'await_confirmation' }
          );
        }
        // Process new query through LLM
        return await this.processQuery(ctx, startTime);
      } catch (error) {
        const durationMs = Date.now() - startTime;
        const normalizedError = normalizeError(error);
        logger.error('[HITLAgent] Handle failed', {
          spanId: ctx.spanId,
          durationMs,
          error: normalizedError instanceof Error ? normalizedError.message : normalizedError,
        });
        return createErrorResultFn(normalizedError, durationMs);
      }
    }
    /**
     * Process a new query through the LLM
     *
     * Uses conversation history from ctx.conversationHistory (passed by parent agent).
     * Sets provider via setProvider() before calling LLM.
     * Leverages BaseAgent.chat() for provider communication.
     *
     * @param ctx - ExecutionContext with query and conversation history
     * @param startTime - Start time for duration calculation
     * @returns AgentResult with confirmation request or final response
     */
    async processQuery(ctx, startTime) {
      const env = this.env;
      try {
        // Create and set provider for this execution
        const provider = config.createProvider(env);
        this.setProvider(provider);
        // Use conversation history from context (passed by parent agent)
        const conversationHistory = ctx.conversationHistory ?? [];
        // Trim history to max length and add current query
        const trimmedHistory = conversationHistory.slice(
          Math.max(0, conversationHistory.length - maxHistory)
        );
        const userMessage = { role: 'user', content: ctx.query };
        const updatedMessages = [...trimmedHistory, userMessage];
        // Build messages for LLM
        const llmMessages = [{ role: 'system', content: config.systemPrompt }, ...updatedMessages];
        // Call LLM using BaseAgent.chat()
        const response = await this.chat(ctx, llmMessages);
        // Check if response contains tool calls that need confirmation
        const toolCalls = this.extractToolCalls(response.content);
        if (toolCalls.length > 0) {
          // Check which tools need confirmation
          const needsConfirmation = toolCalls.filter((tc) =>
            requiresConfirmation(tc.toolName, tc.toolArgs, confirmationThreshold)
          );
          if (needsConfirmation.length > 0) {
            // Create confirmations and transition state
            return this.requestConfirmations(ctx, needsConfirmation, updatedMessages);
          }
        }
        // No confirmation needed - normal response
        const assistantMessage = {
          role: 'assistant',
          content: response.content,
        };
        const newMessages = [userMessage, assistantMessage];
        this.setState({
          ...this.state,
          sessionId: this.state.sessionId || ctx.chatId?.toString() || ctx.traceId,
          updatedAt: Date.now(),
        });
        logger.debug('[HITLAgent] Query processed without confirmation needed', {
          spanId: ctx.spanId,
          responseLength: response.content.length,
        });
        // Return result with new messages for parent to save
        return createSuccessResultFn(response.content, Date.now() - startTime, {
          data: {
            newMessages,
          },
          nextAction: 'complete',
        });
      } catch (error) {
        const normalizedError = normalizeError(error);
        logger.error('[HITLAgent] processQuery failed', {
          spanId: ctx.spanId,
          error: normalizedError instanceof Error ? normalizedError.message : normalizedError,
        });
        return createErrorResultFn(normalizedError, Date.now() - startTime);
      }
    }
    /**
     * Extract tool calls from LLM response
     * This is a simplified implementation - in practice, you'd parse
     * the response format used by your LLM provider
     */
    extractToolCalls(content) {
      const toolCalls = [];
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
     *
     * Creates confirmation prompts and transitions state machine.
     * Sends confirmation message to user via BaseAgent.respond().
     *
     * @param ctx - ExecutionContext for message sending
     * @param toolCalls - Tool calls requiring confirmation
     * @param messages - Conversation messages to include in result
     * @returns AgentResult with nextAction: 'await_confirmation'
     */
    async requestConfirmations(ctx, toolCalls, messages) {
      const startTime = Date.now();
      // Create confirmation requests
      const confirmations = toolCalls.map((tc) =>
        createToolConfirmation(tc.toolName, tc.toolArgs, tc.description)
      );
      // Update state with pending confirmations
      let baseState = this.state;
      for (const confirmation of confirmations) {
        baseState = transitionHITLState(baseState, {
          type: 'REQUEST_CONFIRMATION',
          confirmation,
        });
      }
      this.setState({
        ...this.state,
        ...baseState,
        sessionId: this.state.sessionId || ctx.traceId,
        pendingToolCalls: toolCalls,
        updatedAt: Date.now(),
      });
      logger.debug('[HITLAgent] Requesting confirmations', {
        spanId: ctx.spanId,
        count: confirmations.length,
        tools: confirmations.map((c) => c.toolName),
      });
      const response = formatMultipleConfirmations(confirmations);
      // Send confirmation message to user via BaseAgent.respond()
      await this.respond(ctx, response);
      // Extract messages to return for parent to save
      const newMessages = messages.slice(-2);
      return createSuccessResultFn(response, Date.now() - startTime, {
        data: {
          newMessages,
        },
        nextAction: 'await_confirmation',
      });
    }
    /**
     * Process user confirmation response
     *
     * Parses user's approval/rejection response and transitions state.
     * Executes approved tools or returns cancellation message.
     * Uses BaseAgent.updateThinking() to show status.
     *
     * @param ctx - ExecutionContext for status updates
     * @param response - User's confirmation response
     * @returns AgentResult indicating next action
     */
    async processConfirmation(ctx, response) {
      const startTime = Date.now();
      const parseResult = parseConfirmationResponse(response);
      if (!parseResult.isConfirmation) {
        // Not a valid confirmation - ask again
        const pending = getPendingConfirmations(this.state);
        const message = `I didn't understand that. ${formatMultipleConfirmations(pending)}`;
        await this.respond(ctx, message);
        return createSuccessResultFn(message, Date.now() - startTime, {
          nextAction: 'await_confirmation',
        });
      }
      logger.debug('[HITLAgent] Processing confirmation', {
        spanId: ctx.spanId,
        action: parseResult.action,
        targetId: parseResult.targetConfirmationId,
      });
      const pending = getPendingConfirmations(this.state);
      if (parseResult.action === 'approve') {
        // Approve all pending or specific one
        let baseState = this.state;
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
          updatedAt: Date.now(),
        });
        // Execute approved tools
        return await this.executeApproved(ctx, startTime);
      }
      if (parseResult.action === 'reject') {
        // Reject all pending or specific one
        let baseState = this.state;
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
          updatedAt: Date.now(),
        });
        const message = '❌ Tool execution cancelled.';
        await this.respond(ctx, message);
        return createSuccessResultFn(message, Date.now() - startTime, {
          nextAction: 'complete',
        });
      }
      // Shouldn't reach here - log as warning
      const pending2 = getPendingConfirmations(this.state);
      const message = formatMultipleConfirmations(pending2);
      await this.respond(ctx, message);
      return createSuccessResultFn(message, Date.now() - startTime, {
        nextAction: 'await_confirmation',
      });
    }
    /**
     * Execute approved tools
     *
     * Runs all approved tool confirmations and tracks execution results.
     * Updates thinking status via BaseAgent.updateThinking().
     *
     * @param ctx - ExecutionContext for status updates
     * @param startTime - Start time for duration calculation
     * @returns AgentResult with execution results
     */
    async executeApproved(ctx, startTime) {
      const approved = getApprovedConfirmations(this.state);
      if (approved.length === 0) {
        const message = 'No tools to execute.';
        await this.respond(ctx, message);
        return createSuccessResultFn(message, Date.now() - startTime, {
          nextAction: 'complete',
        });
      }
      // Get executor
      const executor =
        config.toolExecutor ??
        (async (toolName, _args) => {
          return {
            success: false,
            error: `No executor configured for ${toolName}`,
          };
        });
      logger.debug('[HITLAgent] Executing approved tools', {
        spanId: ctx.spanId,
        count: approved.length,
        tools: approved.map((c) => c.toolName),
      });
      // Show status to user
      await this.updateThinking(ctx, `Executing ${approved.length} tool(s)`);
      // Execute tools
      const result = await executeApprovedTools(approved, executor, {}, (entry, index, total) => {
        logger.debug('[HITLAgent] Tool execution progress', {
          spanId: ctx.spanId,
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
          updatedAt: Date.now(),
        });
      });
      // Clear pending tool calls
      this.setState({
        ...this.state,
        pendingToolCalls: [],
        updatedAt: Date.now(),
      });
      const responseText = formatExecutionResults(result);
      await this.respond(ctx, responseText);
      return createSuccessResultFn(responseText, Date.now() - startTime, {
        data: result,
        nextAction: 'complete',
      });
    }
    /**
     * Handle expired confirmations
     *
     * Removes confirmations that exceeded their timeout window.
     */
    handleExpiredConfirmations() {
      const expiredIds = getExpiredConfirmationIds(this.state);
      let baseState = this.state;
      for (const id of expiredIds) {
        baseState = transitionHITLState(baseState, {
          type: 'CONFIRMATION_EXPIRED',
          confirmationId: id,
        });
      }
      this.setState({
        ...this.state,
        ...baseState,
        updatedAt: Date.now(),
      });
      logger.debug('[HITLAgent] Expired confirmations handled', {
        count: expiredIds.length,
      });
    }
    /**
     * Get number of pending confirmations
     *
     * @returns Count of confirmations awaiting user action
     */
    getPendingCount() {
      return getPendingConfirmations(this.state).length;
    }
    /**
     * Get current agent status
     *
     * @returns Current status (e.g., 'idle', 'awaiting_confirmation')
     */
    getStatus() {
      return this.state.status;
    }
    /**
     * Clear conversation history
     *
     * No-op since this agent is stateless for messages.
     * Conversation history is managed by the parent CloudflareAgent.
     *
     * @deprecated Use parent agent's history management instead
     */
    clearHistory() {
      // No-op - history is managed by parent agent
      logger.info('[HITLAgent] clearHistory called - no-op (stateless agent)');
    }
  };
  return AgentClass;
}
