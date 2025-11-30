/**
 * MCP-Enabled Worker
 *
 * Base worker that integrates with MCP (Model Context Protocol) servers
 * to provide tool-augmented execution capabilities.
 *
 * Unlike the base worker which only uses LLM for reasoning,
 * MCP workers can discover and use tools from connected MCP servers.
 */

import { logger } from '@duyetbot/hono-middleware';
import { Agent, type Connection } from 'agents';
import { AgentMixin } from '../agents/base-agent.js';
import type { MCPServerConnection } from '../cloudflare-agent.js';
import type { PlanStep, WorkerResult } from '../routing/schemas.js';
import type { LLMMessage, LLMProvider, OpenAITool, ToolCall } from '../types.js';
import type { BaseWorkerEnv, WorkerClass, WorkerInput } from './base-worker.js';
import { formatDependencyContext, type WorkerType } from './worker-utils.js';

/**
 * Configuration for MCP-enabled worker
 */
export interface MCPWorkerConfig<TEnv extends BaseWorkerEnv> {
  /** Function to create LLM provider from env */
  createProvider: (env: TEnv) => LLMProvider;
  /** Worker type for identification */
  workerType: WorkerType;
  /** System prompt for the worker's domain */
  systemPrompt: string;
  /** MCP server connection details */
  mcpServer: MCPServerConnection;
  /** Optional filter to select specific tools (by name) */
  toolFilter?: (toolName: string) => boolean;
  /** Maximum number of tools to expose to LLM */
  maxTools?: number;
  /** Maximum tokens for response */
  maxTokens?: number;
  /** Enable detailed logging */
  debug?: boolean;
  /** Custom prompt builder */
  buildPrompt?: (step: PlanStep, dependencyContext: string) => string;
  /** Custom response parser */
  parseResponse?: (content: string, expectedOutput: string) => unknown;
  /** Connection timeout in ms (default: 10000) */
  connectionTimeoutMs?: number;
  /** Maximum tool call iterations (default: 3) */
  maxToolIterations?: number;
}

/**
 * MCP Worker state - extends base with MCP-specific state
 */
export interface MCPWorkerState {
  /** Worker instance ID */
  workerId: string;
  /** Number of tasks executed */
  tasksExecuted: number;
  /** Last execution timestamp */
  lastExecutedAt: number | undefined;
  /** Creation timestamp */
  createdAt: number;
  /** Cached MCP tools (to avoid repeated discovery) */
  cachedTools: OpenAITool[] | undefined;
  /** When tools were last cached */
  toolsCachedAt: number | undefined;
}

/**
 * Default prompt builder for MCP workers
 */
function defaultBuildPrompt(step: PlanStep, dependencyContext: string): string {
  const parts: string[] = [];

  if (dependencyContext) {
    parts.push(dependencyContext);
  }

  parts.push(`## Task\n${step.task}`);
  parts.push(`\n## Expected Output Type: ${step.expectedOutput}`);
  parts.push('\n## Instructions');
  parts.push(`- ${step.description}`);
  parts.push('- Use the available tools to gather information');
  parts.push('- Provide a clear, structured response');
  parts.push('- If you need to output code, wrap it in appropriate code blocks');

  return parts.join('\n');
}

/**
 * Default response parser
 */
function defaultParseResponse(content: string, expectedOutput: string): unknown {
  switch (expectedOutput) {
    case 'code': {
      const codeMatch = content.match(/```[\w]*\n?([\s\S]*?)```/);
      return codeMatch?.[1] ? codeMatch[1].trim() : content;
    }

    case 'data': {
      try {
        const jsonMatch = content.match(/```json\n?([\s\S]*?)```/);
        if (jsonMatch?.[1]) {
          return JSON.parse(jsonMatch[1]);
        }
        return JSON.parse(content);
      } catch {
        return content;
      }
    }

    case 'action':
      return { action: 'completed', result: content };
    default:
      return content;
  }
}

/**
 * Create an MCP-enabled worker class factory
 *
 * @example
 * ```typescript
 * const DuyetInfoWorker = createMCPWorker({
 *   createProvider: (env) => createAIGatewayProvider(env),
 *   workerType: 'duyet-info',
 *   systemPrompt: 'You are a personal info specialist...',
 *   mcpServer: { name: 'duyet-mcp', url: 'https://mcp.duyet.net/sse' },
 *   toolFilter: (name) => /about|cv|contact|info/.test(name),
 * });
 * ```
 */
