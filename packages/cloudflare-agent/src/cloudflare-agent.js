/**
 * Cloudflare Durable Object Agent with direct LLM integration
 *
 * DEPRECATED: This module is part of the legacy architecture and should not be used for new implementations.
 * Use the new agent architecture (src/agents/chat-agent.ts) and execution context (src/execution/) instead.
 *
 * Legacy implementation kept for backward compatibility and gradual migration.
 * - Simplified design: No ChatAgent wrapper, calls LLM directly in chat().
 * - State persistence via Durable Object storage.
 *
 * MCPServerConnection is still exported for use by duyet-info-agent and mcp-worker, but will be
 * refactored into a dedicated module in a future phase.
 */
import { logger } from '@duyetbot/hono-middleware';
import {
  ChatMessageStorage,
  debugContextToAgentSteps,
  ObservabilityStorage,
} from '@duyetbot/observability';
import { Agent, getAgentByName } from 'agents';
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  calculateRetryDelay,
  combineBatchMessages,
  createInitialBatchState,
  DEFAULT_RETRY_CONFIG,
  isBatchStuckByHeartbeat,
  isDuplicateInBothBatches,
} from './batch-types.js';
import {
  createThinkingRotator,
  formatWithEmbeddedHistory,
  getDefaultThinkingMessages,
} from './format.js';
import { trimHistory } from './history.js';
import { StepProgressTracker } from './step-progress.js';
/**
 * Create a Cloudflare Durable Object Agent class with direct LLM integration
 *
 * @example
 * ```typescript
 * import { createCloudflareChatAgent } from '@duyetbot/cloudflare-agent';
 *
 * export const TelegramAgent = createCloudflareChatAgent({
 *   createProvider: (env) => createAIGatewayProvider(env),
 *   systemPrompt: 'You are a helpful assistant.',
 *   welcomeMessage: 'Hello!',
 *   helpMessage: 'Commands: /start, /help, /clear',
 * });
 * ```
 */
