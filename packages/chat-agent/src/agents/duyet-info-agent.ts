/**
 * Duyet Info Agent
 *
 * MCP-enabled agent for handling queries about Duyet's blog and personal information.
 * Combines blog content discovery with personal info (CV, contact, skills, etc.)
 *
 * This agent sits at the same level as SimpleAgent under RouterAgent,
 * providing direct routing for Duyet-specific queries.
 */

import { logger } from '@duyetbot/hono-middleware';
import { getDuyetInfoPrompt, platformToOutputFormat } from '@duyetbot/prompts';
import { Agent, type Connection } from 'agents';
import type { MCPServerConnection } from '../cloudflare-agent.js';
import type { LLMMessage, LLMProvider, OpenAITool, ToolCall } from '../types.js';
import {
  type AgentContext,
  type AgentDebugInfo,
  AgentMixin,
  type AgentResult,
} from './base-agent.js';
import { agentRegistry } from './registry.js';

// =============================================================================
// Agent Self-Registration
// =============================================================================

/**
 * Register DuyetInfoAgent with the agent registry.
 * This runs at module load time, before any agent instantiation.
 *
 * Patterns are designed to NOT match "@duyetbot" bot mentions.
 * The query "Latest AI News?" should NOT route here because "latest" alone
 * doesn't indicate a Duyet query - it needs explicit "duyet" context.
 */
agentRegistry.register({
  name: 'duyet-info-agent',
  description:
    'Answers questions about Duyet (the person), his blog posts, CV, skills, experience, and contact information. Only handles queries explicitly about Duyet or his personal content.',
  examples: [
    'who is duyet',
    'tell me about duyet',
    "duyet's blog posts",
    "duyet's latest articles",
    'what is your CV',
    'your skills and experience',
    'your contact info',
    'duyet.net',
  ],
  triggers: {
    // Specific patterns - won't match "@duyetbot" bot mentions
    patterns: [
      /\b(who\s+(is|are)\s+duyet)\b/i, // "who is duyet"
      /\bduyet'?s?\s+(blog|cv|resume|bio|posts?|articles?|skills?|experience)\b/i, // "duyet's blog"
      /\b(about|tell\s+me\s+about)\s+duyet\b/i, // "about duyet"
      /\bblog\.duyet\b/i, // "blog.duyet.net"
      /\bduyet\.net\b/i, // "duyet.net"
      // "your X" patterns for personal info queries (when bot is addressed directly)
      /\b(your)\s+(cv|resume|bio|experience|skills?|education|contact)\b/i,
    ],
    keywords: [
      'cv',
      'resume',
      'about me',
      'contact info',
      'bio',
      'my experience',
      'my skills',
      'my education',
    ],
    categories: ['duyet'],
  },
  capabilities: {
    tools: ['duyet_mcp'],
    complexity: 'low',
  },
  priority: 50, // Medium priority - below research (60) to avoid catching "latest news"
});

/**
 * Duyet MCP server connection details
 */
const DUYET_MCP_SERVER: MCPServerConnection = {
  name: 'duyet-mcp',
  url: 'https://mcp.duyet.net/sse',
};

/**
 * Get system prompt for the Duyet Info Agent at runtime
 * Generates platform-aware prompt based on context using OutputFormat
 */
function getSystemPrompt(platform?: string): string {
  const outputFormat = platformToOutputFormat(platform);
  return getDuyetInfoPrompt({ outputFormat });
}

/**
 * Combined tool filter for blog and info related tools
 * Matches tools with names related to either blog content or personal info
 */
function duyetToolFilter(toolName: string): boolean {
  const patterns = [
    // Blog tools
    /blog/i,
    /post/i,
    /article/i,
    /tag/i,
    /categor/i, // matches category, categories
    /feed/i,
    /rss/i,
    /content/i,
    /search.*blog/i,
    /latest/i,
    /recent/i,
    // Info tools
    /about/i,
    /cv/i,
    /contact/i,
    /info/i,
    /bio/i,
    /profile/i,
    /experience/i,
    /skill/i,
    /education/i,
    /certificate/i,
  ];
  return patterns.some((pattern) => pattern.test(toolName));
}

