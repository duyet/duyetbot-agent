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
export const QueryType = z.enum([
  'simple', // Quick answer, no tools needed
  'complex', // Multi-step task, needs orchestration
  'tool_confirmation', // Awaiting user approval for tool execution
]);
export type QueryType = z.infer<typeof QueryType>;

/**
 * Query category for routing to specialized workers
 */
export const QueryCategory = z.enum([
  'general', // General questions, chitchat
  'code', // Code review, generation, analysis
  'research', // Web search, documentation lookup
  'github', // GitHub operations (PRs, issues, comments)
  'admin', // Administrative tasks (settings, config)
  'duyet', // Duyet's blog and personal info queries
]);
export type QueryCategory = z.infer<typeof QueryCategory>;

/**
 * Complexity level for resource allocation
 */
export const ComplexityLevel = z.enum([
  'low', // Single step, fast response
  'medium', // Few steps, moderate processing
  'high', // Many steps, parallel execution needed
]);
export type ComplexityLevel = z.infer<typeof ComplexityLevel>;

/**
 * Effort estimation for resource allocation
 * Based on Anthropic's multi-agent research system patterns
 */
export const EffortEstimateSchema = z.object({
  /** Recommended effort level */
  level: z.enum(['minimal', 'standard', 'thorough', 'exhaustive']),
  /** Recommended number of subagents (1-10) */
  recommendedSubagents: z.number().min(1).max(10),
  /** Maximum tool calls across all subagents (3-100) */
  maxToolCalls: z.number().min(3).max(100),
  /** Expected duration category */
  expectedDuration: z.enum(['fast', 'medium', 'long']),
});
export type EffortEstimate = z.infer<typeof EffortEstimateSchema>;

/**
 * Full query classification schema
 */
export const QueryClassificationSchema = z.object({
  /** Type of query processing needed */
  type: QueryType,
  /** Domain category for routing */
  category: QueryCategory,
  /** Complexity assessment */
  complexity: ComplexityLevel,
  /** Whether sensitive operations require human approval */
  requiresHumanApproval: z.boolean(),
  /** Brief reasoning for the classification */
  reasoning: z.string(),
  /** Classification confidence score (0-1) */
  confidence: z.number().min(0).max(1).optional(),
  /** Suggested tools if any */
  suggestedTools: z.array(z.string()).optional(),
  /** Estimated token cost (rough) */
  estimatedTokens: z.number().optional(),
  /** Effort estimation for multi-agent research */
  effortEstimate: EffortEstimateSchema.optional(),
});
export type QueryClassification = z.infer<typeof QueryClassificationSchema>;

/**
 * Route target types
 */
export const RouteTarget = z.enum([
  'simple-agent', // Direct LLM response
  'orchestrator-agent', // Complex task orchestration
  'lead-researcher-agent', // Multi-agent research orchestration
  'hitl-agent', // Human-in-the-loop workflow
  'code-worker', // Code-specific tasks
  'research-worker', // Research tasks
  'github-worker', // GitHub operations
  'duyet-info-agent', // Duyet's blog and personal info
]);
export type RouteTarget = z.infer<typeof RouteTarget>;

/**
 * Routing decision schema
 */
export const RoutingDecisionSchema = z.object({
  /** Target agent/worker */
  target: RouteTarget,
  /** Original classification */
  classification: QueryClassificationSchema,
  /** Priority (1-10, higher = more urgent) */
  priority: z.number().min(1).max(10).default(5),
  /** Additional context to pass to target */
  context: z.record(z.unknown()).optional(),
});
export type RoutingDecision = z.infer<typeof RoutingDecisionSchema>;

/**
 * Execution plan step for orchestrator
 */
export const PlanStepSchema = z.object({
  /** Unique step identifier */
  id: z.string(),
  /** Human-readable description */
  description: z.string(),
  /** Worker type to execute this step */
  workerType: z.enum(['code', 'research', 'github', 'general']),
  /** Task instruction for the worker */
  task: z.string(),
  /** IDs of steps that must complete before this one */
  dependsOn: z.array(z.string()).default([]),
  /** Priority within same dependency level */
  priority: z.number().min(1).max(10).default(5),
  /** Expected output type */
  expectedOutput: z.enum(['text', 'code', 'data', 'action']).default('text'),
});
export type PlanStep = z.infer<typeof PlanStepSchema>;

/**
 * Full execution plan schema
 */
export const ExecutionPlanSchema = z.object({
  /** Unique plan identifier */
  taskId: z.string(),
  /** Summary of what this plan accomplishes */
  summary: z.string(),
  /** Ordered list of steps */
  steps: z.array(PlanStepSchema),
  /** Estimated complexity */
  estimatedComplexity: ComplexityLevel,
  /** Estimated total duration in seconds */
  estimatedDurationSeconds: z.number().optional(),
});
export type ExecutionPlan = z.infer<typeof ExecutionPlanSchema>;

/**
 * Tool confirmation request
 */
export const ToolConfirmationSchema = z.object({
  /** Unique confirmation ID */
  id: z.string(),
  /** Tool name */
  toolName: z.string(),
  /** Tool arguments */
  toolArgs: z.record(z.unknown()),
  /** Human-readable description of what this tool will do */
  description: z.string(),
  /** Risk level of this operation */
  riskLevel: z.enum(['low', 'medium', 'high']),
  /** Current status */
  status: z.enum(['pending', 'approved', 'rejected', 'expired']),
  /** When the confirmation was requested */
  requestedAt: z.number(),
  /** When the user responded (if any) */
  respondedAt: z.number().optional(),
  /** User's reason for rejection (if rejected) */
  rejectionReason: z.string().optional(),
  /** Expiration timestamp */
  expiresAt: z.number(),
});
export type ToolConfirmation = z.infer<typeof ToolConfirmationSchema>;

/**
 * Worker execution result
 */
export const WorkerResultSchema = z.object({
  /** Step ID this result belongs to */
  stepId: z.string(),
  /** Whether execution succeeded */
  success: z.boolean(),
  /** Result data (if success) */
  data: z.unknown().optional(),
  /** Error message (if failure) */
  error: z.string().optional(),
  /** Execution duration in ms */
  durationMs: z.number(),
  /** Token usage */
  tokensUsed: z.number().optional(),
});
export type WorkerResult = z.infer<typeof WorkerResultSchema>;
