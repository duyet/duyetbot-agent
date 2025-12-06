/**
 * Lead Researcher Agent
 *
 * Orchestrates multi-agent research by:
 * 1. Analyzing query complexity and determining effort level
 * 2. Creating a research plan with parallel subagent tasks
 * 3. Spawning and coordinating subagents
 * 4. Synthesizing results with source attribution
 *
 * Extends BaseAgent and uses ExecutionContext for improved tracing,
 * context propagation, and multi-agent coordination.
 *
 * Based on Anthropic's multi-agent research system architecture:
 * https://www.anthropic.com/engineering/multi-agent-research-system
 */
import { Agent, type AgentNamespace } from 'agents';
import type { BaseEnv } from '../../base/base-types.js';
import type { ExecutionContext } from '../../execution/context.js';
import type { AgentResult } from '../../base/base-types.js';
import type { QueryClassification } from '../../routing/schemas.js';
import type { LLMProvider } from '../../types.js';
import type { LeadResearcherState, ResearchPlan } from './types.js';
/**
 * Environment bindings for lead researcher agent
 *
 * Extends BaseEnv with additional LLM provider and subagent configuration.
 */
export interface LeadResearcherEnv extends BaseEnv {
  /** LLM provider configuration */
  AI_GATEWAY_ACCOUNT_ID?: string;
  AI_GATEWAY_ID?: string;
  ANTHROPIC_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  /** Subagent bindings */
  ResearchSubagent?: AgentNamespace<Agent<LeadResearcherEnv, unknown>>;
  CodeSubagent?: AgentNamespace<Agent<LeadResearcherEnv, unknown>>;
  GitHubSubagent?: AgentNamespace<Agent<LeadResearcherEnv, unknown>>;
  GeneralSubagent?: AgentNamespace<Agent<LeadResearcherEnv, unknown>>;
}
/**
 * Configuration for lead researcher agent
 */
export interface LeadResearcherConfig<TEnv extends LeadResearcherEnv> {
  /** Function to create LLM provider from env */
  createProvider: (env: TEnv) => LLMProvider;
  /** Maximum research history to keep */
  maxHistory?: number;
  /** Enable detailed logging */
  debug?: boolean;
  /** Default effort level if estimation fails */
  defaultEffortLevel?: 'minimal' | 'standard' | 'thorough' | 'exhaustive';
}
/**
 * Methods exposed by LeadResearcherAgent
 */
export interface LeadResearcherMethods {
  /**
   * Main research entry point
   *
   * @param ctx - ExecutionContext containing query and conversation history
   * @param classification - Optional query classification for routing hints
   * @returns AgentResult with research findings and metadata
   */
  research(ctx: ExecutionContext, classification?: QueryClassification): Promise<AgentResult>;
  /**
   * Get the current research plan (if one is in progress)
   *
   * @returns Current ResearchPlan or undefined if no plan is active
   */
  getCurrentPlan(): ResearchPlan | undefined;
  /**
   * Get aggregate statistics from research history
   *
   * @returns Statistics including total researched, average subagent count, etc.
   */
  getStats(): {
    totalResearched: number;
    avgSubagentCount: number;
    avgDurationMs: number;
    parallelEfficiency: number;
  };
  /**
   * Clear all research history
   */
  clearHistory(): void;
}
/**
 * Type for LeadResearcherAgent class
 */
export type LeadResearcherAgentClass<TEnv extends LeadResearcherEnv> = typeof Agent<
  TEnv,
  LeadResearcherState
> & {
  new (
    ...args: ConstructorParameters<typeof Agent<TEnv, LeadResearcherState>>
  ): Agent<TEnv, LeadResearcherState> & LeadResearcherMethods;
};
/**
 * Create a Lead Researcher Agent class
 *
 * Creates a specialized agent that extends BaseAgent and coordinates multi-agent research
 * operations using ExecutionContext for proper tracing and context propagation.
 */
export declare function createLeadResearcherAgent<TEnv extends LeadResearcherEnv>(
  config: LeadResearcherConfig<TEnv>
): LeadResearcherAgentClass<TEnv>;
/**
 * Type for lead researcher agent instance
 */
export type LeadResearcherAgentInstance<TEnv extends LeadResearcherEnv> = InstanceType<
  ReturnType<typeof createLeadResearcherAgent<TEnv>>
>;
//# sourceMappingURL=lead-researcher-agent.d.ts.map
