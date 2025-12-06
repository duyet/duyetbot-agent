/**
 * Routing Schemas
 *
 * Zod schemas for query classification and routing decisions.
 * Used by RouterAgent to determine how to handle incoming queries.
 */
import { z } from 'zod';
/**
 * Query type classification
 */
export declare const QueryType: z.ZodEnum<['simple', 'complex', 'tool_confirmation']>;
export type QueryType = z.infer<typeof QueryType>;
/**
 * Query category for routing to specialized workers
 */
export declare const QueryCategory: z.ZodEnum<
  ['general', 'code', 'research', 'github', 'admin', 'duyet']
>;
export type QueryCategory = z.infer<typeof QueryCategory>;
/**
 * Complexity level for resource allocation
 */
export declare const ComplexityLevel: z.ZodEnum<['low', 'medium', 'high']>;
export type ComplexityLevel = z.infer<typeof ComplexityLevel>;
/**
 * Effort estimation for resource allocation
 * Based on Anthropic's multi-agent research system patterns
 */
export declare const EffortEstimateSchema: z.ZodObject<
  {
    /** Recommended effort level */
    level: z.ZodEnum<['minimal', 'standard', 'thorough', 'exhaustive']>;
    /** Recommended number of subagents (1-10) */
    recommendedSubagents: z.ZodNumber;
    /** Maximum tool calls across all subagents (3-100) */
    maxToolCalls: z.ZodNumber;
    /** Expected duration category */
    expectedDuration: z.ZodEnum<['fast', 'medium', 'long']>;
  },
  'strip',
  z.ZodTypeAny,
  {
    level: 'minimal' | 'standard' | 'thorough' | 'exhaustive';
    recommendedSubagents: number;
    maxToolCalls: number;
    expectedDuration: 'medium' | 'fast' | 'long';
  },
  {
    level: 'minimal' | 'standard' | 'thorough' | 'exhaustive';
    recommendedSubagents: number;
    maxToolCalls: number;
    expectedDuration: 'medium' | 'fast' | 'long';
  }
>;
export type EffortEstimate = z.infer<typeof EffortEstimateSchema>;
/**
 * Full query classification schema
 */
export declare const QueryClassificationSchema: z.ZodObject<
  {
    /** Type of query processing needed */
    type: z.ZodEnum<['simple', 'complex', 'tool_confirmation']>;
    /** Domain category for routing */
    category: z.ZodEnum<['general', 'code', 'research', 'github', 'admin', 'duyet']>;
    /** Complexity assessment */
    complexity: z.ZodEnum<['low', 'medium', 'high']>;
    /** Whether sensitive operations require human approval */
    requiresHumanApproval: z.ZodBoolean;
    /** Brief reasoning for the classification */
    reasoning: z.ZodString;
    /** Classification confidence score (0-1) */
    confidence: z.ZodOptional<z.ZodNumber>;
    /** Suggested tools if any */
    suggestedTools: z.ZodOptional<z.ZodArray<z.ZodString, 'many'>>;
    /** Estimated token cost (rough) */
    estimatedTokens: z.ZodOptional<z.ZodNumber>;
    /** Effort estimation for multi-agent research */
    effortEstimate: z.ZodOptional<
      z.ZodObject<
        {
          /** Recommended effort level */
          level: z.ZodEnum<['minimal', 'standard', 'thorough', 'exhaustive']>;
          /** Recommended number of subagents (1-10) */
          recommendedSubagents: z.ZodNumber;
          /** Maximum tool calls across all subagents (3-100) */
          maxToolCalls: z.ZodNumber;
          /** Expected duration category */
          expectedDuration: z.ZodEnum<['fast', 'medium', 'long']>;
        },
        'strip',
        z.ZodTypeAny,
        {
          level: 'minimal' | 'standard' | 'thorough' | 'exhaustive';
          recommendedSubagents: number;
          maxToolCalls: number;
          expectedDuration: 'medium' | 'fast' | 'long';
        },
        {
          level: 'minimal' | 'standard' | 'thorough' | 'exhaustive';
          recommendedSubagents: number;
          maxToolCalls: number;
          expectedDuration: 'medium' | 'fast' | 'long';
        }
      >
    >;
  },
  'strip',
  z.ZodTypeAny,
  {
    type: 'simple' | 'complex' | 'tool_confirmation';
    category: 'research' | 'github' | 'code' | 'general' | 'admin' | 'duyet';
    complexity: 'low' | 'high' | 'medium';
    reasoning: string;
    requiresHumanApproval: boolean;
    confidence?: number | undefined;
    suggestedTools?: string[] | undefined;
    estimatedTokens?: number | undefined;
    effortEstimate?:
      | {
          level: 'minimal' | 'standard' | 'thorough' | 'exhaustive';
          recommendedSubagents: number;
          maxToolCalls: number;
          expectedDuration: 'medium' | 'fast' | 'long';
        }
      | undefined;
  },
  {
    type: 'simple' | 'complex' | 'tool_confirmation';
    category: 'research' | 'github' | 'code' | 'general' | 'admin' | 'duyet';
    complexity: 'low' | 'high' | 'medium';
    reasoning: string;
    requiresHumanApproval: boolean;
    confidence?: number | undefined;
    suggestedTools?: string[] | undefined;
    estimatedTokens?: number | undefined;
    effortEstimate?:
      | {
          level: 'minimal' | 'standard' | 'thorough' | 'exhaustive';
          recommendedSubagents: number;
          maxToolCalls: number;
          expectedDuration: 'medium' | 'fast' | 'long';
        }
      | undefined;
  }