export function createMCPWorker<TEnv extends BaseWorkerEnv>(
  config: MCPWorkerConfig<TEnv>
): WorkerClass<TEnv> {
  const debug = config.debug ?? false;
  const buildPrompt = config.buildPrompt ?? defaultBuildPrompt;
  const parseResponse = config.parseResponse ?? defaultParseResponse;
  const connectionTimeoutMs = config.connectionTimeoutMs ?? 10000;
  const maxToolIterations = config.maxToolIterations ?? 3;
  const maxTools = config.maxTools ?? 10;

  const WorkerClass = class MCPWorker extends Agent<TEnv, MCPWorkerState> {
    override initialState: MCPWorkerState = {
      workerId: '',
      tasksExecuted: 0,
      lastExecutedAt: undefined,
      createdAt: Date.now(),
      cachedTools: undefined,
      toolsCachedAt: undefined,
    };

    private _mcpInitialized = false;

    /**
     * Handle state updates
     */
    override onStateUpdate(state: MCPWorkerState, source: 'server' | Connection): void {
      if (debug) {
        logger.info(`[${config.workerType}-worker] State updated`, {
          source,
          tasksExecuted: state.tasksExecuted,
          hasCachedTools: !!state.cachedTools,
        });
      }
    }

    /**
     * Initialize MCP connection and discover tools
     * Uses the new addMcpServer() API (agents SDK v0.2.24+) which handles
     * registration, connection, and discovery in one call
     */
    async initMcp(): Promise<void> {
      if (this._mcpInitialized) {
        return;
      }

      const env = (this as unknown as { env: TEnv }).env;

      try {
        const authHeader = config.mcpServer.getAuthHeader?.(env as Record<string, unknown>);
        const transportOptions = authHeader
          ? {
              headers: {
                Authorization: authHeader,
              },
            }
          : undefined;

        if (debug) {
          logger.info(`[${config.workerType}-worker] Connecting to MCP server`, {
            url: config.mcpServer.url,
            hasAuth: !!authHeader,
          });
        }

        // Use the new addMcpServer() API which combines registerServer() + connectToServer()
        // This is the recommended approach for agents SDK v0.2.24+
        const addPromise = this.addMcpServer(
          config.mcpServer.name,
          config.mcpServer.url,
          '', // callbackHost - empty string for non-OAuth servers
          '', // agentsPrefix - empty string uses default
          transportOptions ? { transport: transportOptions } : undefined
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
          logger.info(`[${config.workerType}-worker] MCP connected successfully`, {
            id: result.id,
          });
        }

        this._mcpInitialized = true;
      } catch (error) {
        logger.error(`[${config.workerType}-worker] MCP connection failed`, {
          error,
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
      let filteredTools = mcpTools;

      // Apply tool filter if provided
      if (config.toolFilter) {
        filteredTools = mcpTools.filter((tool) => config.toolFilter!(tool.name));
      }

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
        logger.info(`[${config.workerType}-worker] Discovered ${openAITools.length} tools`, {
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
          logger.info(`[${config.workerType}-worker] Executing MCP tool`, {
            tool: toolCall.name,
            args,
          });
        }

        const result = await this.mcp.callTool({
          serverId: config.mcpServer.name,
          name: toolCall.name,
          arguments: args,
        });

        // Format result as string
        if (typeof result === 'string') {
          return result;
        }
        return JSON.stringify(result, null, 2);
      } catch (error) {
        logger.error(`[${config.workerType}-worker] MCP tool execution failed`, {
          tool: toolCall.name,
          error,
        });
        return `Error executing tool ${toolCall.name}: ${error instanceof Error ? error.message : String(error)}`;
      }
    }

    /**
     * Execute a task step with MCP tools
     */
    async execute(input: WorkerInput): Promise<WorkerResult> {
      const startTime = Date.now();
      const { step, dependencyResults, traceId } = input;

      AgentMixin.log(`${config.workerType}-worker`, 'Executing step with MCP', {
        traceId,
        stepId: step.id,
        task: step.task.slice(0, 100),
      });

      try {
        // Initialize MCP connection
        await this.initMcp();

        // Get LLM provider
        const env = (this as unknown as { env: TEnv }).env;
        const provider = config.createProvider(env);

        // Get available tools (filtered)
        const tools = this._mcpInitialized ? this.getMcpTools() : [];

        // Build context from dependencies
        const dependencyContext = formatDependencyContext(dependencyResults);

        // Build initial messages
        const messages: LLMMessage[] = [
          { role: 'system', content: config.systemPrompt },
          {
            role: 'user',
            content: buildPrompt(step, dependencyContext),
          },
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
            logger.info(`[${config.workerType}-worker] Tool iteration ${iterations}`, {
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
          workerId: this.state.workerId || traceId,
          tasksExecuted: this.state.tasksExecuted + 1,
          lastExecutedAt: Date.now(),
        });

        AgentMixin.log(`${config.workerType}-worker`, 'Step completed', {
          traceId,
          stepId: step.id,
          durationMs,
          toolIterations: iterations,
        });

        // Parse response based on expected output type
        const data = parseResponse(response.content, step.expectedOutput);

        return {
          stepId: step.id,
          success: true,
          data,
          durationMs,
        };
      } catch (error) {
        const durationMs = Date.now() - startTime;

        AgentMixin.logError(`${config.workerType}-worker`, 'Step failed', error, {
          traceId,
          stepId: step.id,
          durationMs,
        });

        return {
          stepId: step.id,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          durationMs,
        };
      }
    }

    /**
     * Get worker statistics
     */
    getStats(): { tasksExecuted: number; lastExecutedAt: number | undefined } {
      return {
        tasksExecuted: this.state.tasksExecuted,
        lastExecutedAt: this.state.lastExecutedAt,
      };
    }
  };

  return WorkerClass as WorkerClass<TEnv>;
}