/**
 * Tools that benefit from result caching (blog data changes infrequently)
 */
const CACHEABLE_TOOL_PATTERNS = [
  /get_latest/i,
  /get_recent/i,
  /list_posts/i,
  /get_blog/i,
  /get_posts/i,
  /feed/i,
];

function isCacheableTool(toolName: string): boolean {
  return CACHEABLE_TOOL_PATTERNS.some((pattern) => pattern.test(toolName));
}

/**
 * Fallback responses for when MCP tools timeout or fail
 */
const FALLBACK_RESPONSES = {
  blog: `I'm having trouble fetching the latest blog posts right now. You can visit blog.duyet.net directly for the most recent content.`,
  info: `I'm unable to retrieve that information at the moment. Please visit duyet.net for details.`,
  default: `I'm experiencing some technical difficulties. Please try again in a moment.`,
} as const;

function getFallbackResponse(query: string): string {
  const lower = query.toLowerCase();
  if (/blog|post|article|latest|recent/.test(lower)) {
    return FALLBACK_RESPONSES.blog;
  }
  if (/cv|resume|contact|skill|experience|about/.test(lower)) {
    return FALLBACK_RESPONSES.info;
  }
  return FALLBACK_RESPONSES.default;
}

/**
 * Cached tool result entry
 */
interface CachedToolResult {
  result: string;
  cachedAt: number;
}

/**
 * Duyet Info Agent state (stateless - no conversation history)
 */
export interface DuyetInfoAgentState {
  /** Agent instance ID */
  agentId: string;
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
  /** Cached MCP tools (to avoid repeated discovery) */
  cachedTools: OpenAITool[] | undefined;
  /** When tools were last cached */
  toolsCachedAt: number | undefined;
  /** Number of queries executed */
  queriesExecuted: number;
  /** Last execution timestamp */
  lastExecutedAt: number | undefined;
  /** Cached tool execution results (for blog data) */
  cachedToolResults: Record<string, CachedToolResult> | undefined;
}

/**
 * Environment bindings for Duyet Info Agent
 * Note: Actual env fields depend on the provider (OpenRouterProviderEnv, etc.)
 * This interface is kept minimal - extend with provider-specific env in your app
 */
// biome-ignore lint/suspicious/noEmptyInterface: Intentionally empty - extend with provider env
export interface DuyetInfoAgentEnv {}

/**
 * Configuration for Duyet Info Agent
 */
export interface DuyetInfoAgentConfig<TEnv extends DuyetInfoAgentEnv> {
  /** Function to create LLM provider from env and optional context */
  createProvider: (env: TEnv, context?: AgentContext) => LLMProvider;
  /** Maximum tools to expose to LLM (default: 10) */
  maxTools?: number;
  /** MCP connection timeout in ms (default: 5000) - reduced to fit 30s budget */
  connectionTimeoutMs?: number;
  /** Tool execution timeout in ms (default: 8000) - reduced to fit 30s budget */
  toolTimeoutMs?: number;
  /** Global execution timeout in ms (default: 25000) - leaves 5s buffer for cleanup */
  executionTimeoutMs?: number;
  /** Result cache TTL in ms (default: 180000 = 3 min) */
  resultCacheTtlMs?: number;
  /** Maximum tool call iterations (default: 3) */
  maxToolIterations?: number;
  /** Enable detailed logging */
  debug?: boolean;
}

/**
 * Methods exposed by DuyetInfoAgent
 */
export interface DuyetInfoAgentMethods {
  execute(query: string, context: AgentContext): Promise<AgentResult>;
  getStats(): {
    queriesExecuted: number;
    lastExecutedAt: number | undefined;
  };
}

/**
 * Type for DuyetInfoAgent class
 */
export type DuyetInfoAgentClass<TEnv extends DuyetInfoAgentEnv> = typeof Agent<
  TEnv,
  DuyetInfoAgentState
> & {
  new (
    ...args: ConstructorParameters<typeof Agent<TEnv, DuyetInfoAgentState>>
  ): Agent<TEnv, DuyetInfoAgentState> & DuyetInfoAgentMethods;
};