>;
export type QueryClassification = z.infer<typeof QueryClassificationSchema>;
/**
 * Route target types
 *
 * IMPORTANT: Router only dispatches to AGENTS, never directly to workers.
 * Workers (CodeWorker, ResearchWorker, GitHubWorker) are dispatched by
 * OrchestratorAgent as part of its ExecutionPlan.
 *
 * @see https://developers.cloudflare.com/agents/patterns/
 */
export declare const RouteTarget: z.ZodEnum<
  ['simple-agent', 'orchestrator-agent', 'lead-researcher-agent', 'hitl-agent', 'duyet-info-agent']
>;
export type RouteTarget = z.infer<typeof RouteTarget>;
/**
 * Routing decision schema
 */
export declare const RoutingDecisionSchema: z.ZodObject<
  {
    /** Target agent/worker */
    target: z.ZodEnum<
      [
        'simple-agent',
        'orchestrator-agent',
        'lead-researcher-agent',
        'hitl-agent',
        'duyet-info-agent',
      ]
    >;
    /** Original classification */
    classification: z.ZodObject<
      {
        /** Type of query processing needed */
        type: z.ZodEnum<['simple', 'complex', 'tool_confirmation']>;
        /** Domain category for routing */
        category: z.ZodEnum<['general', 'code', 'research', 'github', 'admin', 'duyet']>;
        /** Complexity assessment */
        complexity: z.ZodEnum<['low', 'medium', 'high']>;
        /** Whether sensitive operations require human approval */
        requiresHumanApproval: z.ZodBoolean;
        /** Brief reasoning for the classification */
        reasoning: z.ZodString;
        /** Classification confidence score (0-1) */
        confidence: z.ZodOptional<z.ZodNumber>;
        /** Suggested tools if any */
        suggestedTools: z.ZodOptional<z.ZodArray<z.ZodString, 'many'>>;
        /** Estimated token cost (rough) */
        estimatedTokens: z.ZodOptional<z.ZodNumber>;
        /** Effort estimation for multi-agent research */
        effortEstimate: z.ZodOptional<
          z.ZodObject<
            {
              /** Recommended effort level */
              level: z.ZodEnum<['minimal', 'standard', 'thorough', 'exhaustive']>;
              /** Recommended number of subagents (1-10) */
              recommendedSubagents: z.ZodNumber;
              /** Maximum tool calls across all subagents (3-100) */
              maxToolCalls: z.ZodNumber;
              /** Expected duration category */
              expectedDuration: z.ZodEnum<['fast', 'medium', 'long']>;
            },
            'strip',
            z.ZodTypeAny,
            {
              level: 'minimal' | 'standard' | 'thorough' | 'exhaustive';
              recommendedSubagents: number;
              maxToolCalls: number;
              expectedDuration: 'medium' | 'fast' | 'long';
            },
            {
              level: 'minimal' | 'standard' | 'thorough' | 'exhaustive';
              recommendedSubagents: number;
              maxToolCalls: number;
              expectedDuration: 'medium' | 'fast' | 'long';
            }
          >
        >;
      },
      'strip',
      z.ZodTypeAny,
      {
        type: 'simple' | 'complex' | 'tool_confirmation';
        category: 'research' | 'github' | 'code' | 'general' | 'admin' | 'duyet';
        complexity: 'low' | 'high' | 'medium';
        reasoning: string;
        requiresHumanApproval: boolean;
        confidence?: number | undefined;
        suggestedTools?: string[] | undefined;
        estimatedTokens?: number | undefined;
        effortEstimate?:
          | {
              level: 'minimal' | 'standard' | 'thorough' | 'exhaustive';
              recommendedSubagents: number;
              maxToolCalls: number;
              expectedDuration: 'medium' | 'fast' | 'long';
            }
          | undefined;
      },
      {
        type: 'simple' | 'complex' | 'tool_confirmation';
        category: 'research' | 'github' | 'code' | 'general' | 'admin' | 'duyet';
        complexity: 'low' | 'high' | 'medium';
        reasoning: string;
        requiresHumanApproval: boolean;
        confidence?: number | undefined;
        suggestedTools?: string[] | undefined;
        estimatedTokens?: number | undefined;
        effortEstimate?:
          | {
              level: 'minimal' | 'standard' | 'thorough' | 'exhaustive';
              recommendedSubagents: number;
              maxToolCalls: number;
              expectedDuration: 'medium' | 'fast' | 'long';
            }
          | undefined;
      }
    >;
    /** Priority (1-10, higher = more urgent) */
    priority: z.ZodDefault<z.ZodNumber>;
    /** Additional context to pass to target */
    context: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
  },
  'strip',
  z.ZodTypeAny,
  {
    classification: {
      type: 'simple' | 'complex' | 'tool_confirmation';
      category: 'research' | 'github' | 'code' | 'general' | 'admin' | 'duyet';
      complexity: 'low' | 'high' | 'medium';
      reasoning: string;
      requiresHumanApproval: boolean;
      confidence?: number | undefined;
      suggestedTools?: string[] | undefined;
      estimatedTokens?: number | undefined;
      effortEstimate?:
        | {
            level: 'minimal' | 'standard' | 'thorough' | 'exhaustive';
            recommendedSubagents: number;
            maxToolCalls: number;
            expectedDuration: 'medium' | 'fast' | 'long';
          }
        | undefined;
    };
    priority: number;
    target:
      | 'orchestrator-agent'
      | 'simple-agent'
      | 'lead-researcher-agent'
      | 'hitl-agent'
      | 'duyet-info-agent';
    context?: Record<string, unknown> | undefined;
  },
  {
    classification: {
      type: 'simple' | 'complex' | 'tool_confirmation';
      category: 'research' | 'github' | 'code' | 'general' | 'admin' | 'duyet';
      complexity: 'low' | 'high' | 'medium';
      reasoning: string;
      requiresHumanApproval: boolean;
      confidence?: number | undefined;
      suggestedTools?: string[] | undefined;
      estimatedTokens?: number | undefined;
      effortEstimate?:
        | {
            level: 'minimal' | 'standard' | 'thorough' | 'exhaustive';
            recommendedSubagents: number;
            maxToolCalls: number;
            expectedDuration: 'medium' | 'fast' | 'long';
          }
        | undefined;
    };
    target:
      | 'orchestrator-agent'
      | 'simple-agent'
      | 'lead-researcher-agent'
      | 'hitl-agent'
      | 'duyet-info-agent';
    priority?: number | undefined;
    context?: Record<string, unknown> | undefined;
  }
