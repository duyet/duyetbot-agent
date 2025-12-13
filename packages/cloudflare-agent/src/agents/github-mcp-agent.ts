/**
 * GitHub MCP Agent
 *
 * MCP-enabled agent for handling GitHub-related queries.
 * Connects to GitHub's remote MCP server for PR, issue, repo, action, and security information.
 *
 * This agent sits at the same level as SimpleAgent under RouterAgent,
 * providing direct routing for GitHub-specific queries.
 *
 * Extends BaseAgent and uses ExecutionContext for unified context management.
 */

import { logger } from '@duyetbot/hono-middleware';
import { getGitHubMCPPrompt, platformToOutputFormat } from '@duyetbot/prompts';
import { Agent, type Connection } from 'agents';
import { type AgentDebugInfo, type AgentResult, BaseAgent, type BaseState } from '../base/index.js';
import type { MCPServerConnection } from '../cloudflare-agent.js';
import type { AgentProvider } from '../execution/agent-provider.js';
import type { ExecutionContext } from '../execution/context.js';
import type { LLMMessage, OpenAITool, ToolCall } from '../types.js';
import { agentRegistry } from './registry.js';

// =============================================================================
// Agent Self-Registration
// =============================================================================

/**
 * Register GitHubMCPAgent with the agent registry.
 * This runs at module load time, before any agent instantiation.
 *
 * IMPORTANT: GitHubMCPAgent handles simple GitHub information queries via MCP.
 * Complex GitHub tasks (create PR, modify issues, etc.) are handled by OrchestratorAgent
 * which dispatches to GitHubWorker. This agent targets:
 * - Status checks (PR/issue status, repo info)
 * - Information lookups (list PRs, show workflow runs)
 * - NOT creation or modification tasks
 *
 * Priority is kept LOWER than orchestrator-agent (which has priority 60)
 * so that complex queries route to the right agent.
 */
agentRegistry.register({
  name: 'github-mcp-agent',
  description:
    'Handles direct GitHub MCP queries: PR/issue status, repository information, and GitHub Action workflows. For creation or modification tasks, routes to orchestrator-agent.',
  examples: [
    'what are my open PRs',
    'show PR #123 status',
    'list issues assigned to me',
    'repository information',
    'github workflow runs',
  ],
  triggers: {
    // Patterns for simple GitHub information queries
    // Notably excludes create/modify verbs to let orchestrator handle those
    patterns: [
      /\b(show|list|get|find)\s+(?:my\s+|open\s+|closed\s+|all\s+)*(pr|pull.*request|issue|repo|workflow)/i, // "show PR #123", "list issues"
      /\b(pr|pull\s*request|issue)\s+#?\d+\b/i, // "PR #123", "issue #456"
      /\b(my|assigned)\s+(?:open\s+|closed\s+|all\s+)*(pr|pull.*request|issue|repo)s?\b/i, // "my PRs", "assigned issues"
      /\bgithub\s+(action|workflow|run|status)/i, // "github workflows", "github action runs"
      /\b(pr|issue|repo)\s+(status|info|details)\b/i, // "PR status", "repo info"
    ],
    keywords: [
      'pr status',
      'issue status',
      'repo info',
      'workflow',
      'github action',
      'list prs',
      'list issues',
    ],
    // NOTE: Do NOT include 'github' category!
    // GitHubMCPAgent uses pattern/keyword matching only.
    // Classification-based 'github' category queries route to orchestrator-agent
    // which dispatches to GitHubWorker for complex tasks.
    // This agent handles simpler queries that match the patterns above.
  },
  capabilities: {
    tools: ['github_mcp'],
    complexity: 'low',
  },
  priority: 45, // Lower priority than orchestrator-agent (60) so complex queries route correctly
});

/**
 * GitHub MCP server connection details
 */
const GITHUB_MCP_SERVER: MCPServerConnection = {
  name: 'github-mcp',
  url: 'https://api.githubcopilot.com/mcp/sse',
  getAuthHeader: (env) => `Bearer ${env.GITHUB_TOKEN}`,
};

/**
 * Get system prompt for the GitHub MCP Agent at runtime
 * Generates platform-aware prompt based on context using OutputFormat
 */