/**
 * Create a Duyet Info Agent class
 *
 * @example
 * ```typescript
 * export const DuyetInfoAgent = createDuyetInfoAgent({
 *   createProvider: (env) => createAIGatewayProvider(env),
 * });
 * ```
 */
export function createDuyetInfoAgent<TEnv extends DuyetInfoAgentEnv>(
  config: DuyetInfoAgentConfig<TEnv>
): DuyetInfoAgentClass<TEnv> {
  const debug = config.debug ?? false;
  // Reduced timeouts to fit within Cloudflare's 30s blockConcurrencyWhile limit
  // Time budget: MCP 5s + LLM ~12s + tools 5s + buffer 3s = 25s
  // With only 1 iteration, we avoid the 3x15s = 45s problem
  const connectionTimeoutMs = config.connectionTimeoutMs ?? 5000; // 5s MCP connection
  const toolTimeoutMs = config.toolTimeoutMs ?? 5000; // 5s per-tool (was 8s)
  const executionTimeoutMs = config.executionTimeoutMs ?? 20000; // 20s global timeout (was 25s)
  const resultCacheTtlMs = config.resultCacheTtlMs ?? 180000; // 3 min cache
  const maxToolIterations = config.maxToolIterations ?? 1; // 1 iteration only (was 3)
  const maxTools = config.maxTools ?? 10;

  const AgentClass = class DuyetInfoAgent extends Agent<TEnv, DuyetInfoAgentState> {
    override initialState: DuyetInfoAgentState = {
      agentId: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      cachedTools: undefined,
      toolsCachedAt: undefined,
      queriesExecuted: 0,
      lastExecutedAt: undefined,
      cachedToolResults: undefined,
    };

    private _mcpInitialized = false;

    /**
     * Handle state updates
     */
    override onStateUpdate(state: DuyetInfoAgentState, source: 'server' | Connection): void {
      if (debug) {
        logger.info('[DuyetInfoAgent] State updated', {
          source,
          queriesExecuted: state.queriesExecuted,
          hasCachedTools: !!state.cachedTools,
        });
      }
    }

    /**
     * Initialize MCP connection
     * Uses the new addMcpServer() API (agents SDK v0.2.24+) which handles
     * registration, connection, and discovery in one call
     */
    async initMcp(): Promise<void> {
      if (this._mcpInitialized) {
        return;
      }

      try {
        if (debug) {
          logger.info('[DuyetInfoAgent] Connecting to MCP server', {
            url: DUYET_MCP_SERVER.url,
          });
        }

        // Use the new addMcpServer() API which combines registerServer() + connectToServer()
        // This is the recommended approach for agents SDK v0.2.24+
        const addPromise = this.addMcpServer(
          DUYET_MCP_SERVER.name,
          DUYET_MCP_SERVER.url,
          '', // callbackHost - empty string for non-OAuth servers
          '' // agentsPrefix - empty string uses default
        );

        // Add timeout to prevent hanging connections
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error(`MCP connection timeout after ${connectionTimeoutMs}ms`)),
            connectionTimeoutMs
          );
        });

        const result = await Promise.race([addPromise, timeoutPromise]);

        if (debug) {
          logger.info('[DuyetInfoAgent] MCP connected successfully', {
            id: result.id,
          });
        }

        this._mcpInitialized = true;
      } catch (error) {
        logger.error('[DuyetInfoAgent] MCP connection failed', {
          error: error instanceof Error ? error.message : String(error),
        });
        // Don't throw - we'll fall back to LLM-only execution
      }
    }

    /**
     * Get filtered MCP tools in OpenAI format
     */
    getMcpTools(): OpenAITool[] {
      // Check if we have cached tools (cache for 5 minutes)
      const CACHE_TTL = 5 * 60 * 1000;
      if (
        this.state.cachedTools &&
        this.state.toolsCachedAt &&
        Date.now() - this.state.toolsCachedAt < CACHE_TTL
      ) {
        return this.state.cachedTools;
      }

      const mcpTools = this.mcp.listTools();
      const filteredTools = mcpTools.filter((tool) => duyetToolFilter(tool.name));

      // Convert to OpenAI format
      let openAITools = filteredTools.map((tool) => ({
        type: 'function' as const,
        function: {
          name: tool.name,
          description: tool.description || '',
          parameters: tool.inputSchema as Record<string, unknown>,
        },
      }));

      // Apply max tools limit
      if (openAITools.length > maxTools) {
        openAITools = openAITools.slice(0, maxTools);
      }

      // Cache the tools
      this.setState({
        ...this.state,
        cachedTools: openAITools,
        toolsCachedAt: Date.now(),
      });

      if (debug) {
        logger.info(`[DuyetInfoAgent] Discovered ${openAITools.length} tools`, {
          toolNames: openAITools.map((t) => t.function.name),
        });
      }

      return openAITools;
    }

    /**
     * Get cache key for a tool call
     */
    private getCacheKey(toolName: string, args: Record<string, unknown>): string {
      return `${toolName}:${JSON.stringify(args)}`;
    }

    /**
     * Tool execution result with stats for debugging
     */
    private toolStats = {
      cacheHits: 0,
      cacheMisses: 0,
      toolTimeouts: 0,
      timedOutTools: [] as string[],
      toolsUsed: [] as string[],
      toolErrors: 0,
      lastToolError: undefined as string | undefined,
    };

    /**
     * Reset tool stats for a new execution
     */
    private resetToolStats(): void {
      this.toolStats = {
        cacheHits: 0,
        cacheMisses: 0,
        toolTimeouts: 0,
        timedOutTools: [],
        toolsUsed: [],
        toolErrors: 0,
        lastToolError: undefined,
      };
    }

    /**
     * Execute an MCP tool call with timeout and caching
     */
    async executeMcpTool(toolCall: ToolCall): Promise<string> {
      let args: Record<string, unknown>;
      try {
        args = JSON.parse(toolCall.arguments);
      } catch {
        const errorMsg = `Invalid JSON arguments for ${toolCall.name}`;
        logger.error('[DuyetInfoAgent] JSON parse error', {
          tool: toolCall.name,
          arguments: toolCall.arguments.slice(0, 200),
        });
        this.toolStats.toolErrors++;
        this.toolStats.lastToolError = errorMsg;
        return `Error: ${errorMsg}`;
      }
      const cacheKey = this.getCacheKey(toolCall.name, args);
      const isCacheable = isCacheableTool(toolCall.name);

      // Track tool usage
      this.toolStats.toolsUsed.push(toolCall.name);

      // Check cache for cacheable tools
      if (isCacheable && this.state.cachedToolResults) {
        const cached = this.state.cachedToolResults[cacheKey];
        if (cached && Date.now() - cached.cachedAt < resultCacheTtlMs) {
          this.toolStats.cacheHits++;
          if (debug) {
            logger.info('[DuyetInfoAgent] Cache hit', {
              tool: toolCall.name,
              cacheAge: Date.now() - cached.cachedAt,
            });
          }
          return cached.result;
        }
      }

      // Cache miss (or not cacheable)
      if (isCacheable) {
        this.toolStats.cacheMisses++;
      }

      if (debug) {
        logger.info('[DuyetInfoAgent] Executing MCP tool', {
          tool: toolCall.name,
          args,
          isCacheable,
          timeoutMs: toolTimeoutMs,
        });
      }

      try {
        // Create timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error(`Tool ${toolCall.name} timed out after ${toolTimeoutMs}ms`)),
            toolTimeoutMs
          );
        });

        // Execute with timeout using Promise.race
        const resultPromise = this.mcp.callTool({
          serverId: DUYET_MCP_SERVER.name,
          name: toolCall.name,
          arguments: args,
        });

        const result = await Promise.race([resultPromise, timeoutPromise]);

        // Format result as string
        const formattedResult =
          typeof result === 'string' ? result : JSON.stringify(result, null, 2);

        // Cache successful results for cacheable tools
        if (isCacheable) {
          const currentCache = this.state.cachedToolResults ?? {};
          const newCache = { ...currentCache };
          const cacheEntries = Object.keys(newCache);

          // LRU eviction: remove oldest entry if at capacity
          if (cacheEntries.length >= 20 && cacheEntries.length > 0) {
            const oldestKey = cacheEntries.reduce((oldest, key) => {
              const currentEntry = newCache[key];
              const oldestEntry = newCache[oldest];
              if (!currentEntry || !oldestEntry) {
                return oldest;
              }
              return currentEntry.cachedAt < oldestEntry.cachedAt ? key : oldest;
            });
            delete newCache[oldestKey];
            if (debug) {
              logger.info('[DuyetInfoAgent] LRU eviction', {
                evicted: oldestKey,
              });
            }
          }

          newCache[cacheKey] = {
            result: formattedResult,
            cachedAt: Date.now(),
          };

          this.setState({
            ...this.state,
            cachedToolResults: newCache,
          });

          if (debug) {
            logger.info('[DuyetInfoAgent] Cached tool result', {
              tool: toolCall.name,
              cacheSize: Object.keys(newCache).length,
            });
          }
        }

        return formattedResult;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const isTimeout = errorMsg.includes('timed out');

        // Track all errors
        this.toolStats.toolErrors++;
        this.toolStats.lastToolError = `${toolCall.name}: ${errorMsg.slice(0, 100)}`;

        if (isTimeout) {
          this.toolStats.toolTimeouts++;
          this.toolStats.timedOutTools.push(toolCall.name);
          logger.warn('[DuyetInfoAgent] Tool timed out', {
            tool: toolCall.name,
            timeoutMs: toolTimeoutMs,
          });
          return `Tool ${toolCall.name} took too long to respond. Please try a simpler query or check the source directly.`;
        }

        logger.error('[DuyetInfoAgent] MCP tool execution failed', {
          tool: toolCall.name,
          error: errorMsg,
        });
        return `Error executing tool ${toolCall.name}: ${errorMsg}`;
      }
    }

    /**
     * Build debug info from current tool stats
     * Builds object conditionally to satisfy exactOptionalPropertyTypes
     */
    private buildDebugInfo(fallback = false, originalError?: string): AgentDebugInfo {
      // Build metadata object conditionally (exactOptionalPropertyTypes)
      const metadata: AgentDebugInfo['metadata'] = {};

      if (fallback) {
        metadata.fallback = fallback;
      }
      if (originalError) {
        metadata.originalError = originalError;
      }
      if (this.toolStats.cacheHits > 0) {
        metadata.cacheHits = this.toolStats.cacheHits;
      }
      if (this.toolStats.cacheMisses > 0) {
        metadata.cacheMisses = this.toolStats.cacheMisses;
      }
      if (this.toolStats.toolTimeouts > 0) {
        metadata.toolTimeouts = this.toolStats.toolTimeouts;
      }
      if (this.toolStats.timedOutTools.length > 0) {
        metadata.timedOutTools = this.toolStats.timedOutTools;
      }
      if (this.toolStats.toolErrors > 0) {
        metadata.toolErrors = this.toolStats.toolErrors;
      }
      if (this.toolStats.lastToolError) {
        metadata.lastToolError = this.toolStats.lastToolError;
      }

      const debugInfo: AgentDebugInfo = {};

      if (this.toolStats.toolsUsed.length > 0) {
        debugInfo.tools = this.toolStats.toolsUsed;
      }

      // Only include metadata if it has any properties
      if (Object.keys(metadata).length > 0) {
        debugInfo.metadata = metadata;
      }

      return debugInfo;
    }

    /**
     * Execute a query with MCP tools
     * Wrapped with global timeout to prevent blockConcurrencyWhile timeout (30s limit)
     */
    async execute(query: string, context: AgentContext): Promise<AgentResult> {
      const startTime = Date.now();
      const traceId = context.traceId ?? AgentMixin.generateId('trace');

      // Reset tool stats for this execution
      this.resetToolStats();

      AgentMixin.log('DuyetInfoAgent', 'Executing query', {
        traceId,
        queryLength: query.length,
        executionTimeoutMs,
      });

      // Wrap execution with global timeout to prevent blockConcurrencyWhile timeout
      const executeWithTimeout = async (): Promise<AgentResult> => {
        // Initialize MCP connection
        await this.initMcp();

        // Get LLM provider (pass context for platformConfig credentials)
        const env = (this as unknown as { env: TEnv }).env;
        const provider = config.createProvider(env, context);

        // Get available tools (filtered)
        const tools = this._mcpInitialized ? this.getMcpTools() : [];

        // Build messages (stateless - single query)
        // Generate platform-aware system prompt at runtime
        const systemPrompt = getSystemPrompt(context.platform);
        const messages: LLMMessage[] = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query },
        ];

        // Execute with tool loop
        let response = await provider.chat(messages, tools.length > 0 ? tools : undefined);
        let iterations = 0;

        while (
          response.toolCalls &&
          response.toolCalls.length > 0 &&
          iterations < maxToolIterations
        ) {
          iterations++;

          if (debug) {
            logger.info(`[DuyetInfoAgent] Tool iteration ${iterations}`, {
              toolCalls: response.toolCalls.map((tc) => tc.name),
            });
          }

          // Add assistant message with tool calls
          messages.push({
            role: 'assistant',
            content: response.content || '',
          });

          // Execute each tool call and add results
          for (const toolCall of response.toolCalls) {
            const result = await this.executeMcpTool(toolCall);
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              name: toolCall.name,
              content: result,
            });
          }

          // Get next response
          response = await provider.chat(messages, tools);
        }

        const durationMs = Date.now() - startTime;

        // Update state
        this.setState({
          ...this.state,
          agentId: this.state.agentId || traceId,
          queriesExecuted: this.state.queriesExecuted + 1,
          lastExecutedAt: Date.now(),
          updatedAt: Date.now(),
        });

        AgentMixin.log('DuyetInfoAgent', 'Query complete', {
          traceId,
          durationMs,
          toolIterations: iterations,
          responseLength: response.content.length,
          toolStats: this.toolStats,
        });

        // Include debug info with tool stats
        return AgentMixin.createResult(true, response.content, durationMs, {
          debug: this.buildDebugInfo(),
        });
      };

      try {
        // Race between execution and global timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error(`Execution timeout after ${executionTimeoutMs}ms`)),
            executionTimeoutMs
          );
        });

        return await Promise.race([executeWithTimeout(), timeoutPromise]);
      } catch (error) {
        const durationMs = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Check if it's a timeout or MCP-related error - return fallback instead of error
        const isRecoverableError =
          errorMessage.includes('timeout') ||
          errorMessage.includes('Timeout') ||
          errorMessage.includes('MCP') ||
          errorMessage.includes('Gateway') ||
          errorMessage.includes('408');

        if (isRecoverableError) {
          const fallbackMessage = getFallbackResponse(query);

          logger.warn('[DuyetInfoAgent] Returning fallback due to error', {
            traceId,
            durationMs,
            error: errorMessage,
            fallback: true,
            toolStats: this.toolStats,
          });

          // Return fallback as success with debug info including fallback status
          return AgentMixin.createResult(true, fallbackMessage, durationMs, {
            debug: this.buildDebugInfo(true, errorMessage),
          });
        }

        // For other errors, still return as error with debug info
        AgentMixin.logError('DuyetInfoAgent', 'Query failed', error, {
          traceId,
          durationMs,
        });

        const errorResult = AgentMixin.createErrorResult(error, durationMs);
        errorResult.debug = this.buildDebugInfo(false, errorMessage);
        return errorResult;
      }
    }

    /**
     * Get agent statistics
     */
    getStats(): {
      queriesExecuted: number;
      lastExecutedAt: number | undefined;
    } {
      return {
        queriesExecuted: this.state.queriesExecuted,
        lastExecutedAt: this.state.lastExecutedAt,
      };
    }
  };

  return AgentClass as DuyetInfoAgentClass<TEnv>;
}

/**
 * Type for DuyetInfoAgent instance
 */
export type DuyetInfoAgentInstance<TEnv extends DuyetInfoAgentEnv> = InstanceType<
  ReturnType<typeof createDuyetInfoAgent<TEnv>>
>;

// Export the tool filter for testing
export { duyetToolFilter };