export function createCloudflareChatAgent(config) {
  const maxHistory = config.maxHistory ?? 100;
  const maxToolIterations = config.maxToolIterations ?? 5;
  const maxTools = config.maxTools; // undefined = unlimited
  const transport = config.transport;
  const hooks = config.hooks;
  const mcpServers = config.mcpServers ?? [];
  const builtinTools = config.tools ?? [];
  const routerConfig = config.router;
  const extractPlatformConfig = config.extractPlatformConfig;
  const retryConfig = config.retryConfig ?? DEFAULT_RETRY_CONFIG;
  // Batch config for future use (alarm scheduling, etc.)
  // const batchConfig: BatchConfig = {
  //   ...DEFAULT_BATCH_CONFIG,
  //   ...config.batchConfig,
  // };
  // Convert built-in tools to OpenAI format
  const builtinToolsOpenAI = builtinTools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: zodToJsonSchema(tool.inputSchema),
    },
  }));
  // Create a map for quick lookup of built-in tools by name
  const builtinToolMap = new Map(builtinTools.map((tool) => [tool.name, tool]));
  // The class has all the methods defined in CloudflareChatAgentMethods
  // Type assertion is needed because TypeScript can't infer the additional methods
  // on the class type from the instance methods alone
  const AgentClass = class CloudflareChatAgent extends Agent {
    initialState = {
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    _mcpInitialized = false;
    _processing = false;
    _batchStartTime = 0; // Track batch start time for duration calculation
    _lastResponse; // Capture response for observability
    _lastDebugContext; // Capture debug context for observability
    // ============================================
    // State DO Reporting (Fire-and-Forget)
    // ============================================
    /**
     * Interface for State DO stub methods (RPC calls via Durable Object binding)
     */
    getStateDOStub() {
      const env = this.env;
      const envWithState = env;
      if (!envWithState.StateDO) {
        return null;
      }
      // Use a single global instance for State DO
      const id = envWithState.StateDO.idFromName('global');
      return envWithState.StateDO.get(id);
    }
    /**
     * Report to State DO (fire-and-forget pattern)
     * Does not block on errors - State DO reporting is non-critical
     */
    reportToStateDO(method, params) {
      try {
        const stateDO = this.getStateDOStub();
        if (!stateDO) {
          return;
        }
        // Fire-and-forget: don't await, catch any errors
        void (async () => {
          try {
            if (method === 'registerBatch') {
              await stateDO.registerBatch(params);
            } else if (method === 'heartbeat') {
              await stateDO.heartbeat(params);
            } else if (method === 'completeBatch') {
              await stateDO.completeBatch(params);
            }
          } catch (err) {
            logger.warn(`[CloudflareAgent][StateDO] ${method} failed`, {
              error: err instanceof Error ? err.message : String(err),
            });
          }
        })();
      } catch (err) {
        logger.warn('[CloudflareAgent][StateDO] Report failed', {
          method,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    /**
     * Get platform type from router config
     */
    getPlatform() {
      return routerConfig?.platform || 'api';
    }
    /**
     * Upsert observability event on any lifecycle change (fire-and-forget).
     *
     * Uses SQLite UPSERT for atomic insert-or-update. Called at multiple lifecycle points:
     * - receiveMessage: Mark as 'processing' when agent receives message
     * - handle: Update status during execution
     * - batch completion: Final update with status, response, agents, tokens
     *
     * @param eventId - Full UUID for D1 correlation
     * @param data - Partial event data to upsert
     */
    upsertObservability(eventId, data) {
      const env = this.env;
      if (!env.OBSERVABILITY_DB) {
        return;
      }
      const storage = new ObservabilityStorage(env.OBSERVABILITY_DB);
      void (async () => {
        try {
          await storage.upsertEvent({
            eventId,
            ...data,
          });
          logger.debug('[CloudflareAgent][OBSERVABILITY] Event upserted', {
            eventId,
            status: data.status,
          });
        } catch (err) {
          logger.warn('[CloudflareAgent][OBSERVABILITY] Upsert failed', {
            eventId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      })();
    }
    /**
     * Legacy method for batch updates - calls upsertObservability for each eventId.
     * @deprecated Use upsertObservability directly for new code
     */
    updateObservability(eventIds, completion) {
      const completedAt = Date.now();
      for (const eventId of eventIds) {
        this.upsertObservability(eventId, {
          status: completion.status,
          completedAt,
          durationMs: completion.durationMs,
          ...(completion.responseText !== undefined && { responseText: completion.responseText }),
          ...(completion.errorMessage !== undefined && { errorMessage: completion.errorMessage }),
        });
      }
    }
    /**
     * Persist current messages to D1 for cross-session history.
     * Uses fire-and-forget pattern to avoid blocking main flow.
     *
     * @param eventId - Optional event ID for correlation
     */
    persistMessages(eventId) {
      const env = this.env;
      if (!env.OBSERVABILITY_DB) {
        return;
      }
      // Build session ID from state (platform:userId:chatId)
      const platform = routerConfig?.platform ?? 'api';
      const userId = this.state.userId?.toString() ?? 'unknown';
      const chatId = this.state.chatId?.toString() ?? 'unknown';
      const sessionId = `${platform}:${userId}:${chatId}`;
      const messages = this.state.messages;
      if (messages.length === 0) {
        return;
      }
      // Fire-and-forget: persist messages to D1
      void (async () => {
        try {
          const storage = new ChatMessageStorage(env.OBSERVABILITY_DB);
          // Convert Message[] to ChatMessage format
          const chatMessages = messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
            timestamp: Date.now(),
          }));
          // Replace all messages (sync full state)
          await storage.replaceMessages(sessionId, chatMessages, eventId);
          logger.debug('[CloudflareAgent][PERSIST] Messages saved to D1', {
            sessionId,
            messageCount: messages.length,
            eventId,
          });
        } catch (err) {
          logger.warn('[CloudflareAgent][PERSIST] Failed to save messages', {
            sessionId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      })();
    }
    /**
     * Persist a slash command and its response to D1.
     * Used for commands that bypass chat() (e.g., /start, /help, /clear).
     * Uses fire-and-forget pattern to avoid blocking main flow.
     *
     * @param command - The slash command text (e.g., "/clear")
     * @param response - The response text
     * @param eventId - Optional event ID for D1 correlation
     */
    persistCommand(command, response, eventId) {
      const env = this.env;
      if (!env.OBSERVABILITY_DB) {
        return;
      }
      // Build session ID from state (platform:userId:chatId)
      const platform = routerConfig?.platform ?? 'api';
      const userId = this.state.userId?.toString() ?? 'unknown';
      const chatId = this.state.chatId?.toString() ?? 'unknown';
      const sessionId = `${platform}:${userId}:${chatId}`;
      const now = Date.now();
      // Fire-and-forget: persist command and response to D1
      void (async () => {
        try {
          const storage = new ChatMessageStorage(env.OBSERVABILITY_DB);
          // Append command and response as separate messages
          await storage.appendMessages(
            sessionId,
            [
              { role: 'user', content: command, timestamp: now },
              { role: 'assistant', content: response, timestamp: now },
            ],
            eventId
          );
          logger.debug('[CloudflareAgent][PERSIST] Command saved to D1', {
            sessionId,
            command,
            eventId,
          });
        } catch (err) {
          logger.warn('[CloudflareAgent][PERSIST] Failed to save command', {
            sessionId,
            command,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      })();
    }
    /**
     * Load messages from D1 for session recovery.
     * Called on init if DO state is empty but D1 has history.
     *
     * @returns Number of messages loaded, or 0 if none found
     */
    async loadMessagesFromD1() {
      const env = this.env;
      if (!env.OBSERVABILITY_DB) {
        return 0;
      }
      // Build session ID from state
      const platform = routerConfig?.platform ?? 'api';
      const userId = this.state.userId?.toString() ?? 'unknown';
      const chatId = this.state.chatId?.toString() ?? 'unknown';
      const sessionId = `${platform}:${userId}:${chatId}`;
      try {
        const storage = new ChatMessageStorage(env.OBSERVABILITY_DB);
        // Get recent messages (limited to maxHistory)
        const maxHistory = config.maxHistory ?? 100;
        const messages = await storage.getRecentMessages(sessionId, maxHistory);
        if (messages.length === 0) {
          return 0;
        }
        // Update state with loaded messages
        this.setState({
          ...this.state,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          updatedAt: Date.now(),
        });
        logger.info('[CloudflareAgent][LOAD] Restored messages from D1', {
          sessionId,
          messageCount: messages.length,
        });
        return messages.length;
      } catch (err) {
        logger.warn('[CloudflareAgent][LOAD] Failed to load messages from D1', {
          sessionId,
          error: err instanceof Error ? err.message : String(err),
        });
        return 0;
      }
    }
    /**
     * Initialize MCP server connections with timeout
     * Uses the new addMcpServer() API (agents SDK v0.2.24+) which handles
     * registration, connection, and discovery in one call
     */
    async initMcp() {
      if (this._mcpInitialized || mcpServers.length === 0) {
        return;
      }
      const env = this.env;
      const CONNECTION_TIMEOUT = 10000; // 10 seconds per connection
      for (const server of mcpServers) {
        try {
          const authHeader = server.getAuthHeader?.(env);
          const transportOptions = authHeader
            ? {
                headers: {
                  Authorization: authHeader,
                },
              }
            : undefined;
          logger.info(`[CloudflareAgent][MCP] Connecting to ${server.name} at ${server.url}`);
          logger.info(
            `[CloudflareAgent][MCP] Auth header present: ${!!authHeader}, length: ${authHeader?.length || 0}`
          );
          // Use the new addMcpServer() API which combines registerServer() + connectToServer()
          // This is the recommended approach for agents SDK v0.2.24+
          const addPromise = this.addMcpServer(
            server.name,
            server.url,
            '', // callbackHost - empty string for non-OAuth servers
            '', // agentsPrefix - empty string uses default
            transportOptions ? { transport: transportOptions } : undefined
          );
          // Add timeout to prevent hanging connections
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(
              () => reject(new Error(`Connection timeout after ${CONNECTION_TIMEOUT}ms`)),
              CONNECTION_TIMEOUT
            );
          });
          const result = await Promise.race([addPromise, timeoutPromise]);
          logger.info(`[CloudflareAgent][MCP] Connected to ${server.name}: ${result.id}`);
        } catch (error) {
          logger.error(`[CloudflareAgent][MCP] Failed to connect to ${server.name}: ${error}`);
          // Continue to next server - don't block on failed connections
        }
      }
      this._mcpInitialized = true;
    }
    /**
     * Get tools from connected MCP servers in OpenAI format
     */
    getMcpTools() {
      const mcpTools = this.mcp.listTools();
      return mcpTools.map((tool) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description || '',
          parameters: tool.inputSchema,
        },
      }));
    }
    /**
     * Called when state is updated from any source
     */
    onStateUpdate(state, source) {
      logger.info(`[CloudflareAgent] State updated: ${JSON.stringify(state)}, Source: ${source}`);
    }
    /**
     * Initialize agent with context (userId, chatId)
     * Also attempts to restore messages from D1 if DO state is empty.
     */
    async init(userId, chatId) {
      const needsUpdate =
        (this.state.userId === undefined && userId !== undefined) ||
        (this.state.chatId === undefined && chatId !== undefined);
      if (needsUpdate) {
        const newState = {
          ...this.state,
          createdAt: this.state.createdAt || Date.now(),
          updatedAt: Date.now(),
        };
        if (userId !== undefined) {
          newState.userId = userId;
        }
        if (chatId !== undefined) {
          newState.chatId = chatId;
        }
        this.setState(newState);
        // If DO state has no messages, try to restore from D1
        if (this.state.messages.length === 0) {
          await this.loadMessagesFromD1();
        }
      }
    }
    /**
     * Chat with the LLM directly, with optional MCP tool support
     * @param userMessage - The user's message
     * @param stepTracker - Optional step progress tracker for real-time UI updates
     * @param quotedContext - Optional quoted message context (when user replied to a message)
     * @param eventId - Optional event ID for D1 correlation
     */
    async chat(userMessage, stepTracker, quotedContext, eventId) {
      // Trim history if it exceeds maxHistory (handles bloated state from older versions)
      if (this.state.messages.length > maxHistory) {
        logger.info(
          `[CloudflareAgent][CHAT] Trimming bloated history: ${this.state.messages.length} -> ${maxHistory}`
        );
        const trimmedMessages = trimHistory(this.state.messages, maxHistory);
        this.setState({
          ...this.state,
          messages: trimmedMessages,
          updatedAt: Date.now(),
        });
      }
      // Emit thinking step
      await stepTracker?.addStep({ type: 'thinking' });
      // Initialize MCP connections if configured
      await this.initMcp();
      // Get LLM provider from environment bindings
      // Note: Type assertion needed due to TypeScript limitation with anonymous class inheritance
      const llmProvider = config.createProvider(this.env);
      // Get available tools from MCP servers and merge with built-in tools
      const mcpTools = this.getMcpTools();
      const allTools = [...builtinToolsOpenAI, ...mcpTools];
      // Deduplicate tools by name (keep first occurrence)
      const seenNames = new Set();
      let deduplicatedTools = allTools.filter((tool) => {
        const name = tool.function.name;
        if (seenNames.has(name)) {
          logger.info(`[CloudflareAgent][TOOLS] Skipping duplicate tool: ${name}`);
          return false;
        }
        seenNames.add(name);
        return true;
      });
      // Apply maxTools limit if configured
      if (maxTools !== undefined && deduplicatedTools.length > maxTools) {
        logger.info(
          `[CloudflareAgent][TOOLS] Limiting tools from ${deduplicatedTools.length} to ${maxTools}`
        );
        deduplicatedTools = deduplicatedTools.slice(0, maxTools);
      }
      const tools = deduplicatedTools;
      const hasTools = tools.length > 0;
      // Resolve systemPrompt (supports both string and function forms)
      const env = this.env;
      const resolvedSystemPrompt =
        typeof config.systemPrompt === 'function' ? config.systemPrompt(env) : config.systemPrompt;
      // Build messages with history embedded in user message (XML format)
      // This embeds conversation history directly in the prompt for AI Gateway compatibility
      const llmMessages = formatWithEmbeddedHistory(
        this.state.messages,
        resolvedSystemPrompt,
        userMessage,
        quotedContext
      );
      // Call LLM with tools if available
      let response = await llmProvider.chat(llmMessages, hasTools ? tools : undefined);
      // Track token usage and model from LLM response
      if (response.usage) {
        stepTracker?.addTokenUsage(response.usage);
      }
      if (response.model) {
        stepTracker?.setModel(response.model);
      }
      // Handle tool calls (up to maxToolIterations)
      let iterations = 0;
      // Track tool conversation for iterations (separate from embedded history)
      const toolConversation = [];
      while (
        response.toolCalls &&
        response.toolCalls.length > 0 &&
        iterations < maxToolIterations
      ) {
        iterations++;
        logger.info(
          `[CloudflareAgent][MCP] Processing ${response.toolCalls.length} tool calls (iteration ${iterations})`
        );
        // Add assistant message with tool calls to tool conversation
        toolConversation.push({
          role: 'assistant',
          content: response.content || '',
        });
        // Execute each tool call (built-in or MCP)
        for (const toolCall of response.toolCalls) {
          // Emit tool start step
          await stepTracker?.addStep({
            type: 'tool_start',
            toolName: toolCall.name,
          });
          try {
            const toolArgs = JSON.parse(toolCall.arguments);
            let resultText;
            // Check if it's a built-in tool first
            const builtinTool = builtinToolMap.get(toolCall.name);
            if (builtinTool) {
              logger.info(`[CloudflareAgent][TOOL] Calling built-in tool: ${toolCall.name}`);
              // Execute built-in tool
              const toolInput = {
                content: toolArgs,
              };
              const result = await builtinTool.execute(toolInput);
              // Format result
              resultText =
                typeof result.content === 'string'
                  ? result.content
                  : JSON.stringify(result.content);
              if (result.status === 'error' && result.error) {
                resultText = `Error: ${result.error.message}`;
              }
            } else {
              // Parse tool name to get server ID (format: serverId__toolName)
              const [serverId, ...toolNameParts] = toolCall.name.split('__');
              const toolName = toolNameParts.join('__') || toolCall.name;
              logger.info(`[CloudflareAgent][MCP] Calling tool: ${toolName} on server ${serverId}`);
              const result = await this.mcp.callTool({
                serverId: serverId || '',
                name: toolName,
                arguments: toolArgs,
              });
              // Format MCP result
              resultText = result.content
                .map((c) => (c.type === 'text' ? c.text : JSON.stringify(c)))
                .join('\n');
            }
            // Emit tool complete step
            await stepTracker?.addStep({
              type: 'tool_complete',
              toolName: toolCall.name,
              result: resultText,
            });
            // Use 'user' role with tool context for compatibility
            toolConversation.push({
              role: 'user',
              content: `[Tool Result for ${toolCall.name}]: ${resultText}`,
            });
          } catch (error) {
            logger.error(`[CloudflareAgent][TOOL] Tool call failed: ${error}`);
            // Emit tool error step
            const errorMessage = error instanceof Error ? error.message : String(error);
            await stepTracker?.addStep({
              type: 'tool_error',
              toolName: toolCall.name,
              error: errorMessage,
            });
            // Use 'user' role with error context for compatibility
            toolConversation.push({
              role: 'user',
              content: `[Tool Error for ${toolCall.name}]: ${errorMessage}`,
            });
          }
        }
        // Rebuild messages with embedded history + tool conversation
        // Combine: system prompt + embedded history with user message + tool turns
        const toolMessages = [...llmMessages, ...toolConversation];
        // Emit LLM iteration step (show iteration progress for multi-turn conversations)
        await stepTracker?.addStep({
          type: 'llm_iteration',
          iteration: iterations,
          maxIterations: maxToolIterations,
        });
        // Continue conversation with tool results
        response = await llmProvider.chat(toolMessages, hasTools ? tools : undefined);
        // Track token usage and model from follow-up LLM calls
        if (response.usage) {
          stepTracker?.addTokenUsage(response.usage);
        }
        if (response.model) {
          stepTracker?.setModel(response.model);
        }
      }
      // Emit preparing step before finalizing
      await stepTracker?.addStep({ type: 'preparing' });
      const assistantContent = response.content;
      // Update state with new messages (trimmed)
      const newMessages = trimHistory(
        [
          ...this.state.messages,
          { role: 'user', content: userMessage },
          { role: 'assistant', content: assistantContent },
        ],
        maxHistory
      );
      this.setState({
        ...this.state,
        messages: newMessages,
        updatedAt: Date.now(),
      });
      // Persist messages to D1 (fire-and-forget)
      this.persistMessages(eventId);
      return assistantContent;
    }
    /**
     * Clear conversation history.
     * Clears DO state but preserves D1 messages as archive.
     * The /clear command and response are persisted via persistCommand()
     * in handle(), so D1 maintains full audit trail.
     */
    async clearHistory() {
      const messageCount = this.state.messages.length;
      // Clear DO state (but keep D1 messages as archive)
      this.setState({
        ...this.state,
        messages: [],
        updatedAt: Date.now(),
      });
      // Note: D1 messages are NOT deleted - they serve as archive
      // The /clear command itself is persisted via persistCommand() in handle()
      logger.debug('[CloudflareAgent][CLEAR] DO state cleared', {
        platform: routerConfig?.platform ?? 'api',
        userId: this.state.userId,
        chatId: this.state.chatId,
        archivedMessages: messageCount,
      });
      return `🧹 Conversation cleared. ${messageCount} messages archived.`;
    }
    /**
     * Get welcome message
     */
    getWelcome() {
      return config.welcomeMessage ?? 'Hello! How can I help you?';
    }
    /**
     * Get help message
     */
    getHelp() {
      return config.helpMessage ?? 'Commands: /start, /help, /clear';
    }
    /**
     * Get message count
     */
    getMessageCount() {
      return this.state.messages.length;
    }
    /**
     * Set metadata
     */
    setMetadata(metadata) {
      this.setState({
        ...this.state,
        metadata: { ...this.state.metadata, ...metadata },
        updatedAt: Date.now(),
      });
    }
    /**
     * Get metadata
     */
    getMetadata() {
      return this.state.metadata;
    }
    /**
     * Handle built-in command and return response message
     * Routes /start, /help, /clear to appropriate handlers
     * Returns null for unknown commands (should fall back to chat)
     */
    async handleBuiltinCommand(text) {
      const command = (text.split(/[\s\n]/)[0] ?? '').toLowerCase();
      switch (command) {
        case '/start':
          return this.getWelcome();
        case '/help':
          return this.getHelp();
        case '/clear': {
          // Log state BEFORE clear for debugging
          logger.info('[CloudflareAgent][CLEAR] State BEFORE clear', {
            messageCount: this.state.messages?.length ?? 0,
            hasActiveBatch: !!this.state.activeBatch,
            hasPendingBatch: !!this.state.pendingBatch,
            hasMetadata: !!this.state.metadata,
          });
          // Full DO state reset - clears messages, metadata, batch, and resets MCP
          this._mcpInitialized = false;
          // Build fresh state without optional properties (exactOptionalPropertyTypes)
          // By NOT including activeBatch, pendingBatch, metadata, processedRequestIds,
          // we ensure they are fully cleared (not merged from old state)
          const freshState = {
            messages: [], // Clear conversation history
            createdAt: Date.now(),
            updatedAt: Date.now(),
            // Optional properties are intentionally OMITTED to clear them completely
          };
          // Preserve userId/chatId for session continuity
          if (this.state.userId !== undefined) {
            freshState.userId = this.state.userId;
          }
          if (this.state.chatId !== undefined) {
            freshState.chatId = this.state.chatId;
          }
          this.setState(freshState);
          // Log state AFTER clear to verify
          logger.info('[CloudflareAgent][CLEAR] State AFTER clear', {
            messageCount: this.state.messages?.length ?? 0,
            hasActiveBatch: !!this.state.activeBatch,
            hasPendingBatch: !!this.state.pendingBatch,
            hasMetadata: !!this.state.metadata,
            userId: freshState.userId,
            chatId: freshState.chatId,
            mcpReset: true,
          });
          return '🧹 All conversation data and agent connections cleared. Fresh start!';
        }
        case '/recover': {
          // Clear stuck batch state to recover from processing failures
          // This is a lighter reset than /clear - preserves messages and metadata
          const hadActiveBatch = !!this.state.activeBatch;
          const hadPendingBatch =
            !!this.state.pendingBatch && this.state.pendingBatch.pendingMessages.length > 0;
          // Remove batch state while preserving everything else
          const { activeBatch: _a, pendingBatch: _p, ...rest } = this.state;
          this.setState({
            ...rest,
            pendingBatch: createInitialBatchState(),
            updatedAt: Date.now(),
          });
          logger.info('[CloudflareAgent][RECOVER] Batch state cleared', {
            hadActiveBatch,
            activeBatchId: this.state.activeBatch?.batchId,
            hadPendingBatch,
            pendingBatchId: this.state.pendingBatch?.batchId,
          });
          if (!hadActiveBatch && !hadPendingBatch) {
            return '✅ No stuck batches detected. System is healthy.';
          }
          return `🔧 Recovered from stuck state. Cleared: ${hadActiveBatch ? 'activeBatch' : ''}${hadActiveBatch && hadPendingBatch ? ' + ' : ''}${hadPendingBatch ? 'pendingBatch' : ''}. Try sending a message again.`;
        }
        default:
          // Return null for unknown commands - will fall back to chat/tools/MCP
          return null;
      }
    }
    /**
     * @deprecated Use handleBuiltinCommand instead
     * Kept for backward compatibility
     */
    async handleCommand(text) {
      return (
        (await this.handleBuiltinCommand(text)) ??
        `Unknown command: ${text.split(' ')[0]}. Try /help for available commands.`
      );
    }
    /**
     * Transform slash command to natural language for LLM
     * e.g., "/translate hello" → "translate: hello"
     * e.g., "/math 1 + 1" → "math: 1 + 1"
     */
    transformSlashCommand(text) {
      // Remove leading slash and split into command + args
      const withoutSlash = text.slice(1);
      const spaceIndex = withoutSlash.indexOf(' ');
      if (spaceIndex === -1) {
        // Just command, no args: "/translate" → "translate"
        return withoutSlash;
      }
      const command = withoutSlash.slice(0, spaceIndex);
      const args = withoutSlash.slice(spaceIndex + 1).trim();
      // Format as "command: args" for clear intent
      return `${command}: ${args}`;
    }
    /**
     * Check if routing is enabled for this request.
     * Routing is always enabled when routerConfig is present.
     */
    shouldRoute(_userId) {
      if (!routerConfig) {
        return false;
      }
      if (routerConfig.debug) {
        logger.info('[CloudflareAgent][ROUTER] shouldRoute: routing enabled');
      }
      return true;
    }
    /**
     * Route a query through RouterAgent if enabled
     * Returns null if routing is disabled or RouterAgent is unavailable
     */
    async routeQuery(query, context) {
      if (!routerConfig) {
        return null;
      }
      const env = this.env;
      const routerEnv = env;
      // Check if RouterAgent binding is available
      if (!routerEnv.RouterAgent) {
        if (routerConfig.debug) {
          logger.warn('[CloudflareAgent][ROUTER] RouterAgent binding not available');
        }
        return null;
      }
      try {
        // Get RouterAgent by session/chat ID for state persistence
        const routerId = context.chatId?.toString() || context.userId?.toString() || 'default';
        const routerAgent = await getAgentByName(routerEnv.RouterAgent, routerId);
        // Call the route method, passing current conversation history
        const result = await routerAgent.route(query, {
          ...context,
          platform: routerConfig.platform,
          conversationHistory: this.state.messages,
        });
        if (routerConfig.debug) {
          logger.info('[CloudflareAgent][ROUTER] Route result', {
            success: result.success,
            durationMs: result.durationMs,
          });
        }
        // If result contains new messages, save them to state
        if (
          result?.success &&
          result.data &&
          typeof result.data === 'object' &&
          'newMessages' in result.data
        ) {
          const newMessages = result.data.newMessages;
          this.setState({
            ...this.state,
            messages: trimHistory([...this.state.messages, ...newMessages], maxHistory),
            updatedAt: Date.now(),
          });
        }
        return result;
      } catch (error) {
        logger.error('[CloudflareAgent][ROUTER] Failed to route query', {
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    }
    /**
     * Get routing statistics from RouterAgent if available
     */
    async getRoutingStats() {
      if (!routerConfig) {
        return null;
      }
      const env = this.env;
      const routerEnv = env;
      if (!routerEnv.RouterAgent) {
        return null;
      }
      try {
        const routerId =
          this.state.chatId?.toString() || this.state.userId?.toString() || 'default';
        const routerAgent = await getAgentByName(routerEnv.RouterAgent, routerId);
        return routerAgent.getStats();
      } catch (error) {
        logger.error('[CloudflareAgent][ROUTER] Failed to get stats', {
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    }
    /**
     * Get routing history from RouterAgent if available
     */
    async getRoutingHistory(limit) {
      if (!routerConfig) {
        return null;
      }
      const env = this.env;
      const routerEnv = env;
      if (!routerEnv.RouterAgent) {
        return null;
      }
      try {
        const routerId =
          this.state.chatId?.toString() || this.state.userId?.toString() || 'default';
        const routerAgent = await getAgentByName(routerEnv.RouterAgent, routerId);
        return routerAgent.getRoutingHistory(limit);
      } catch (error) {
        logger.error('[CloudflareAgent][ROUTER] Failed to get history', {
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    }
    /**
     * Record a stage transition in the active batch
     */
    recordStage(stage, metadata) {
      const batch = this.state.activeBatch;
      if (!batch) {
        return;
      }
      const transition = {
        stage,
        timestamp: Date.now(),
        ...(metadata && { metadata }),
      };
      const stageHistory = [...(batch.stageHistory ?? []), transition];
      this.setState({
        ...this.state,
        activeBatch: {
          ...batch,
          currentStage: stage,
          stageHistory,
        },
        updatedAt: Date.now(),
      });
    }
    /**
     * Notify user when max retries exceeded
     */
    async notifyUserOfFailure(batch, error) {
      const firstMessage = batch.pendingMessages[0];
      if (!transport || !firstMessage) {
        return;
      }
      try {
        const ctx = firstMessage.originalContext;
        if (!ctx) {
          logger.warn('[CloudflareAgent] Cannot notify user - no transport context');
          return;
        }
        const errorMessage = error instanceof Error ? error.message : String(error);
        let userMessage = '❌ Sorry, your message could not be processed after multiple attempts.';
        // Add debug info for admin users
        const isAdmin = ctx.isAdmin === true;
        if (isAdmin) {
          const recentErrors =
            batch.retryErrors
              ?.slice(-3)
              .map((e) => e.message)
              .join('; ') || errorMessage;
          userMessage += `\n\n<blockquote expandable>Debug: ${recentErrors}</blockquote>`;
        }
        await transport.send(ctx, userMessage);
      } catch (sendError) {
        logger.error('[CloudflareAgent] Failed to notify user of failure', {
          error: sendError instanceof Error ? sendError.message : String(sendError),
        });
      }
    }
    /**
     * Schedule routing to RouterAgent without blocking (fire-and-forget pattern)
     *
     * Instead of blocking on routeQuery(), this method schedules the work
     * on RouterAgent via its alarm handler. The caller returns immediately
     * after scheduling, and RouterAgent handles response delivery.
     *
     * @param query - The query to route
     * @param context - Agent context
     * @param responseTarget - Where to send the response (includes admin context for debug footer)
     * @returns Promise<boolean> - true if scheduling succeeded
     */
    async scheduleRouting(query, context, responseTarget) {
      if (!routerConfig) {
        return false;
      }
      const env = this.env;
      const routerEnv = env;
      if (!routerEnv.RouterAgent) {
        logger.warn('[CloudflareAgent] RouterAgent binding not available for scheduling');
        return false;
      }
      try {
        const routerId = context.chatId?.toString() || context.userId?.toString() || 'default';
        const routerAgent = await getAgentByName(routerEnv.RouterAgent, routerId);
        // Call fire-and-forget method on RouterAgent
        const result = await routerAgent.scheduleExecution(query, context, responseTarget);
        logger.info('[CloudflareAgent] Delegated to RouterAgent (fire-and-forget)', {
          executionId: result.executionId,
          scheduled: result.scheduled,
          chatId: responseTarget.chatId,
        });
        return result.scheduled;
      } catch (error) {
        logger.error('[CloudflareAgent] Failed to schedule routing', {
          error: error instanceof Error ? error.message : String(error),
        });
        return false;
      }
    }
    /**
     * Handle incoming message context
     * Routes to command handler or chat, then sends response via transport
     *
     * @param ctx - Platform-specific context
     * @throws Error if transport is not configured
     */
    async handle(ctx) {
      logger.info(`[CloudflareAgent][HANDLE] Starting handle (${JSON.stringify(ctx)}`);
      if (!transport) {
        throw new Error('Transport not configured. Pass transport in config to use handle().');
      }
      const input = transport.parseContext(ctx);
      logger.info(`[CloudflareAgent][HANDLE] Parsed input: ${JSON.stringify(input)}`);
      // Deduplicate requests using requestId from metadata
      const requestId = input.metadata?.requestId;
      if (requestId) {
        const lastRequestId = this.state.metadata?.lastRequestId;
        if (lastRequestId === requestId) {
          logger.info(`[CloudflareAgent][HANDLE] Duplicate request ${requestId}, skipping`);
          return;
        }
      }
      // Prevent concurrent processing (Telegram may send retries)
      if (this._processing) {
        logger.info('[CloudflareAgent][HANDLE] Already processing, skipping duplicate request');
        return;
      }
      this._processing = true;
      // Store requestId to prevent future duplicates
      if (requestId) {
        this.setState({
          ...this.state,
          metadata: { ...this.state.metadata, lastRequestId: requestId },
          updatedAt: Date.now(),
        });
      }
      // Initialize state with user/chat context
      await this.init(input.userId, input.chatId);
      // Track message reference for error handling
      let messageRef;
      let stepTracker;
      // Legacy rotator for batch processing (not yet migrated)
      let rotator;
      // Extract eventId from metadata for D1 correlation (outside try for error handling)
      const eventId = input.metadata?.eventId;
      // Track start time for observability duration
      const handleStartTime = Date.now();
      try {
        // Call beforeHandle hook
        if (hooks?.beforeHandle) {
          await hooks.beforeHandle(ctx);
        }
        let response = '';
        let chatMessage = input.text;
        // Extract quoted context from metadata (if user replied to a message)
        const quotedUsername = input.metadata?.quotedUsername;
        const quotedContext = input.metadata?.quotedText
          ? {
              text: input.metadata.quotedText,
              ...(quotedUsername && { username: quotedUsername }),
            }
          : undefined;
        // Route: Built-in Command, Dynamic Command, or Chat
        if (input.text.startsWith('/')) {
          // Try built-in commands first (/start, /help, /clear)
          const builtinResponse = await this.handleBuiltinCommand(input.text);
          if (builtinResponse !== null) {
            // Built-in command handled - send response directly
            response = builtinResponse;
            await transport.send(ctx, response);
            // Persist command to D1 (fire-and-forget)
            this.persistCommand(input.text, builtinResponse, eventId);
            // Update observability for command
            if (eventId) {
              this.updateObservability([eventId], {
                status: 'success',
                durationMs: Date.now() - handleStartTime,
                responseText: builtinResponse,
              });
            }
          } else {
            // Unknown command - transform to chat message for tools/MCP/LLM
            // e.g., "/translate hello" → "translate: hello"
            chatMessage = this.transformSlashCommand(input.text);
            logger.info(
              `[CloudflareAgent][HANDLE] Dynamic command: "${input.text}" → "${chatMessage}"`
            );
            // Fall through to chat processing below
            response = ''; // Will be set in chat block
          }
        }
        // Process with chat if not a built-in command
        if (!input.text.startsWith('/') || chatMessage !== input.text) {
          // Send typing indicator
          if (transport.typing) {
            await transport.typing(ctx);
          }
          // Send initial thinking message
          messageRef = await transport.send(ctx, '🔄 Thinking...');
          // Create step progress tracker for real-time step visibility
          if (transport.edit) {
            stepTracker = new StepProgressTracker(
              async (message) => {
                try {
                  // Update context with progressive debug info for footer display
                  // This enables the transport to show debug footer during loading
                  const ctxWithDebug = ctx;
                  if (stepTracker) {
                    ctxWithDebug.debugContext = stepTracker.getDebugContext();
                  }
                  await transport.edit(ctx, messageRef, message);
                } catch (err) {
                  logger.error(`[CloudflareAgent][STEP] Edit failed: ${err}`);
                }
              },
              {
                rotationInterval: config.thinkingRotationInterval ?? 5000,
              }
            );
          }
          // Process with LLM - must await to keep DO alive
          // Note: Worker may timeout on long LLM calls, but DO continues
          try {
            // Check if routing is enabled for this user
            const userIdStr = input.userId?.toString();
            const useRouting = this.shouldRoute(userIdStr);
            if (useRouting) {
              // Build agent context for RouterAgent
              // Extract platform config from environment if extractor provided
              const env = this.env;
              const platformConfig = extractPlatformConfig?.(env);
              const agentContext = {
                query: chatMessage,
                userId: input.userId?.toString(),
                chatId: input.chatId?.toString(),
                ...(input.username && { username: input.username }),
                platform: routerConfig?.platform || 'api',
                ...(input.metadata && { data: input.metadata }),
                ...(platformConfig && { platformConfig }),
                ...(eventId && { eventId }),
              };
              logger.info('[CloudflareAgent][HANDLE] Routing enabled, calling RouterAgent', {
                platform: agentContext.platform,
                userId: agentContext.userId,
              });
              // Try routing through RouterAgent
              const routeResult = await this.routeQuery(chatMessage, agentContext);
              if (routeResult?.success && routeResult.content) {
                // Emit routing step to show which agent handled the query
                const routedTo = routeResult.data?.routedTo ?? 'unknown';
                await stepTracker?.addStep({
                  type: 'routing',
                  agentName: String(routedTo),
                });
                // Routing succeeded - use the routed response
                response = routeResult.content;
                logger.info('[CloudflareAgent][HANDLE] RouterAgent returned response', {
                  routedTo,
                  durationMs: routeResult.durationMs,
                });
              } else {
                // Routing failed or returned null - fall back to direct chat
                logger.info(
                  '[CloudflareAgent][HANDLE] Routing failed or unavailable, falling back to chat()'
                );
                response = await this.chat(chatMessage, stepTracker, quotedContext, eventId);
              }
            } else {
              // Routing disabled - use direct chat
              logger.info('[CloudflareAgent][HANDLE] Routing disabled, using direct chat()');
              response = await this.chat(chatMessage, stepTracker, quotedContext, eventId);
            }
          } finally {
            // Stop step tracker (stops any rotation timers)
            stepTracker?.destroy();
          }
          // Edit thinking message with actual response
          if (transport.edit) {
            try {
              // Update context with final debug info before sending
              const ctxWithDebug = ctx;
              if (stepTracker) {
                ctxWithDebug.debugContext = stepTracker.getDebugContext();
              }
              logger.info(`[CloudflareAgent][HANDLE] Editing final response: ${response}`);
              await transport.edit(ctx, messageRef, response);
            } catch (editError) {
              // Fallback: send new message if edit fails (e.g., message deleted)
              logger.error(
                `[CloudflareAgent][HANDLE] Edit failed, sending new message: ${editError}`
              );
              // Set debug context for fallback send too
              const ctxWithDebug = ctx;
              if (stepTracker) {
                ctxWithDebug.debugContext = stepTracker.getDebugContext();
              }
              await transport.send(ctx, response);
            }
          } else {
            // Transport doesn't support edit, send new message
            // Set debug context here too
            const ctxWithDebug = ctx;
            if (stepTracker) {
              ctxWithDebug.debugContext = stepTracker.getDebugContext();
            }
            await transport.send(ctx, response);
          }
        }
        // Call afterHandle hook (for command responses)
        if (hooks?.afterHandle) {
          await hooks.afterHandle(ctx, response);
        }
        // Capture debug context for observability (used by batch completion too)
        const debugContext = stepTracker?.getDebugContext();
        this._lastDebugContext = debugContext;
        this._lastResponse = response;
        // Update observability for this event with full data (fire-and-forget)
        if (eventId) {
          const completedAt = Date.now();
          const durationMs = completedAt - handleStartTime;
          // Extract classification, agents, tokens, and model from debug context
          let classification;
          let agents;
          let inputTokens = 0;
          let outputTokens = 0;
          let totalTokens = 0;
          let cachedTokens = 0;
          let reasoningTokens = 0;
          let model;
          if (debugContext) {
            if (debugContext.classification) {
              classification = {
                type: debugContext.classification.type ?? 'unknown',
                category: debugContext.classification.category ?? 'unknown',
                complexity: debugContext.classification.complexity ?? 'unknown',
              };
            }
            agents = debugContextToAgentSteps(debugContext);
            // Sum tokens and extract model from routing flow
            for (const flow of debugContext.routingFlow) {
              if (flow.tokenUsage) {
                inputTokens += flow.tokenUsage.inputTokens ?? 0;
                outputTokens += flow.tokenUsage.outputTokens ?? 0;
                cachedTokens += flow.tokenUsage.cachedTokens ?? 0;
                reasoningTokens += flow.tokenUsage.reasoningTokens ?? 0;
              }
              // Prefer last agent's model (the one that generated the response)
              if (flow.model) {
                model = flow.model;
              }
            }
            totalTokens = inputTokens + outputTokens;
          }
          this.upsertObservability(eventId, {
            status: 'success',
            completedAt,
            durationMs,
            responseText: response,
            ...(classification && { classification }),
            ...(agents && agents.length > 0 && { agents }),
            ...(inputTokens > 0 && { inputTokens }),
            ...(outputTokens > 0 && { outputTokens }),
            ...(totalTokens > 0 && { totalTokens }),
            ...(cachedTokens > 0 && { cachedTokens }),
            ...(reasoningTokens > 0 && { reasoningTokens }),
            ...(model && { model }),
          });
        }
      } catch (error) {
        // Stop step tracker if still running
        stepTracker?.destroy();
        // Legacy rotator cleanup (for batch processing)
        rotator?.stop();
        logger.error(`[CloudflareAgent][HANDLE] Error: ${error}`);
        // Edit thinking message to show error (if we have a message to edit)
        if (messageRef && transport.edit) {
          const errorMessage = '❌ Sorry, an error occurred. Please try again later.';
          try {
            await transport.edit(ctx, messageRef, errorMessage);
          } catch {
            // Fallback: send new message if edit fails
            await transport.send(ctx, errorMessage);
          }
        }
        // Call onError hook for logging/custom handling
        if (hooks?.onError) {
          await hooks.onError(ctx, error, messageRef);
        } else if (!messageRef) {
          // No message to edit and no hook - rethrow
          throw error;
        }
        // Update observability with error status (fire-and-forget)
        if (eventId) {
          this.updateObservability([eventId], {
            status: 'error',
            durationMs: Date.now() - handleStartTime,
            errorMessage: error instanceof Error ? error.message : String(error),
          });
        }
      } finally {
        // Always reset processing flag
        this._processing = false;
      }
    }
    /**
     * Queue a message for batch processing with alarm-based execution
     * Messages arriving within the batch window are combined into a single LLM call
     *
     * TWO-BATCH QUEUE ARCHITECTURE:
     * - activeBatch: Currently being processed (IMMUTABLE)
     * - pendingBatch: Collecting new messages (MUTABLE)
     * - NEW messages ALWAYS go to pendingBatch, NEVER to activeBatch
     */
    async queueMessage(ctx) {
      if (!transport) {
        throw new Error(
          'Transport not configured. Pass transport in config to use queueMessage().'
        );
      }
      const input = transport.parseContext(ctx);
      const requestId = input.metadata?.requestId || crypto.randomUUID();
      const now = Date.now();
      // Detect and recover from stuck activeBatch
      // This prevents a failed/stuck batch from blocking all future message processing
      let recoveredFromStuck = false;
      if (this.state.activeBatch) {
        const stuckCheck = isBatchStuckByHeartbeat(this.state.activeBatch);
        if (stuckCheck.isStuck) {
          logger.warn('[CloudflareAgent][BATCH] Detected stuck activeBatch, recovering', {
            batchId: this.state.activeBatch.batchId,
            reason: stuckCheck.reason,
            lastHeartbeat: this.state.activeBatch.lastHeartbeat,
            status: this.state.activeBatch.status,
          });
          // Clear stuck activeBatch to allow new messages to process
          const { activeBatch: _removed, ...stateWithoutActive } = this.state;
          this.setState({
            ...stateWithoutActive,
            updatedAt: now,
          });
          recoveredFromStuck = true;
        }
      }
      // Get or create pendingBatch (NEW messages ALWAYS go here)
      const pendingBatch = this.state.pendingBatch ?? createInitialBatchState();
      // Check for duplicates across BOTH batches
      if (isDuplicateInBothBatches(requestId, this.state.activeBatch, pendingBatch)) {
        logger.info(`[CloudflareAgent][BATCH] Duplicate request ${requestId}, skipping`);
        return { queued: false };
      }
      // Extract eventId from metadata for observability correlation
      const eventId = input.metadata?.eventId;
      // Create pending message with original context for transport operations
      const pendingMessage = {
        text: input.text,
        timestamp: now,
        requestId,
        ...(eventId && { eventId }), // Full UUID for D1 observability
        userId: input.userId,
        chatId: input.chatId,
        ...(input.username && { username: input.username }),
        originalContext: ctx,
      };
      // Add to pendingBatch
      pendingBatch.pendingMessages.push(pendingMessage);
      pendingBatch.lastMessageAt = now;
      // Initialize pendingBatch if this is the first message
      if (pendingBatch.status === 'idle') {
        pendingBatch.status = 'collecting';
        pendingBatch.batchStartedAt = now;
        pendingBatch.batchId = crypto.randomUUID();
      }
      // Determine if we need to schedule alarm
      // Schedule if: (1) no active batch AND first message, OR (2) just recovered from stuck,
      // OR (3) orphaned pending batch (alarm was lost due to deployment/hibernation/SDK issue)
      const isFirstMessage = pendingBatch.pendingMessages.length === 1;
      const hasNoActiveProcessing = !this.state.activeBatch;
      const shouldScheduleNormal = hasNoActiveProcessing && isFirstMessage;
      const shouldScheduleAfterRecovery =
        recoveredFromStuck && pendingBatch.pendingMessages.length > 0;
      // FIX: Also schedule if we have pending messages but no active batch and not first message
      // This handles the edge case where a previous alarm was lost (e.g., due to deployment,
      // DO hibernation, or SDK issue). Without this, messages accumulate forever.
      const hasOrphanedPendingBatch =
        hasNoActiveProcessing &&
        !isFirstMessage &&
        pendingBatch.pendingMessages.length > 0 &&
        pendingBatch.status === 'collecting';
      const shouldSchedule =
        shouldScheduleNormal || shouldScheduleAfterRecovery || hasOrphanedPendingBatch;
      // Update state with new pendingBatch
      this.setState({
        ...this.state,
        pendingBatch,
        updatedAt: now,
      });
      logger.info('[CloudflareAgent][BATCH] Message queued to pendingBatch', {
        requestId,
        batchId: pendingBatch.batchId,
        pendingCount: pendingBatch.pendingMessages.length,
        hasActiveBatch: !!this.state.activeBatch,
        recoveredFromStuck,
        hasOrphanedPendingBatch,
        willScheduleAlarm: shouldSchedule,
      });
      // Schedule alarm if conditions met
      if (shouldSchedule) {
        const reason = shouldScheduleAfterRecovery
          ? 'recovered_from_stuck'
          : hasOrphanedPendingBatch
            ? 'orphaned_pending_batch'
            : 'first_pending_message';
        logger.info(`[CloudflareAgent][BATCH] Scheduling alarm (${reason})`);
        try {
          await this.schedule(1, 'onBatchAlarm', {
            batchId: pendingBatch.batchId,
          });
          logger.info('[CloudflareAgent][BATCH][ALARM] Scheduled', {
            batchId: pendingBatch.batchId,
            delayMs: 1000,
            scheduledFor: Date.now() + 1000,
            reason,
          });
        } catch (scheduleError) {
          // CRITICAL FIX: If schedule() fails, fall back to direct processing
          // This prevents messages from being stuck forever when alarm scheduling fails
          logger.error('[CloudflareAgent][BATCH][ALARM] Schedule failed, processing immediately', {
            batchId: pendingBatch.batchId,
            error: scheduleError instanceof Error ? scheduleError.message : String(scheduleError),
          });
          // Fall back to direct processing via micro-task to avoid blocking
          queueMicrotask(() => {
            this.onBatchAlarm({ batchId: pendingBatch.batchId }).catch((err) => {
              logger.error('[CloudflareAgent][BATCH] Fallback processing failed', {
                batchId: pendingBatch.batchId,
                error: err instanceof Error ? err.message : String(err),
              });
            });
          });
        }
      }
      // Return result
      const result = { queued: true };
      if (pendingBatch.batchId) {
        result.batchId = pendingBatch.batchId;
      }
      return result;
    }
    /**
     * Receive a message directly via ParsedInput (RPC-friendly)
     * This is the preferred method for calling from webhooks as it doesn't require transport context.
     *
     * Unlike queueMessage(), this method:
     * - Accepts ParsedInput directly (no transport.parseContext needed)
     * - Returns a traceId for correlation
     * - Works via RPC from worker to Durable Object
     *
     * @param input - Parsed message input with text, userId, chatId, etc.
     * @returns Object with traceId, queued status, and optional batchId
     */
    async receiveMessage(input) {
      const traceId = input.metadata?.requestId || crypto.randomUUID();
      const now = Date.now();
      logger.info('[CloudflareAgent] receiveMessage called', {
        traceId,
        text: input.text.substring(0, 50),
        userId: input.userId,
        chatId: input.chatId,
      });
      // Detect and recover from stuck activeBatch
      let recoveredFromStuck = false;
      if (this.state.activeBatch) {
        const stuckCheck = isBatchStuckByHeartbeat(this.state.activeBatch);
        if (stuckCheck.isStuck) {
          logger.warn('[CloudflareAgent][receiveMessage] Detected stuck activeBatch, recovering', {
            batchId: this.state.activeBatch.batchId,
            reason: stuckCheck.reason,
          });
          const { activeBatch: _removed, ...stateWithoutActive } = this.state;
          this.setState({
            ...stateWithoutActive,
            updatedAt: now,
          });
          recoveredFromStuck = true;
        }
      }
      // Get or create pendingBatch
      const pendingBatch = this.state.pendingBatch ?? createInitialBatchState();
      // Check for duplicates
      if (isDuplicateInBothBatches(traceId, this.state.activeBatch, pendingBatch)) {
        logger.info(`[CloudflareAgent][receiveMessage] Duplicate request ${traceId}, skipping`);
        return { traceId, queued: false };
      }
      // Create pending message (without originalContext since we don't have transport TContext)
      // Extract eventId from metadata for D1 observability correlation
      const eventId = input.metadata?.eventId;
      // UPSERT: Mark event as 'processing' when agent receives message
      if (eventId) {
        this.upsertObservability(eventId, {
          status: 'processing',
        });
      }
      const pendingMessage = {
        text: input.text,
        timestamp: now,
        requestId: traceId,
        userId: input.userId,
        chatId: input.chatId,
        ...(input.username && { username: input.username }),
        // Event ID for D1 observability updates when batch completes
        ...(eventId && { eventId }),
        // Store metadata for later use (platform info, etc.)
        originalContext: input.metadata,
      };
      // Add to pendingBatch
      pendingBatch.pendingMessages.push(pendingMessage);
      pendingBatch.lastMessageAt = now;
      // Initialize pendingBatch if first message
      if (pendingBatch.status === 'idle') {
        pendingBatch.status = 'collecting';
        pendingBatch.batchStartedAt = now;
        pendingBatch.batchId = crypto.randomUUID();
      }
      // Determine if we need to schedule alarm
      const isFirstMessage = pendingBatch.pendingMessages.length === 1;
      const hasNoActiveProcessing = !this.state.activeBatch;
      const shouldScheduleNormal = hasNoActiveProcessing && isFirstMessage;
      const shouldScheduleAfterRecovery =
        recoveredFromStuck && pendingBatch.pendingMessages.length > 0;
      const hasOrphanedPendingBatch =
        hasNoActiveProcessing &&
        !isFirstMessage &&
        pendingBatch.pendingMessages.length > 0 &&
        pendingBatch.status === 'collecting';
      const shouldSchedule =
        shouldScheduleNormal || shouldScheduleAfterRecovery || hasOrphanedPendingBatch;
      // Update state
      this.setState({
        ...this.state,
        pendingBatch,
        updatedAt: now,
      });
      logger.info('[CloudflareAgent][receiveMessage] Message queued', {
        traceId,
        batchId: pendingBatch.batchId,
        pendingCount: pendingBatch.pendingMessages.length,
        willScheduleAlarm: shouldSchedule,
      });
      // Schedule alarm if needed
      if (shouldSchedule) {
        const reason = shouldScheduleAfterRecovery
          ? 'recovered_from_stuck'
          : hasOrphanedPendingBatch
            ? 'orphaned_pending_batch'
            : 'first_pending_message';
        try {
          await this.schedule(1, 'onBatchAlarm', {
            batchId: pendingBatch.batchId,
          });
          logger.info('[CloudflareAgent][receiveMessage] Alarm scheduled', {
            batchId: pendingBatch.batchId,
            reason,
          });
        } catch (scheduleError) {
          logger.error(
            '[CloudflareAgent][receiveMessage] Schedule failed, processing immediately',
            {
              error: scheduleError instanceof Error ? scheduleError.message : String(scheduleError),
            }
          );
          // Fall back to direct processing
          queueMicrotask(() => {
            this.onBatchAlarm({ batchId: pendingBatch.batchId }).catch((err) => {
              logger.error('[CloudflareAgent][receiveMessage] Fallback processing failed', {
                error: err instanceof Error ? err.message : String(err),
              });
            });
          });
        }
      }
      return {
        traceId,
        queued: true,
        ...(pendingBatch.batchId && { batchId: pendingBatch.batchId }),
      };
    }
    /**
     * Alarm handler for batch processing
     * Called by Cloudflare Agents SDK schedule system
     *
     * TWO-BATCH QUEUE LOGIC:
     * 1. Check if already processing (activeBatch exists) → skip
     * 2. Promote pendingBatch to activeBatch atomically
     * 3. Clear pendingBatch
     * 4. Process activeBatch
     * 5. On success: clear activeBatch, schedule alarm if pendingBatch has messages
     * 6. On failure: clear activeBatch, don't retry (discard stuck messages)
     */
    async onBatchAlarm(_data) {
      logger.info('[CloudflareAgent][BATCH][ALARM] Fired', {
        batchId: _data.batchId,
        firedAt: Date.now(),
        hasActiveBatch: !!this.state.activeBatch,
        hasPendingBatch: !!this.state.pendingBatch,
        pendingCount: this.state.pendingBatch?.pendingMessages.length || 0,
        activeCount: this.state.activeBatch?.pendingMessages.length || 0,
      });
      // Check if already processing - but also check for stuck state
      if (this.state.activeBatch) {
        // CRITICAL FIX: Check if activeBatch is stuck before skipping
        // Previously, a stuck batch would block all future processing until user sent a new message
        const stuckCheck = isBatchStuckByHeartbeat(this.state.activeBatch);
        if (stuckCheck.isStuck) {
          logger.warn(
            '[CloudflareAgent][BATCH][ALARM] Active batch stuck, clearing to allow processing',
            {
              batchId: this.state.activeBatch.batchId,
              reason: stuckCheck.reason,
              lastHeartbeat: this.state.activeBatch.lastHeartbeat,
              status: this.state.activeBatch.status,
            }
          );
          // Clear stuck activeBatch and continue to process pendingBatch
          const { activeBatch: _removed, ...stateWithoutActive } = this.state;
          this.setState({
            ...stateWithoutActive,
            updatedAt: Date.now(),
          });
          // Don't return - continue to process pendingBatch below
        } else {
          // Active batch is healthy - skip this alarm
          logger.info('[CloudflareAgent][BATCH] activeBatch healthy, skipping alarm');
          return;
        }
      }
      // Check if there are pending messages to process
      if (!this.state.pendingBatch || this.state.pendingBatch.pendingMessages.length === 0) {
        logger.info('[CloudflareAgent][BATCH] No pending messages to process');
        return;
      }
      const now = Date.now();
      // Promote pendingBatch to activeBatch atomically
      const activeBatch = {
        ...this.state.pendingBatch,
        status: 'processing',
        lastHeartbeat: now, // Initialize heartbeat for stuck detection
      };
      // Clear pendingBatch immediately
      this.setState({
        ...this.state,
        activeBatch,
        pendingBatch: createInitialBatchState(),
        updatedAt: now,
      });
      logger.info('[CloudflareAgent][BATCH] Promoted pendingBatch to activeBatch', {
        batchId: activeBatch.batchId,
        messageCount: activeBatch.pendingMessages.length,
      });
      // Track batch start time for duration calculation
      this._batchStartTime = now;
      // Report to State DO: batch started
      const firstMessage = activeBatch.pendingMessages[0];
      if (firstMessage) {
        const sessionId =
          this.state.chatId?.toString() ||
          this.state.userId?.toString() ||
          activeBatch.batchId ||
          '';
        // Build responseTarget only if we have original context
        const responseTarget = firstMessage.originalContext
          ? { chatId: firstMessage.chatId?.toString() || '' }
          : null;
        const registerParams = {
          sessionId,
          batchId: activeBatch.batchId || '',
          platform: this.getPlatform(),
          userId: firstMessage.userId?.toString() || '',
          chatId: firstMessage.chatId?.toString() || '',
          responseTarget,
        };
        this.reportToStateDO('registerBatch', registerParams);
      }
      try {
        this.recordStage('processing');
        await this.processBatch();
        // Success - clear activeBatch
        const { activeBatch: _removed, ...stateWithoutActive } = this.state;
        const newState = {
          ...stateWithoutActive,
          updatedAt: Date.now(),
        };
        this.setState(newState);
        this.recordStage('done');
        logger.info('[CloudflareAgent][BATCH] Batch processed successfully', {
          batchId: activeBatch.batchId,
        });
        // Report to State DO: batch completed successfully
        const completedSessionId =
          this.state.chatId?.toString() ||
          this.state.userId?.toString() ||
          activeBatch.batchId ||
          '';
        const durationMs = Date.now() - this._batchStartTime;
        const completeParams = {
          sessionId: completedSessionId,
          batchId: activeBatch.batchId || '',
          success: true,
          durationMs,
        };
        this.reportToStateDO('completeBatch', completeParams);
        // Update observability: batch completed successfully with full data
        // Extract eventIds from pending messages (full UUIDs for D1 correlation)
        const eventIds = activeBatch.pendingMessages.map((m) => m.eventId).filter((id) => !!id);
        if (eventIds.length > 0) {
          const completedAt = Date.now();
          // Extract classification and agents from captured debug context
          let classification;
          let agents;
          let inputTokens = 0;
          let outputTokens = 0;
          let totalTokens = 0;
          if (this._lastDebugContext) {
            if (this._lastDebugContext.classification) {
              classification = {
                type: this._lastDebugContext.classification.type ?? 'unknown',
                category: this._lastDebugContext.classification.category ?? 'unknown',
                complexity: this._lastDebugContext.classification.complexity ?? 'unknown',
              };
            }
            agents = debugContextToAgentSteps(this._lastDebugContext);
            // Sum tokens from routing flow
            for (const flow of this._lastDebugContext.routingFlow) {
              if (flow.tokenUsage) {
                inputTokens += flow.tokenUsage.inputTokens ?? 0;
                outputTokens += flow.tokenUsage.outputTokens ?? 0;
              }
            }
            totalTokens = inputTokens + outputTokens;
          }
          // Upsert each event with full data
          for (const eventId of eventIds) {
            this.upsertObservability(eventId, {
              status: 'success',
              completedAt,
              durationMs,
              ...(this._lastResponse !== undefined && { responseText: this._lastResponse }),
              ...(classification && { classification }),
              ...(agents && agents.length > 0 && { agents }),
              ...(inputTokens > 0 && { inputTokens }),
              ...(outputTokens > 0 && { outputTokens }),
              ...(totalTokens > 0 && { totalTokens }),
            });
          }
          // Clear captured data after use
          this._lastResponse = undefined;
          this._lastDebugContext = undefined;
        } else if (activeBatch.pendingMessages.length > 0) {
          // Log warning if messages exist but no eventIds (indicates webhook didn't pass eventId)
          logger.warn('[CloudflareAgent][BATCH] No eventIds for observability update', {
            batchId: activeBatch.batchId,
            messageCount: activeBatch.pendingMessages.length,
          });
        }
        // Check if new messages arrived during processing
        const currentPendingBatch = this.state.pendingBatch;
        if (currentPendingBatch && currentPendingBatch.pendingMessages.length > 0) {
          logger.info(
            '[CloudflareAgent][BATCH] New messages arrived during processing, scheduling alarm',
            {
              pendingCount: currentPendingBatch.pendingMessages.length,
              pendingBatchId: currentPendingBatch.batchId,
            }
          );
          await this.schedule(1, 'onBatchAlarm', {
            batchId: currentPendingBatch.batchId,
          });
        }
      } catch (error) {
        const activeBatchState = this.state.activeBatch;
        const currentRetry = activeBatchState?.retryCount ?? 0;
        const errorInfo = {
          timestamp: Date.now(),
          message: error instanceof Error ? error.message : String(error),
          ...(error instanceof Error && error.stack && { stack: error.stack }),
        };
        logger.error('[CloudflareAgent][BATCH] Processing failed', {
          batchId: activeBatchState?.batchId,
          retryCount: currentRetry,
          error: errorInfo.message,
        });
        if (currentRetry < retryConfig.maxRetries) {
          // Schedule retry with exponential backoff
          const delayMs = calculateRetryDelay(currentRetry, retryConfig);
          const delaySeconds = Math.ceil(delayMs / 1000);
          this.recordStage('retrying', {
            retryCount: currentRetry + 1,
            delayMs,
            error: errorInfo.message,
          });
          logger.warn('[CloudflareAgent][BATCH] Scheduling retry', {
            batchId: activeBatchState?.batchId,
            retryCount: currentRetry + 1,
            delaySeconds,
          });
          // Update batch with retry info
          this.setState({
            ...this.state,
            activeBatch: {
              ...activeBatchState,
              retryCount: currentRetry + 1,
              retryErrors: [...(activeBatchState?.retryErrors ?? []), errorInfo],
              currentStage: 'retrying',
            },
            updatedAt: Date.now(),
          });
          // Schedule retry alarm
          await this.schedule(delaySeconds, 'onBatchAlarm', {
            batchId: activeBatchState?.batchId ?? null,
          });
        } else {
          // Max retries exceeded - notify user and fail
          this.recordStage('failed', {
            totalRetries: currentRetry,
            finalError: errorInfo.message,
          });
          logger.error('[CloudflareAgent][BATCH] Max retries exceeded, failing batch', {
            batchId: activeBatchState?.batchId,
            totalRetries: currentRetry,
          });
          // Notify user of failure
          if (activeBatchState) {
            await this.notifyUserOfFailure(activeBatchState, error);
            this.recordStage('notified');
          }
          // Clear activeBatch
          const { activeBatch: _removed, ...stateWithoutActive } = this.state;
          this.setState({
            ...stateWithoutActive,
            updatedAt: Date.now(),
          });
          // Report to State DO: batch failed
          const failedSessionId =
            this.state.chatId?.toString() ||
            this.state.userId?.toString() ||
            activeBatchState?.batchId ||
            '';
          const failedDurationMs = Date.now() - this._batchStartTime;
          const failedParams = {
            sessionId: failedSessionId,
            batchId: activeBatchState?.batchId || '',
            success: false,
            durationMs: failedDurationMs,
            error: errorInfo.message,
          };
          this.reportToStateDO('completeBatch', failedParams);
          // Update observability: batch failed
          if (activeBatchState) {
            const failedEventIds = activeBatchState.pendingMessages
              .map((m) => m.eventId)
              .filter((id) => !!id);
            if (failedEventIds.length > 0) {
              const completedAt = Date.now();
              for (const eventId of failedEventIds) {
                this.upsertObservability(eventId, {
                  status: 'error',
                  completedAt,
                  durationMs: failedDurationMs,
                  errorMessage: errorInfo.message,
                });
              }
            }
          }
          // Clear captured data on error
          this._lastResponse = undefined;
          this._lastDebugContext = undefined;
          // If pendingBatch has messages, schedule processing
          if (this.state.pendingBatch?.pendingMessages.length) {
            await this.schedule(1, 'onBatchAlarm', {
              batchId: this.state.pendingBatch.batchId,
            });
          }
        }
      }
    }
    /**
     * Process the current batch of messages
     * Combines messages and sends to LLM
     *
     * TWO-BATCH ARCHITECTURE:
     * - Only processes activeBatch (immutable during processing)
     * - pendingBatch continues collecting new messages independently
     */
    async processBatch() {
      const batch = this.state.activeBatch;
      if (!batch || batch.pendingMessages.length === 0) {
        return;
      }
      if (!transport) {
        throw new Error('Transport not configured');
      }
      // Check if first message is /clear command - process alone and discard others
      const firstMessage = batch.pendingMessages[0];
      if (!firstMessage) {
        return; // Should never happen due to length check above, but TypeScript needs this
      }
      const firstText = firstMessage.text ?? '';
      const firstCommand = firstText.split(/[\s\n]/)[0]?.toLowerCase();
      if (firstCommand === '/clear') {
        logger.info(
          '[CloudflareAgent][BATCH] Detected /clear - processing alone and discarding other messages',
          {
            batchId: batch.batchId,
            messageCount: batch.pendingMessages.length,
            discardedCount: batch.pendingMessages.length - 1,
          }
        );
        // Use originalContext from first message to preserve platform-specific data
        // Fall back to minimal context only if originalContext is missing (shouldn't happen in normal operation)
        const baseCtx = firstMessage.originalContext ?? {
          chatId: firstMessage.chatId,
          userId: firstMessage.userId,
          text: firstText,
          metadata: { requestId: batch.batchId },
        };
        // Update the text (originalContext may have original single message text)
        // Inject bot token from env for Telegram platform (token is not persisted in state for security)
        // IMPORTANT: originalContext only contains metadata (platform, requestId, parseMode, etc.)
        // Core fields (chatId, userId) must come from firstMessage directly
        const envForClear = this.env;
        const ctx = {
          ...baseCtx,
          text: firstText,
          // Core fields from firstMessage (originalContext doesn't have these)
          chatId: firstMessage.chatId,
          userId: firstMessage.userId,
          username: firstMessage.username,
          // Inject platform-specific secrets from environment
          ...(routerConfig?.platform === 'telegram' && { token: envForClear.TELEGRAM_BOT_TOKEN }),
          ...(routerConfig?.platform === 'github' && { githubToken: envForClear.GITHUB_TOKEN }),
        };
        // Initialize state with user/chat context
        await this.init(firstMessage.userId, firstMessage.chatId);
        // Process /clear command through normal handle() flow
        // This will call handleBuiltinCommand() which clears state and sends response
        await this.handle(ctx);
        // Done - other messages in batch are intentionally discarded
        return;
      }
      // Normal batch processing for non-clear messages
      // Combine messages
      const combinedText = combineBatchMessages(batch.pendingMessages);
      logger.info('[CloudflareAgent][BATCH] Combined messages', {
        combinedText,
        count: batch.pendingMessages.length,
        combinedLength: combinedText.length,
      });
      // Use originalContext from first message to preserve platform-specific data (e.g., bot token)
      // Fall back to minimal context only if originalContext is missing (shouldn't happen in normal operation)
      const baseCtx = firstMessage?.originalContext ?? {
        chatId: firstMessage?.chatId,
        userId: firstMessage?.userId,
        text: combinedText,
        metadata: { requestId: batch.batchId },
      };
      // Update the text to combined messages (originalContext has original single message text)
      // Inject bot token from env for Telegram platform (token is not persisted in state for security)
      // IMPORTANT: originalContext only contains metadata (platform, requestId, parseMode, etc.)
      // Core fields (chatId, userId) must come from firstMessage directly
      const envForBatch = this.env;
      const ctx = {
        ...baseCtx,
        text: combinedText,
        // Core fields from firstMessage (originalContext doesn't have these)
        chatId: firstMessage?.chatId,
        userId: firstMessage?.userId,
        username: firstMessage?.username,
        // Inject platform-specific secrets from environment
        ...(routerConfig?.platform === 'telegram' && { token: envForBatch.TELEGRAM_BOT_TOKEN }),
        ...(routerConfig?.platform === 'github' && { githubToken: envForBatch.GITHUB_TOKEN }),
      };
      // Initialize state with user/chat context
      await this.init(firstMessage?.userId, firstMessage?.chatId);
      // Send typing indicator
      if (transport.typing) {
        await transport.typing(ctx);
      }
      // Create thinking message rotator
      const rotator = createThinkingRotator({
        messages: config.thinkingMessages ?? getDefaultThinkingMessages(),
        interval: config.thinkingRotationInterval ?? 5000,
      });
      // Send initial thinking message
      const messageRef = await transport.send(ctx, rotator.getCurrentMessage());
      // Update activeBatch state with message ref
      this.setState({
        ...this.state,
        activeBatch: { ...batch, messageRef },
        updatedAt: Date.now(),
      });
      // Start rotation if transport supports edit
      // The rotator also serves as a heartbeat - we record lastHeartbeat on each rotation
      if (transport.edit) {
        rotator.start(async (nextMessage) => {
          try {
            // Update heartbeat FIRST - proves DO is alive regardless of edit success
            // This prevents false stuck detection when user deletes the "thinking" message
            const currentBatch = this.state.activeBatch;
            if (currentBatch) {
              this.setState({
                ...this.state,
                activeBatch: {
                  ...currentBatch,
                  lastHeartbeat: Date.now(),
                },
                updatedAt: Date.now(),
              });
              // Report heartbeat to State DO
              const heartbeatSessionId =
                this.state.chatId?.toString() ||
                this.state.userId?.toString() ||
                currentBatch.batchId ||
                '';
              const heartbeatParams = {
                sessionId: heartbeatSessionId,
                batchId: currentBatch.batchId || '',
              };
              this.reportToStateDO('heartbeat', heartbeatParams);
            }
            // Refresh typing indicator every rotation cycle (5s)
            // Telegram's typing indicator only lasts ~5s, so we refresh it
            if (transport.typing) {
              await transport.typing(ctx);
            }
            // Then attempt edit (may fail if message was deleted by user)
            await transport.edit(ctx, messageRef, nextMessage);
          } catch (err) {
            // Edit failed (message deleted, network error, etc.)
            // Heartbeat already updated above, so DO won't be marked as stuck
            logger.error(`[CloudflareAgent][BATCH] Rotator edit failed: ${err}`);
          }
        });
      }
      try {
        let response;
        // Check if routing is enabled
        const userIdStr = firstMessage?.userId?.toString();
        const useRouting = this.shouldRoute(userIdStr);
        if (useRouting) {
          // Extract platform config from environment if extractor provided
          const env = this.env;
          const platformConfig = extractPlatformConfig?.(env);
          // Build context conditionally to satisfy exactOptionalPropertyTypes
          const agentContext = {
            query: combinedText,
            platform: routerConfig?.platform || 'api',
            ...(firstMessage?.userId !== undefined && {
              userId: firstMessage.userId.toString(),
            }),
            ...(firstMessage?.chatId !== undefined && {
              chatId: firstMessage.chatId.toString(),
            }),
            ...(batch.batchId && { traceId: batch.batchId }),
            ...(platformConfig && { platformConfig }),
          };
          // Try fire-and-forget pattern first - delegate to RouterAgent via alarm
          // This prevents blockConcurrencyWhile timeout by returning immediately
          const envWithToken = env;
          // Extract admin context from ctx for debug footer
          // ctx may have adminUsername/username from TelegramContext
          const ctxWithAdmin = ctx;
          // Extract GitHub-specific context if platform is 'github'
          // GitHubContext has owner, repo, issueNumber, githubToken
          const ctxWithGitHub = ctx;
          // Build responseTarget with platform-specific fields
          const responseTarget = {
            chatId: firstMessage?.chatId?.toString() || '',
            messageRef: { messageId: messageRef },
            platform: routerConfig?.platform || 'telegram',
            // Pass admin context for debug footer (Phase 5)
            adminUsername: ctxWithAdmin.adminUsername || envWithToken.ADMIN_USERNAME,
            username: ctxWithAdmin.username || firstMessage?.username,
            // Pass platform config for parseMode and other settings
            platformConfig,
          };
          // Add platform-specific fields
          if (routerConfig?.platform === 'telegram') {
            responseTarget.botToken = envWithToken.TELEGRAM_BOT_TOKEN;
          } else if (routerConfig?.platform === 'github') {
            // GitHub requires owner/repo/issueNumber for API calls
            responseTarget.githubOwner = ctxWithGitHub.owner;
            responseTarget.githubRepo = ctxWithGitHub.repo;
            responseTarget.githubIssueNumber = ctxWithGitHub.issueNumber;
            responseTarget.githubToken = ctxWithGitHub.githubToken || envWithToken.GITHUB_TOKEN;
          }
          const scheduled = await this.scheduleRouting(combinedText, agentContext, responseTarget);
          if (scheduled) {
            // Successfully delegated to RouterAgent - it will handle response delivery
            rotator.stop();
            // Wait for any in-flight rotator callback to complete
            // RouterAgent will send final response, but rotator might still be editing
            await rotator.waitForPending();
            // Mark activeBatch as delegated (not completed yet - RouterAgent will complete it)
            this.setState({
              ...this.state,
              activeBatch: { ...batch, status: 'delegated' },
              updatedAt: Date.now(),
            });
            logger.info(
              '[CloudflareAgent][BATCH] Delegated to RouterAgent, returning immediately',
              {
                batchId: batch.batchId,
              }
            );
            return; // Exit immediately - don't block waiting for LLM response
          }
          // Fire-and-forget scheduling failed - fall back to direct chat
          logger.info(
            '[CloudflareAgent][BATCH] Fire-and-forget scheduling failed, falling back to chat()'
          );
          // Pass eventId from first batch message for D1 correlation
          response = await this.chat(combinedText, undefined, undefined, firstMessage?.eventId);
        } else {
          // Routing disabled - use direct chat
          // Pass eventId from first batch message for D1 correlation
          response = await this.chat(combinedText, undefined, undefined, firstMessage?.eventId);
        }
        rotator.stop();
        // Wait for any in-flight rotator callback to complete before sending final
        // This prevents race condition where rotator edit overwrites final response
        await rotator.waitForPending();
        // Edit thinking message with response
        if (transport.edit) {
          try {
            await transport.edit(ctx, messageRef, response);
          } catch {
            await transport.send(ctx, response);
          }
        } else {
          await transport.send(ctx, response);
        }
        // Call afterHandle hook if available
        if (hooks?.afterHandle) {
          await hooks.afterHandle(ctx, response);
        }
        // Capture response for observability (used by onBatchAlarm)
        this._lastResponse = response;
      } finally {
        rotator.stop();
      }
    }
    /**
     * Get current batch state for debugging/monitoring
     */
    getBatchState() {
      const result = {};
      if (this.state.activeBatch) {
        result.activeBatch = this.state.activeBatch;
      }
      if (this.state.pendingBatch) {
        result.pendingBatch = this.state.pendingBatch;
      }
      return result;
    }
  };
  return AgentClass;
}
/**
 * Type-safe helper to get a CloudflareChatAgent by name
 *
 * Uses the properly typed DO stub pattern - no type assertions needed.
 *
 * @example
 * ```typescript
 * const agent = getChatAgent(env.TelegramAgent, agentId);
 * await agent.handle(ctx); // Fully typed!
 * ```
 */
export function getChatAgent(namespace, name) {
  const id = namespace.idFromName(name);
  return namespace.get(id);
}
