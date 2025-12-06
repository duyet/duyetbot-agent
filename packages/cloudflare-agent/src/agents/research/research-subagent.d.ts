/**
 * Research Subagent
 *
 * A specialized Durable Object agent that handles research tasks
 * with independent context window and parallel tool calling.
 *
 * Key features:
 * - Independent context window (not shared with lead researcher)
 * - Parallel tool calling within the subagent
 * - Structured output to lightweight references
 * - Self-contained timeout handling
 */
import { Agent } from 'agents';
import type { LLMProvider } from '../../types.js';
import { type AgentContext } from '../base-agent.js';
import type { DelegationContext, SubagentResult } from './types.js';
/**
 * Subagent state
 */
export interface SubagentState {
  /** Task ID being processed */
  taskId: string;
  /** Session ID */
  sessionId: string;
  /** Tool calls made */
  toolCallCount: number;
  /** Maximum allowed tool calls */
  maxToolCalls: number;
  /** Whether the subagent is currently active */
  isActive: boolean;
  /** Creation timestamp */
  createdAt: number;
  /** Last activity timestamp */
  lastActivityAt: number;
}
/**
 * Environment for subagent
 */
export interface SubagentEnv {
  /** LLM provider configuration */
  AI_GATEWAY_ACCOUNT_ID?: string;
  AI_GATEWAY_ID?: string;
  ANTHROPIC_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
}
/**
 * Configuration for subagent
 */
export interface SubagentConfig<TEnv extends SubagentEnv> {
  /** Function to create LLM provider from env */
  createProvider: (env: TEnv) => LLMProvider;
  /** Subagent type */
  subagentType: 'research' | 'code' | 'github' | 'general';
  /** Default timeout in ms */
  timeoutMs?: number;
  /** Enable detailed logging */
  debug?: boolean;
}
/**
 * Methods exposed by subagent
 */
export interface SubagentMethods {
  perform(
    delegationContext: DelegationContext,
    agentContext: AgentContext
  ): Promise<SubagentResult>;
  getState(): SubagentState;
  abort(): void;
}
/**
 * Type for Subagent class
 */
export type SubagentClass<TEnv extends SubagentEnv> = typeof Agent<TEnv, SubagentState> & {
  new (
    ...args: ConstructorParameters<typeof Agent<TEnv, SubagentState>>
  ): Agent<TEnv, SubagentState> & SubagentMethods;
};
/**
 * Create a Research Subagent class
 */
export declare function createSubagent<TEnv extends SubagentEnv>(
  config: SubagentConfig<TEnv>
): SubagentClass<TEnv>;
/**
 * Create a research-specialized subagent
 */
export declare function createResearchSubagent<TEnv extends SubagentEnv>(
  createProvider: (env: TEnv) => LLMProvider,
  options?: {
    timeoutMs?: number;
    debug?: boolean;
  }
): SubagentClass<TEnv>;
/**
 * Create a code-specialized subagent
 */
export declare function createCodeSubagent<TEnv extends SubagentEnv>(
  createProvider: (env: TEnv) => LLMProvider,
  options?: {
    timeoutMs?: number;
    debug?: boolean;
  }
): SubagentClass<TEnv>;
/**
 * Create a github-specialized subagent
 */
export declare function createGitHubSubagent<TEnv extends SubagentEnv>(
  createProvider: (env: TEnv) => LLMProvider,
  options?: {
    timeoutMs?: number;
    debug?: boolean;
  }
): SubagentClass<TEnv>;
/**
 * Create a general-purpose subagent
 */
export declare function createGeneralSubagent<TEnv extends SubagentEnv>(
  createProvider: (env: TEnv) => LLMProvider,
  options?: {
    timeoutMs?: number;
    debug?: boolean;
  }
): SubagentClass<TEnv>;
//# sourceMappingURL=research-subagent.d.ts.map
