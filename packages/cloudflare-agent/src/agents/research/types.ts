/**
 * Multi-Agent Research System Types
 *
 * Type definitions for the lead researcher and subagent system.
 * Based on Anthropic's multi-agent research architecture:
 * https://www.anthropic.com/engineering/multi-agent-research-system
 */

import { z } from 'zod';
import type { BaseState } from '../../base/base-types.js';
import type { EffortEstimate } from '../../config/effort-config.js';

/**
 * Subagent task type
 */
export const SubagentType = z.enum([
  'research', // Web search, documentation lookup
  'code', // Code analysis, generation, review
  'github', // GitHub operations
  'general', // General purpose tasks
]);
export type SubagentType = z.infer<typeof SubagentType>;

/**
 * Output format specification for subagents
 */
export const OutputFormat = z.enum([
  'text', // Free-form text response
  'structured', // JSON structured data
  'code', // Code blocks with explanations
  'citations', // Facts with source citations
  'actions', // List of actions taken
]);
export type OutputFormat = z.infer<typeof OutputFormat>;

/**
 * Task definition for a subagent
 */
export interface SubagentTask {
  /** Unique task identifier */
  id: string;
  /** Type of subagent to use */
  type: SubagentType;
  /** Clear objective statement */
  objective: string;
  /** Expected output format */
  outputFormat: OutputFormat;
  /** Guidance on which tools to use */
  toolGuidance: string[];
  /** Task boundaries - what NOT to do */
  boundaries: string[];
  /** Maximum tool calls for this task */
  maxToolCalls: number;
  /** Task priority (1-10, higher = more important) */
  priority: number;
  /** IDs of tasks this depends on */
  dependsOn: string[];
  /** Success criteria for this task */
  successCriteria: string;
}

/**
 * Zod schema for subagent task
 */
export const SubagentTaskSchema = z.object({
  id: z.string(),
  type: SubagentType,
  objective: z.string(),
  outputFormat: OutputFormat,
  toolGuidance: z.array(z.string()),
  boundaries: z.array(z.string()),
  maxToolCalls: z.number().min(1).max(25),
  priority: z.number().min(1).max(10),
  dependsOn: z.array(z.string()).default([]),
  successCriteria: z.string(),
});

/**
 * Research plan created by lead researcher
 */
export interface ResearchPlan {
  /** Unique plan identifier */
  planId: string;
  /** Original query */
  query: string;
  /** High-level strategy description */
  strategy: string;
  /** List of subagent tasks to execute */
  subagentTasks: SubagentTask[];
  /** Instructions for synthesizing results */
  synthesisInstructions: string;
  /** Effort estimate for this plan */
  effortEstimate: EffortEstimate;
  /** Timestamp when plan was created */
  createdAt: number;
}

/**
 * Zod schema for research plan
 */
export const ResearchPlanSchema = z.object({
  planId: z.string(),
  query: z.string(),
  strategy: z.string(),
  subagentTasks: z.array(SubagentTaskSchema),
  synthesisInstructions: z.string(),
  effortEstimate: z.object({
    level: z.enum(['minimal', 'standard', 'thorough', 'exhaustive']),
    recommendedSubagents: z.number(),
    maxToolCalls: z.number(),
    expectedDuration: z.enum(['fast', 'medium', 'long']),
    reasoning: z.string(),
  }),
  createdAt: z.number(),
});

/**
 * Result from a subagent execution
 */
export interface SubagentResult {
  /** Task ID this result belongs to */
  taskId: string;
  /** Whether execution succeeded */
  success: boolean;
  /** Result content */
  content: string | undefined;
  /** Structured data (if outputFormat is structured) */
  data: unknown | undefined;
  /** Error message if failed */
  error: string | undefined;
  /** Citations found (if outputFormat is citations) */
  citations: Citation[];
  /** Tool calls made */
  toolCallCount: number;
  /** Execution duration in ms */
  durationMs: number;
  /** Token usage */
  tokensUsed: number | undefined;
}

/**
 * Citation from a subagent result
 */
export interface Citation {
  /** Unique citation ID */
  id: string;
  /** Source (URL, tool name, or subagent ID) */
  source: string;
  /** Cited content */
  content: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Timestamp when citation was created */
  timestamp: number;
}

/**
 * Zod schema for citation
 */
export const CitationSchema = z.object({
  id: z.string(),
  source: z.string(),
  content: z.string(),
  confidence: z.number().min(0).max(1),
  timestamp: z.number(),
});

/**
 * Aggregated research result
 */
export interface ResearchResult {
  /** Plan ID this result belongs to */
  planId: string;
  /** Synthesized response */
  response: string;
  /** Summary statistics */
  summary: {
    /** Total subagents spawned */
    subagentCount: number;
    /** Successful completions */
    successCount: number;
    /** Failed completions */
    failureCount: number;
    /** Total tool calls across all subagents */
    totalToolCalls: number;
    /** Total duration in ms */
    totalDurationMs: number;
    /** Parallel efficiency (actual time / sequential time estimate) */
    parallelEfficiency: number;
  };
  /** Individual subagent results */
  subagentResults: SubagentResult[];
  /** Aggregated citations */
  citations: Citation[];
  /** Errors encountered */
  errors: string[];
}

/**
 * Delegation template variables
 */
export interface DelegationContext {
  /** Clear objective for the subagent */
  objective: string;
  /** Expected output format */
  outputFormat: string;
  /** List of available tools */
  toolList: string[];
  /** Guidance on tool usage */
  toolGuidance: string[];
  /** What the subagent MUST do */
  mustDo: string[];
  /** What the subagent MUST NOT do */
  mustNotDo: string[];
  /** Scope limitations */
  scopeLimit: string;
  /** Success criteria */
  successCriteria: string;
  /** Context from previous tasks (if dependencies) */
  previousContext?: string;
}

/**
 * Lead researcher state
 *
 * Extends BaseState for consistent Durable Object state management.
 * Tracks current and historical research operations.
 */
export interface LeadResearcherState extends BaseState {
  /** Session identifier for grouping related research operations */
  sessionId: string;
  /** Current research plan (if in progress) */
  currentPlan: ResearchPlan | undefined;
  /** History of completed research operations */
  researchHistory: Array<{
    planId: string;
    query: string;
    summary: ResearchResult['summary'];
    timestamp: number;
  }>;
}
