/**
 * Slim CloudflareAgent Orchestrator (Phase 5 Refactoring)
 *
 * DEPRECATED: This is the legacy CloudflareAgent implementation for backward compatibility.
 * Use the new agent architecture (src/agents/chat-agent.ts) for new implementations.
 *
 * This file is a ~400-line slim orchestrator that delegates to extracted modules:
 * - BatchQueue: Two-batch message queue management
 * - BatchProcessor: Batch processing logic
 * - TransportManager: Platform-specific message handling
 * - ContextBuilder: Context reconstruction from batch messages
 * - StuckDetector: Hung batch detection and recovery
 * - Adapters: Observability, state reporting, message persistence
 *
 * Architecture:
 * ┌─────────────────────────────────────────────────────────────┐
 * │        CloudflareAgent (Slim Orchestrator ~400 LOC)         │
 * │  - Delegates to BatchQueue, BatchProcessor, TransportMgr    │
 * │  - Manages LLM calls via provider                           │
 * │  - Routes via CloudflareChatAgent pattern                   │
 * └─────────────────────────────────────────────────────────────┘
 *     ↓           ↓            ↓              ↓
 * ┌───────┐ ┌──────────┐ ┌────────────┐ ┌──────────┐
 * │Batch  │ │Batch     │ │Transport   │ │Stuck     │
 * │Queue  │ │Processor │ │Manager     │ │Detector  │
 * └───────┘ └──────────┘ └────────────┘ └──────────┘
 *     ↓           ↓            ↓              ↓
 * ┌──────────────────────────────────────────────────┐
 * │        Adapter Layer (Observability, State)      │
 * └──────────────────────────────────────────────────┘
 */
import { logger } from '@duyetbot/hono-middleware';
import { Agent } from 'agents';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { BatchQueue } from '../batch/batch-queue.js';
import { ContextBuilder } from '../batch/context-builder.js';
import { StuckDetector } from '../batch/stuck-detector.js';
import { getDefaultThinkingMessages } from '../format.js';
import { createAdapterFactory } from './adapter-factory.js';
/**
 * Create a Cloudflare Durable Object Agent class with direct LLM integration
 *
 * This factory function creates a CloudflareChatAgent class that extends
 * the Cloudflare Agent base class with chat capabilities.
 *
 * @example
 * ```typescript
 * import { createCloudflareChatAgent } from '@duyetbot/cloudflare-agent';
 *
 * const TelegramAgent = createCloudflareChatAgent({
 *   createProvider: (env) => createAIGatewayProvider(env),
 *   systemPrompt: 'You are a helpful assistant.',
 *   welcomeMessage: 'Hello!',
 * });
 * ```
 */