>;
export type RoutingDecision = z.infer<typeof RoutingDecisionSchema>;
/**
 * Execution plan step for orchestrator
 */
export declare const PlanStepSchema: z.ZodObject<
  {
    /** Unique step identifier */
    id: z.ZodString;
    /** Human-readable description */
    description: z.ZodString;
    /** Worker type to execute this step */
    workerType: z.ZodEnum<['code', 'research', 'github', 'general']>;
    /** Task instruction for the worker */
    task: z.ZodString;
    /** IDs of steps that must complete before this one */
    dependsOn: z.ZodDefault<z.ZodArray<z.ZodString, 'many'>>;
    /** Priority within same dependency level */
    priority: z.ZodDefault<z.ZodNumber>;
    /** Expected output type */
    expectedOutput: z.ZodDefault<z.ZodEnum<['text', 'code', 'data', 'action']>>;
  },
  'strip',
  z.ZodTypeAny,
  {
    id: string;
    priority: number;
    description: string;
    workerType: 'research' | 'github' | 'code' | 'general';
    task: string;
    dependsOn: string[];
    expectedOutput: 'text' | 'data' | 'code' | 'action';
  },
  {
    id: string;
    description: string;
    workerType: 'research' | 'github' | 'code' | 'general';
    task: string;
    priority?: number | undefined;
    dependsOn?: string[] | undefined;
    expectedOutput?: 'text' | 'data' | 'code' | 'action' | undefined;
  }
