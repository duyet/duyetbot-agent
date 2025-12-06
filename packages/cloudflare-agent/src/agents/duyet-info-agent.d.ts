/**
 * Duyet Info Agent
 *
 * MCP-enabled agent for handling queries about Duyet's blog and personal information.
 * Combines blog content discovery with personal info (CV, contact, skills, etc.)
 *
 * This agent sits at the same level as SimpleAgent under RouterAgent,
 * providing direct routing for Duyet-specific queries.
 *
 * Extends BaseAgent and uses ExecutionContext for unified context management.
 */
import { Agent } from 'agents';
import { type AgentResult, BaseAgent, type BaseState } from '../base/index.js';
import type { AgentProvider } from '../execution/agent-provider.js';
import type { ExecutionContext } from '../execution/context.js';
import type { OpenAITool } from '../types.js';
/**
 * Combined tool filter for blog and info related tools
 * Matches tools with names related to either blog content or personal info
 */
declare function duyetToolFilter(toolName: string): boolean;
/**
 * Cached tool result entry
 */
interface CachedToolResult {
  result: string;
  cachedAt: number;
}
/**
 * Duyet Info Agent state (stateless - no conversation history)
 * Extends BaseState with agent-specific tracking
 */
export interface DuyetInfoAgentState extends BaseState {
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
  /** Cached tool execution results (for blog data) */
  cachedToolResults: Record<string, CachedToolResult> | undefined;
}
/**
 * Environment bindings for Duyet Info Agent
 * Note: Actual env fields depend on the provider (OpenRouterProviderEnv, etc.)
 * This interface is kept minimal - extend with provider-specific env in your app
 */
export type DuyetInfoAgentEnv = {};
/**
 * Configuration for Duyet Info Agent
 */
export interface DuyetInfoAgentConfig<TEnv extends DuyetInfoAgentEnv> {
  /** Function to create agent provider from env */
  createProvider: (env: TEnv) => AgentProvider;
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
  execute(ctx: ExecutionContext): Promise<AgentResult>;
  getStats(): {
    queriesExecuted: number;
    lastExecutedAt: number | undefined;
  };
}
/**
 * Type for DuyetInfoAgent class
 */
export type DuyetInfoAgentClass<TEnv extends DuyetInfoAgentEnv> = typeof BaseAgent<
  TEnv,
  DuyetInfoAgentState
> & {
  new (
    ...args: ConstructorParameters<typeof Agent<TEnv, DuyetInfoAgentState>>
  ): BaseAgent<TEnv, DuyetInfoAgentState> & DuyetInfoAgentMethods;
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
export declare function createDuyetInfoAgent<TEnv extends DuyetInfoAgentEnv>(
  config: DuyetInfoAgentConfig<TEnv>
): DuyetInfoAgentClass<TEnv>;
/**
 * Type for DuyetInfoAgent instance
 */
export type DuyetInfoAgentInstance<TEnv extends DuyetInfoAgentEnv> = InstanceType<
  ReturnType<typeof createDuyetInfoAgent<TEnv>>
>;
export { duyetToolFilter };
//# sourceMappingURL=duyet-info-agent.d.ts.map