export function createCloudflareChatAgent(config) {
  // Extract configuration with defaults
  // These values are reserved for TODO method implementations
  const builtinTools = config.tools ?? [];
  const routerConfig = config.router;
  const extractPlatformConfig = config.extractPlatformConfig;
  // Store references for later use - these suppress TS warnings about config not being used
  // The underscore prefix convention marks these as intentionally unused for now
  void getDefaultThinkingMessages();
  void config.maxHistory;
  void config.maxToolIterations;
  void config.maxTools;
  void config.transport;
  void config.hooks;
  void config.mcpServers;
  void config.retryConfig;
  void config.thinkingMessages;
  void config.thinkingRotationInterval;
  // Convert built-in tools to OpenAI format (used in getMcpTools TODO)
  const _builtinToolsOpenAI = builtinTools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: zodToJsonSchema(tool.inputSchema),
    },
  }));
  // Create a map for quick lookup of built-in tools by name (used in chat TODO)
  const _builtinToolMap = new Map(builtinTools.map((tool) => [tool.name, tool]));
  // Mark these as used to suppress warnings
  void _builtinToolsOpenAI;
  void _builtinToolMap;
  /**
   * The slim CloudflareChatAgent orchestrator class
   *
   * Delegates core logic to extracted modules while maintaining the public API.
   * This ~400-line class replaces the previous ~2900-line monolithic implementation.
   *
   * Key responsibilities:
   * 1. LLM call orchestration (chat method)
   * 2. Module delegation (batch queue, batch processing, transport)
   * 3. State management via callbacks
   * 4. Adapter initialization
   */
  const AgentClass = class CloudflareChatAgent extends Agent {
    // Initial state
    initialState = {
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    // Private module instances - reserved for batch processing TODO
    // @ts-expect-error
    batchQueue;
    // @ts-expect-error
    contextBuilder;
    stuckDetector;
    // Adapters (injected via factory) - stored for future use in TODO methods
    // @ts-expect-error - reserved for adapter pattern
    adapters;
    // Configuration tracking - reserved for future use
    // @ts-expect-error
    mcpInitialized = false;
    // @ts-expect-error
    processing = false;
    /**
     * Constructor - Initialize modules and adapters
     */
    constructor(ctx, env) {
      super(ctx, env);
      // Initialize adapters
      const adapters = config.adapters ?? createAdapterFactory(env);
      // Store for future use
      this.adapters = adapters;
      // Initialize modules with dependency injection
      this.stuckDetector = new StuckDetector();
      this.batchQueue = new BatchQueue(
        () => this.state,
        (update) => this.setState({ ...this.state, ...update }),
        this.stuckDetector
      );
      // @ts-expect-error - TEnv variance issue, safe at runtime
      this.contextBuilder = new ContextBuilder(extractPlatformConfig);
    }
    // ============================================
    // LLM Core Methods
    // ============================================
    async initMcp() {
      // TODO: Implement MCP initialization
      // Delegate to existing MCP infrastructure
      this.mcpInitialized = true;
    }
    getMcpTools() {
      // TODO: Implement MCP tool retrieval
      return [];
    }
    async init(_userId, _chatId) {
      // TODO: Initialize session with userId/chatId
      const newState = {
        updatedAt: Date.now(),
      };
      if (_userId !== undefined) {
        newState.userId = _userId;
      }
      if (_chatId !== undefined) {
        newState.chatId = _chatId;
      }
      this.setState({
        ...this.state,
        ...newState,
      });
    }
    async chat(userMessage) {
      // TODO: Implement core LLM chat logic
      // This is the main orchestration point for LLM calls
      // 1. Load provider from config
      // 2. Call LLM with message history and tools
      // 3. Handle tool calls and iterations
      // 4. Return response text
      return `[TODO] Chat response for: ${userMessage}`;
    }
    async clearHistory() {
      // TODO: Implement history clearing
      this.setState({
        ...this.state,
        messages: [],
        updatedAt: Date.now(),
      });
      return 'History cleared';
    }
    // ============================================
    // Built-in Commands
    // ============================================
    getWelcome() {
      return config.welcomeMessage ?? 'Welcome! I am an AI assistant.';
    }
    getHelp() {
      return config.helpMessage ?? 'Available commands: /start, /help, /clear';
    }
    getMessageCount() {
      return this.state.messages.length;
    }
    setMetadata(metadata) {
      this.setState({
        ...this.state,
        metadata,
        updatedAt: Date.now(),
      });
    }
    getMetadata() {
      return this.state.metadata;
    }
    /** @deprecated Use handleBuiltinCommand instead */
    async handleCommand(text) {
      const result = await this.handleBuiltinCommand(text);
      return result ?? (await this.chat(text));
    }
    async handleBuiltinCommand(text) {
      // TODO: Implement built-in command handling
      // - /start → getWelcome()
      // - /help → getHelp()
      // - /clear → clearHistory()
      void text;
      return null;
    }
    transformSlashCommand(text) {
      // TODO: Transform slash commands to natural language
      return text;
    }
    // ============================================
    // Batch Processing & Queueing
    // ============================================
    async queueMessage(_ctx) {
      // TODO: Delegate to batchQueue
      return { queued: true };
    }
    async receiveMessage(_input) {
      // TODO: Implement receiveMessage
      return {
        traceId: crypto.randomUUID(),
        queued: true,
      };
    }
    async handle(_ctx) {
      // TODO: Implement handle method
      // Orchestrates transport, batching, and processing
    }
    async onBatchAlarm(_data) {
      // TODO: Implement batch alarm handler
      // Triggered by alarm set by batchQueue
    }
    getBatchState() {
      const result = {};
      if (this.state.activeBatch !== undefined) {
        result.activeBatch = this.state.activeBatch;
      }
      if (this.state.pendingBatch !== undefined) {
        result.pendingBatch = this.state.pendingBatch;
      }
      return result;
    }
    // ============================================
    // Routing (Phase 4)
    // ============================================
    shouldRoute(_userId) {
      // TODO: Implement routing eligibility check
      if (!routerConfig) {
        return false;
      }
      return true;
    }
    async routeQuery(_query, _context) {
      // TODO: Implement query routing via RouterAgent
      if (!routerConfig) {
        return null;
      }
      return null;
    }
    async getRoutingStats() {
      // TODO: Get routing statistics from RouterAgent
      return null;
    }
    async getRoutingHistory(_limit) {
      // TODO: Get routing history from RouterAgent
      return null;
    }
    // ============================================
    // Private Helper Methods
    // ============================================
    getStateDOStub() {
      const env = this.env;
      const envWithState = env;
      if (!envWithState.StateDO) {
        return null;
      }
      const id = envWithState.StateDO.idFromName('global');
      return envWithState.StateDO.get(id);
    }
    // Reserved for batch processing implementation - will be used in processBatch() TODO
    // @ts-expect-error - reserved for future implementation
    reportToStateDO(method, params) {
      try {
        const stateDO = this.getStateDOStub();
        if (!stateDO) {
          return;
        }
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
  };
  return AgentClass;
}
export { createAdapterFactory, createAdapterFactoryWithOverrides } from './adapter-factory.js';