>;
export type PlanStep = z.infer<typeof PlanStepSchema>;
/**
 * Full execution plan schema
 */
export declare const ExecutionPlanSchema: z.ZodObject<
  {
    /** Unique plan identifier */
    taskId: z.ZodString;
    /** Summary of what this plan accomplishes */
    summary: z.ZodString;
    /** Ordered list of steps */
    steps: z.ZodArray<
      z.ZodObject<
        {
          /** Unique step identifier */
          id: z.ZodString;
          /** Human-readable description */
          description: z.ZodString;
          /** Worker type to execute this step */
          workerType: z.ZodEnum<['code', 'research', 'github', 'general']>;
          /** Task instruction for the worker */
          task: z.ZodString;
          /** IDs of steps that must complete before this one */
          dependsOn: z.ZodDefault<z.ZodArray<z.ZodString, 'many'>>;
          /** Priority within same dependency level */
          priority: z.ZodDefault<z.ZodNumber>;
          /** Expected output type */
          expectedOutput: z.ZodDefault<z.ZodEnum<['text', 'code', 'data', 'action']>>;
        },
        'strip',
        z.ZodTypeAny,
        {
          id: string;
          priority: number;
          description: string;
          workerType: 'research' | 'github' | 'code' | 'general';
          task: string;
          dependsOn: string[];
          expectedOutput: 'text' | 'data' | 'code' | 'action';
        },
        {
          id: string;
          description: string;
          workerType: 'research' | 'github' | 'code' | 'general';
          task: string;
          priority?: number | undefined;
          dependsOn?: string[] | undefined;
          expectedOutput?: 'text' | 'data' | 'code' | 'action' | undefined;
        }
      >,
      'many'
    >;
    /** Estimated complexity */
    estimatedComplexity: z.ZodEnum<['low', 'medium', 'high']>;
    /** Estimated total duration in seconds */
    estimatedDurationSeconds: z.ZodOptional<z.ZodNumber>;
  },
  'strip',
  z.ZodTypeAny,
  {
    taskId: string;
    summary: string;
    steps: {
      id: string;
      priority: number;
      description: string;
      workerType: 'research' | 'github' | 'code' | 'general';
      task: string;
      dependsOn: string[];
      expectedOutput: 'text' | 'data' | 'code' | 'action';
    }[];
    estimatedComplexity: 'low' | 'high' | 'medium';
    estimatedDurationSeconds?: number | undefined;
  },
  {
    taskId: string;
    summary: string;
    steps: {
      id: string;
      description: string;
      workerType: 'research' | 'github' | 'code' | 'general';
      task: string;
      priority?: number | undefined;
      dependsOn?: string[] | undefined;
      expectedOutput?: 'text' | 'data' | 'code' | 'action' | undefined;
    }[];
    estimatedComplexity: 'low' | 'high' | 'medium';
    estimatedDurationSeconds?: number | undefined;
  }
