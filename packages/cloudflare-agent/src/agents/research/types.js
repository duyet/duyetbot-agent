/**
 * Multi-Agent Research System Types
 *
 * Type definitions for the lead researcher and subagent system.
 * Based on Anthropic's multi-agent research architecture:
 * https://www.anthropic.com/engineering/multi-agent-research-system
 */
import { z } from 'zod';
/**
 * Subagent task type
 */
export const SubagentType = z.enum([
  'research', // Web search, documentation lookup
  'code', // Code analysis, generation, review
  'github', // GitHub operations
  'general', // General purpose tasks
]);
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
 * Zod schema for citation
 */
export const CitationSchema = z.object({
  id: z.string(),
  source: z.string(),
  content: z.string(),
  confidence: z.number().min(0).max(1),
  timestamp: z.number(),
});
