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
export declare const SubagentType: z.ZodEnum<['research', 'code', 'github', 'general']>;
export type SubagentType = z.infer<typeof SubagentType>;
/**
 * Output format specification for subagents
 */
export declare const OutputFormat: z.ZodEnum<
  ['text', 'structured', 'code', 'citations', 'actions']
>;
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
export declare const SubagentTaskSchema: z.ZodObject<
  {
    id: z.ZodString;
    type: z.ZodEnum<['research', 'code', 'github', 'general']>;
    objective: z.ZodString;
    outputFormat: z.ZodEnum<['text', 'structured', 'code', 'citations', 'actions']>;
    toolGuidance: z.ZodArray<z.ZodString, 'many'>;
    boundaries: z.ZodArray<z.ZodString, 'many'>;
    maxToolCalls: z.ZodNumber;
    priority: z.ZodNumber;
    dependsOn: z.ZodDefault<z.ZodArray<z.ZodString, 'many'>>;
    successCriteria: z.ZodString;
  },
  'strip',
  z.ZodTypeAny,
  {
    outputFormat: 'text' | 'code' | 'structured' | 'citations' | 'actions';
    type: 'research' | 'github' | 'code' | 'general';
    id: string;
    priority: number;
    maxToolCalls: number;
    dependsOn: string[];
    objective: string;
    toolGuidance: string[];
    boundaries: string[];
    successCriteria: string;
  },
  {
    outputFormat: 'text' | 'code' | 'structured' | 'citations' | 'actions';
    type: 'research' | 'github' | 'code' | 'general';
    id: string;
    priority: number;
    maxToolCalls: number;
    objective: string;
    toolGuidance: string[];
    boundaries: string[];
    successCriteria: string;
    dependsOn?: string[] | undefined;
  }
>;
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
export declare const ResearchPlanSchema: z.ZodObject<
  {
    planId: z.ZodString;
    query: z.ZodString;
    strategy: z.ZodString;
    subagentTasks: z.ZodArray<
      z.ZodObject<
        {
          id: z.ZodString;
          type: z.ZodEnum<['research', 'code', 'github', 'general']>;
          objective: z.ZodString;
          outputFormat: z.ZodEnum<['text', 'structured', 'code', 'citations', 'actions']>;
          toolGuidance: z.ZodArray<z.ZodString, 'many'>;
          boundaries: z.ZodArray<z.ZodString, 'many'>;
          maxToolCalls: z.ZodNumber;
          priority: z.ZodNumber;
          dependsOn: z.ZodDefault<z.ZodArray<z.ZodString, 'many'>>;
          successCriteria: z.ZodString;
        },
        'strip',
        z.ZodTypeAny,
        {
          outputFormat: 'text' | 'code' | 'structured' | 'citations' | 'actions';
          type: 'research' | 'github' | 'code' | 'general';
          id: string;
          priority: number;
          maxToolCalls: number;
          dependsOn: string[];
          objective: string;
          toolGuidance: string[];
          boundaries: string[];
          successCriteria: string;
        },
        {
          outputFormat: 'text' | 'code' | 'structured' | 'citations' | 'actions';
          type: 'research' | 'github' | 'code' | 'general';
          id: string;
          priority: number;
          maxToolCalls: number;
          objective: string;
          toolGuidance: string[];
          boundaries: string[];
          successCriteria: string;
          dependsOn?: string[] | undefined;
        }
      >,
      'many'
    >;
    synthesisInstructions: z.ZodString;
    effortEstimate: z.ZodObject<
      {
        level: z.ZodEnum<['minimal', 'standard', 'thorough', 'exhaustive']>;
        recommendedSubagents: z.ZodNumber;
        maxToolCalls: z.ZodNumber;
        expectedDuration: z.ZodEnum<['fast', 'medium', 'long']>;
        reasoning: z.ZodString;
      },
      'strip',
      z.ZodTypeAny,
      {
        level: 'minimal' | 'standard' | 'thorough' | 'exhaustive';
        recommendedSubagents: number;
        maxToolCalls: number;
        expectedDuration: 'medium' | 'fast' | 'long';
        reasoning: string;
      },
      {
        level: 'minimal' | 'standard' | 'thorough' | 'exhaustive';
        recommendedSubagents: number;
        maxToolCalls: number;
        expectedDuration: 'medium' | 'fast' | 'long';
        reasoning: string;
      }
    >;
    createdAt: z.ZodNumber;
  },
  'strip',
  z.ZodTypeAny,
  {
    query: string;
    effortEstimate: {
      level: 'minimal' | 'standard' | 'thorough' | 'exhaustive';
      recommendedSubagents: number;
      maxToolCalls: number;
      expectedDuration: 'medium' | 'fast' | 'long';
      reasoning: string;
    };
    createdAt: number;
    planId: string;
    strategy: string;
    subagentTasks: {
      outputFormat: 'text' | 'code' | 'structured' | 'citations' | 'actions';
      type: 'research' | 'github' | 'code' | 'general';
      id: string;
      priority: number;
      maxToolCalls: number;
      dependsOn: string[];
      objective: string;
      toolGuidance: string[];
      boundaries: string[];
      successCriteria: string;
    }[];
    synthesisInstructions: string;
  },
  {
    query: string;
    effortEstimate: {
      level: 'minimal' | 'standard' | 'thorough' | 'exhaustive';
      recommendedSubagents: number;
      maxToolCalls: number;
      expectedDuration: 'medium' | 'fast' | 'long';
      reasoning: string;
    };
    createdAt: number;
    planId: string;
    strategy: string;
    subagentTasks: {
      outputFormat: 'text' | 'code' | 'structured' | 'citations' | 'actions';
      type: 'research' | 'github' | 'code' | 'general';
      id: string;
      priority: number;
      maxToolCalls: number;
      objective: string;
      toolGuidance: string[];
      boundaries: string[];
      successCriteria: string;
      dependsOn?: string[] | undefined;
    }[];
    synthesisInstructions: string;
  }
>;
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
export declare const CitationSchema: z.ZodObject<
  {
    id: z.ZodString;
    source: z.ZodString;
    content: z.ZodString;
    confidence: z.ZodNumber;
    timestamp: z.ZodNumber;
  },
  'strip',
  z.ZodTypeAny,
  {
    timestamp: number;
    id: string;
    content: string;
    confidence: number;
    source: string;
  },
  {
    timestamp: number;
    id: string;
    content: string;
    confidence: number;
    source: string;
  }
>;
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
//# sourceMappingURL=types.d.ts.map