>;
export type ExecutionPlan = z.infer<typeof ExecutionPlanSchema>;
/**
 * Tool confirmation request
 */
export declare const ToolConfirmationSchema: z.ZodObject<
  {
    /** Unique confirmation ID */
    id: z.ZodString;
    /** Tool name */
    toolName: z.ZodString;
    /** Tool arguments */
    toolArgs: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    /** Human-readable description of what this tool will do */
    description: z.ZodString;
    /** Risk level of this operation */
    riskLevel: z.ZodEnum<['low', 'medium', 'high']>;
    /** Current status */
    status: z.ZodEnum<['pending', 'approved', 'rejected', 'expired']>;
    /** When the confirmation was requested */
    requestedAt: z.ZodNumber;
    /** When the user responded (if any) */
    respondedAt: z.ZodOptional<z.ZodNumber>;
    /** User's reason for rejection (if rejected) */
    rejectionReason: z.ZodOptional<z.ZodString>;
    /** Expiration timestamp */
    expiresAt: z.ZodNumber;
  },
  'strip',
  z.ZodTypeAny,
  {
    status: 'pending' | 'expired' | 'approved' | 'rejected';
    id: string;
    description: string;
    toolName: string;
    toolArgs: Record<string, unknown>;
    riskLevel: 'low' | 'high' | 'medium';
    requestedAt: number;
    expiresAt: number;
    respondedAt?: number | undefined;
    rejectionReason?: string | undefined;
  },
  {
    status: 'pending' | 'expired' | 'approved' | 'rejected';
    id: string;
    description: string;
    toolName: string;
    toolArgs: Record<string, unknown>;
    riskLevel: 'low' | 'high' | 'medium';
    requestedAt: number;
    expiresAt: number;
    respondedAt?: number | undefined;
    rejectionReason?: string | undefined;
  }
>;
export type ToolConfirmation = z.infer<typeof ToolConfirmationSchema>;
/**
 * Worker execution result
 */
export declare const WorkerResultSchema: z.ZodObject<
  {
    /** Step ID this result belongs to */
    stepId: z.ZodString;
    /** Whether execution succeeded */
    success: z.ZodBoolean;
    /** Result data (if success) */
    data: z.ZodOptional<z.ZodUnknown>;
    /** Error message (if failure) */
    error: z.ZodOptional<z.ZodString>;
    /** Execution duration in ms */
    durationMs: z.ZodNumber;
    /** Token usage */
    tokensUsed: z.ZodOptional<z.ZodNumber>;
    /** Whether the worker needs more context to proceed (triggers re-planning) */
    needsMoreContext: z.ZodOptional<z.ZodBoolean>;
    /** Suggested context information for re-planning */
    contextSuggestion: z.ZodOptional<z.ZodString>;
  },
  'strip',
  z.ZodTypeAny,
  {
    success: boolean;
    durationMs: number;
    stepId: string;
    error?: string | undefined;
    data?: unknown;
    tokensUsed?: number | undefined;
    needsMoreContext?: boolean | undefined;
    contextSuggestion?: string | undefined;
  },
  {
    success: boolean;
    durationMs: number;
    stepId: string;
    error?: string | undefined;
    data?: unknown;
    tokensUsed?: number | undefined;
    needsMoreContext?: boolean | undefined;
    contextSuggestion?: string | undefined;
  }
>;
export type WorkerResult = z.infer<typeof WorkerResultSchema>;
//# sourceMappingURL=schemas.d.ts.map