function getSystemPrompt(platform?: string): string {
  const outputFormat = platformToOutputFormat(platform);
  return getGitHubMCPPrompt({ outputFormat });
}

/**
 * Tool filter for GitHub-related tools
 * Matches tools with names related to GitHub PRs, issues, repos, actions, etc.
 */
function githubToolFilter(toolName: string): boolean {
  const patterns = [
    // PR tools
    /pull.*request|pr/i,
    /pull/i,
    // Issue tools
    /issue/i,
    // Repo tools
    /repo/i,
    /repository/i,
    /branch/i,
    // Action/workflow tools
    /action/i,
    /workflow/i,
    /run/i,
    // Gist tools
    /gist/i,
    // Security tools
    /security/i,
    /alert/i,
    /dependabot/i,
    /vuln/i,
    // Search tools
    /search/i,
    /list/i,
    /get/i,
  ];
  return patterns.some((pattern) => pattern.test(toolName));
}

/**
 * Tools that benefit from result caching (GitHub data changes less frequently)
 */
const CACHEABLE_TOOL_PATTERNS = [
  /get_repository/i,
  /list_pull_requests/i,
  /list_issues/i,
  /get_user/i,
  /list_workflows/i,
];

function isCacheableTool(toolName: string): boolean {
  return CACHEABLE_TOOL_PATTERNS.some((pattern) => pattern.test(toolName));
}

/**
 * Fallback responses for when MCP tools timeout or fail
 */
const FALLBACK_RESPONSES = {
  pr: `I'm having trouble fetching pull request information right now. Please check GitHub directly for the most accurate and up-to-date PR status.`,
  issue: `I'm unable to retrieve issue information at the moment. Please visit GitHub directly to see your issues.`,
  action: `I'm experiencing difficulty accessing GitHub Actions data. Please check your workflow runs on GitHub.`,
  default: `I'm experiencing some technical difficulties with GitHub access. Please try again in a moment or check GitHub directly.`,
} as const;

