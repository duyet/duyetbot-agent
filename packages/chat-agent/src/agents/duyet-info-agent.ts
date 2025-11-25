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
import { getDuyetInfoPrompt } from '@duyetbot/prompts';
import { Agent, type Connection } from 'agents';
import type { MCPServerConnection } from '../cloudflare-agent.js';
import type { LLMMessage, LLMProvider, OpenAITool, ToolCall } from '../types.js';
import { type AgentContext, AgentMixin, type AgentResult } from './base-agent.js';

/**
 * Duyet MCP server connection details
 */
const DUYET_MCP_SERVER: MCPServerConnection = {
  name: 'duyet-mcp',
  url: 'https://mcp.duyet.net/sse',
};

/**
 * System prompt for the Duyet Info Agent
 * Imported from centralized @duyetbot/prompts package
 */
const DUYET_INFO_SYSTEM_PROMPT = getDuyetInfoPrompt();

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
}

/**
 * Environment bindings for Duyet Info Agent
 */
export interface DuyetInfoAgentEnv {
  AI_GATEWAY_ACCOUNT_ID?: string;
  AI_GATEWAY_ID?: string;
  ANTHROPIC_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
}

/**
 * Configuration for Duyet Info Agent
 */
export interface DuyetInfoAgentConfig<TEnv extends DuyetInfoAgentEnv> {
  /** Function to create LLM provider from env */
  createProvider: (env: TEnv) => LLMProvider;
  /** Maximum tools to expose to LLM (default: 10) */
  maxTools?: number;
  /** Connection timeout in ms (default: 10000) */
  connectionTimeoutMs?: number;
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
  const connectionTimeoutMs = config.connectionTimeoutMs ?? 10000;
  const maxToolIterations = config.maxToolIterations ?? 3;
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

        // Add timeout to prevent hanging connections
        const connectPromise = this.mcp.connect(DUYET_MCP_SERVER.url, {});
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error(`MCP connection timeout after ${connectionTimeoutMs}ms`)),
            connectionTimeoutMs
          );
        });

        await Promise.race([connectPromise, timeoutPromise]);

        if (debug) {
          logger.info('[DuyetInfoAgent] MCP connected successfully');
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
     * Execute an MCP tool call
     */
    async executeMcpTool(toolCall: ToolCall): Promise<string> {
      try {
        const args = JSON.parse(toolCall.arguments);

        if (debug) {
          logger.info('[DuyetInfoAgent] Executing MCP tool', {
            tool: toolCall.name,
            args,
          });
        }

        const result = await this.mcp.callTool({
          serverId: DUYET_MCP_SERVER.name,
          name: toolCall.name,
          arguments: args,
        });

        // Format result as string
        if (typeof result === 'string') {
          return result;
        }
        return JSON.stringify(result, null, 2);
      } catch (error) {
        logger.error('[DuyetInfoAgent] MCP tool execution failed', {
          tool: toolCall.name,
          error: error instanceof Error ? error.message : String(error),
        });
        return `Error executing tool ${toolCall.name}: ${error instanceof Error ? error.message : String(error)}`;
      }
    }

    /**
     * Execute a query with MCP tools
     */
    async execute(query: string, context: AgentContext): Promise<AgentResult> {
      const startTime = Date.now();
      const traceId = context.traceId ?? AgentMixin.generateId('trace');

      AgentMixin.log('DuyetInfoAgent', 'Executing query', {
        traceId,
        queryLength: query.length,
      });

      try {
        // Initialize MCP connection
        await this.initMcp();

        // Get LLM provider
        const env = (this as unknown as { env: TEnv }).env;
        const provider = config.createProvider(env);

        // Get available tools (filtered)
        const tools = this._mcpInitialized ? this.getMcpTools() : [];

        // Build messages (stateless - single query)
        const messages: LLMMessage[] = [
          { role: 'system', content: DUYET_INFO_SYSTEM_PROMPT },
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
        });

        return AgentMixin.createResult(true, response.content, durationMs);
      } catch (error) {
        const durationMs = Date.now() - startTime;

        AgentMixin.logError('DuyetInfoAgent', 'Query failed', error, {
          traceId,
          durationMs,
        });

        return AgentMixin.createErrorResult(error, durationMs);
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