function getFallbackResponse(query: string): string {
  const lower = query.toLowerCase();
  if (/pull.*request|pr\s/.test(lower)) {
    return FALLBACK_RESPONSES.pr;
  }
  if (/issue/.test(lower)) {
    return FALLBACK_RESPONSES.issue;
  }
  if (/action|workflow/.test(lower)) {
    return FALLBACK_RESPONSES.action;
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
 * GitHub MCP Agent state (stateless - no conversation history)
 * Extends BaseState with agent-specific tracking
 */
export interface GitHubMCPAgentState extends BaseState {
  /** Agent instance ID */
  agentId: string;
  /** Cached MCP tools (to avoid repeated discovery) */
  cachedTools: OpenAITool[] | undefined;
  /** When tools were last cached */
  toolsCachedAt: number | undefined;
  /** Number of queries executed */
  queriesExecuted: number;
  /** Last execution timestamp */
  lastExecutedAt: number | undefined;
  /** Cached tool execution results (for GitHub data) */
  cachedToolResults: Record<string, CachedToolResult> | undefined;
}

/**
 * Environment bindings for GitHub MCP Agent
 * Note: Actual env fields depend on the provider (OpenRouterProviderEnv, etc.)
 * This interface is kept minimal - extend with provider-specific env in your app
 */
// biome-ignore lint/suspicious/noEmptyInterface: Intentionally empty - extend with provider env
export interface GitHubMCPAgentEnv {}

/**
 * Configuration for GitHub MCP Agent
 */
export interface GitHubMCPAgentConfig<TEnv extends GitHubMCPAgentEnv> {
  /** Function to create agent provider from env */
  createProvider: (env: TEnv) => AgentProvider;
  /** Maximum tools to expose to LLM (default: 10) */
  maxTools?: number;
  /** MCP connection timeout in ms (default: 5000) - reduced to fit 30s budget */
  connectionTimeoutMs?: number;
  /** Tool execution timeout in ms (default: 5000) - reduced to fit 30s budget */
  toolTimeoutMs?: number;
  /** Global execution timeout in ms (default: 20000) - leaves 10s buffer for cleanup */
  executionTimeoutMs?: number;
  /** Result cache TTL in ms (default: 180000 = 3 min) */
  resultCacheTtlMs?: number;
  /** Maximum tool call iterations (default: 1) */
  maxToolIterations?: number;
  /** Enable detailed logging */
  debug?: boolean;
}

/**
 * Methods exposed by GitHubMCPAgent
 */
export interface GitHubMCPAgentMethods {
  execute(ctx: ExecutionContext): Promise<AgentResult>;
  getStats(): {
    queriesExecuted: number;
    lastExecutedAt: number | undefined;
  };
}

/**
 * Type for GitHubMCPAgent class
 */
export type GitHubMCPAgentClass<TEnv extends GitHubMCPAgentEnv> = typeof BaseAgent<
  TEnv,
  GitHubMCPAgentState
> & {
  new (
    ...args: ConstructorParameters<typeof Agent<TEnv, GitHubMCPAgentState>>
  ): BaseAgent<TEnv, GitHubMCPAgentState> & GitHubMCPAgentMethods;
};

/**
 * Create a GitHub MCP Agent class
 *
 * @example
 * ```typescript
 * export const GitHubMCPAgent = createGitHubMCPAgent({
 *   createProvider: (env) => createAIGatewayProvider(env),
 * });
 * ```
 */
export function createGitHubMCPAgent<TEnv extends GitHubMCPAgentEnv>(
  config: GitHubMCPAgentConfig<TEnv>
): GitHubMCPAgentClass<TEnv> {
  const debug = config.debug ?? false;
  // Reduced timeouts to fit within Cloudflare's 30s blockConcurrencyWhile limit
  // Time budget: MCP 5s + LLM ~12s + tools 5s + buffer 3s = 25s
  // With only 1 iteration, we avoid the 3x15s = 45s problem
  const connectionTimeoutMs = config.connectionTimeoutMs ?? 5000; // 5s MCP connection
  const toolTimeoutMs = config.toolTimeoutMs ?? 5000; // 5s per-tool
  const executionTimeoutMs = config.executionTimeoutMs ?? 20000; // 20s global timeout
  const resultCacheTtlMs = config.resultCacheTtlMs ?? 180000; // 3 min cache
  const maxToolIterations = config.maxToolIterations ?? 1; // 1 iteration only
  const maxTools = config.maxTools ?? 10;

  const AgentClass = class GitHubMCPAgent extends BaseAgent<TEnv, GitHubMCPAgentState> {
    override initialState: GitHubMCPAgentState = {
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
    override onStateUpdate(state: GitHubMCPAgentState, source: 'server' | Connection): void {
      if (debug) {
        logger.info('[GitHubMCPAgent] State updated', {
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
     *
     * Note: The GitHub MCP server requires Bearer token authentication in headers.
     * This is configured at the transport level (env.GITHUB_TOKEN).
     */
    async initMcp(): Promise<void> {
      if (this._mcpInitialized) {
        return;
      }

      try {
        if (debug) {
          logger.info('[GitHubMCPAgent] Connecting to MCP server', {
            url: GITHUB_MCP_SERVER.url,
          });
        }

        // Use the new addMcpServer() API which combines registerServer() + connectToServer()
        // This is the recommended approach for agents SDK v0.2.24+
        const addPromise = this.addMcpServer(
          GITHUB_MCP_SERVER.name,
          GITHUB_MCP_SERVER.url,
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
          logger.info('[GitHubMCPAgent] MCP connected successfully', {
            id: result.id,
          });
        }

        this._mcpInitialized = true;
      } catch (error) {
        logger.error('[GitHubMCPAgent] MCP connection failed', {
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
      const filteredTools = mcpTools.filter((tool) => githubToolFilter(tool.name));

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
        logger.info(`[GitHubMCPAgent] Discovered ${openAITools.length} tools`, {
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
        logger.error('[GitHubMCPAgent] JSON parse error', {
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
            logger.info('[GitHubMCPAgent] Cache hit', {
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
        logger.info('[GitHubMCPAgent] Executing MCP tool', {
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
          serverId: GITHUB_MCP_SERVER.name,
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
              logger.info('[GitHubMCPAgent] LRU eviction', {
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
            logger.info('[GitHubMCPAgent] Cached tool result', {
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
          logger.warn('[GitHubMCPAgent] Tool timed out', {
            tool: toolCall.name,
            timeoutMs: toolTimeoutMs,
          });
          return `Tool ${toolCall.name} took too long to respond. Please try a simpler query or check GitHub directly.`;
        }

        logger.error('[GitHubMCPAgent] MCP tool execution failed', {
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
     *
     * Uses ExecutionContext for unified context management including:
     * - User query from ctx.query
     * - Conversation history from ctx.conversationHistory
     * - Tracing via ctx.traceId and ctx.spanId
     * - Platform information for output formatting
     *
     * Wrapped with global timeout to prevent blockConcurrencyWhile timeout (30s limit)
     */
    async execute(ctx: ExecutionContext): Promise<AgentResult> {
      const startTime = Date.now();

      // Reset tool stats for this execution
      this.resetToolStats();

      logger.debug('[GitHubMCPAgent] Executing query', {
        traceId: ctx.traceId,
        spanId: ctx.spanId,
        queryLength: ctx.query.length,
        executionTimeoutMs,
      });

      // Wrap execution with global timeout to prevent blockConcurrencyWhile timeout
      const executeWithTimeout = async (): Promise<AgentResult> => {
        // Initialize MCP connection
        await this.initMcp();

        // Get agent provider and set it
        const env = (this as unknown as { env: TEnv }).env;
        const provider = config.createProvider(env);
        this.setProvider(provider);

        // Get available tools (filtered)
        const tools = this._mcpInitialized ? this.getMcpTools() : [];

        // Build messages (stateless - single query)
        // Generate platform-aware system prompt at runtime
        const systemPrompt = getSystemPrompt(ctx.platform);
        const messages: LLMMessage[] = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: ctx.query },
        ];

        // Execute with tool loop (tools in options for AgentProvider.chat signature)
        let response = await provider.chat(messages, tools.length > 0 ? { tools } : undefined);
        let iterations = 0;

        while (
          response.toolCalls &&
          response.toolCalls.length > 0 &&
          iterations < maxToolIterations
        ) {
          iterations++;

          if (debug) {
            logger.info(`[GitHubMCPAgent] Tool iteration ${iterations}`, {
              spanId: ctx.spanId,
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

          // Get next response (tools in options for AgentProvider.chat signature)
          response = await provider.chat(messages, { tools });
        }

        const durationMs = Date.now() - startTime;

        // Update state
        this.setState({
          ...this.state,
          agentId: this.state.agentId || ctx.traceId,
          queriesExecuted: this.state.queriesExecuted + 1,
          lastExecutedAt: Date.now(),
          updatedAt: Date.now(),
        });

        logger.debug('[GitHubMCPAgent] Query complete', {
          spanId: ctx.spanId,
          durationMs,
          toolIterations: iterations,
          responseLength: response.content.length,
          cacheHits: this.toolStats.cacheHits,
          cacheMisses: this.toolStats.cacheMisses,
          toolErrors: this.toolStats.toolErrors,
        });

        // Include debug info with tool stats
        return {
          success: true,
          content: response.content,
          durationMs,
          debug: this.buildDebugInfo(),
        };
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
          const fallbackMessage = getFallbackResponse(ctx.query);

          logger.warn('[GitHubMCPAgent] Returning fallback due to error', {
            spanId: ctx.spanId,
            durationMs,
            error: errorMessage,
            fallback: true,
            cacheHits: this.toolStats.cacheHits,
            toolErrors: this.toolStats.toolErrors,
          });

          // Return fallback as success with debug info including fallback status
          return {
            success: true,
            content: fallbackMessage,
            durationMs,
            debug: this.buildDebugInfo(true, errorMessage),
          };
        }

        // For other errors, still return as error with debug info
        logger.error('[GitHubMCPAgent] Query failed', {
          spanId: ctx.spanId,
          durationMs,
          error: errorMessage,
        });

        return {
          success: false,
          error: errorMessage,
          durationMs,
          debug: this.buildDebugInfo(false, errorMessage),
        };
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

  return AgentClass as GitHubMCPAgentClass<TEnv>;
}

/**
 * Type for GitHubMCPAgent instance
 */
export type GitHubMCPAgentInstance<TEnv extends GitHubMCPAgentEnv> = InstanceType<
  ReturnType<typeof createGitHubMCPAgent<TEnv>>
>;

// Export the tool filter for testing
export { githubToolFilter };
