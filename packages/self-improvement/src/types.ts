/**
 * Self-Improvement Types
 *
 * Type definitions for autonomous self-improvement system.
 */

/**
 * Improvement opportunity types
 */
export type OpportunityType =
  | 'bug_fix'
  | 'code_quality'
  | 'performance'
  | 'security'
  | 'test_coverage'
  | 'documentation'
  | 'refactoring';

/**
 * Analysis context for improvement detection
 */
export interface AnalysisContext {
  /** Root directory to analyze */
  root: string;
  /** Recent commits to analyze */
  recentCommits?: number;
  /** File patterns to include */
  includePatterns?: string[];
  /** File patterns to exclude */
  excludePatterns?: string[];
}

/**
 * Individual improvement opportunity
 */
export interface ImprovementOpportunity {
  /** Unique identifier */
  id: string;
  /** Type of improvement */
  type: OpportunityType;
  /** Human-readable title */
  title: string;
  /** Detailed description */
  description: string;
  /** Affected files */
  files: string[];
  /** Estimated complexity (1-10) */
  complexity: number;
  /** Estimated impact (1-10) */
  impact: number;
  /** Suggested solution */
  solution: string;
}

/**
 * Improvement plan with prioritized opportunities
 */
export interface ImprovementPlan {
  /** Plan identifier */
  id: string;
  /** Opportunities in this plan */
  opportunities: ImprovementOpportunity[];
  /** Execution order of opportunity IDs */
  executionOrder: string[];
  /** Total complexity score */
  totalComplexity: number;
  /** Total impact score */
  totalImpact: number;
}

/**
 * Result of a single improvement execution
 */
export interface ImprovementResult {
  /** Opportunity that was executed */
  opportunity: ImprovementOpportunity;
  /** Whether execution succeeded */
  success: boolean;
  /** Changes made */
  changes: string[];
  /** Error message if failed */
  error?: string;
}

/**
 * Result of complete improvement cycle
 */
export interface ImprovementCycleResult {
  /** Plan that was executed */
  plan: ImprovementPlan;
  /** Individual results */
  results: ImprovementResult[];
  /** Number of successful improvements */
  succeeded: number;
  /** Number of failed improvements */
  failed: number;
  /** Whether changes were rolled back */
  rolledBack: boolean;
  /** Summary text */
  summary: string;
}

/**
 * Configuration for self-improvement behavior
 */
export interface SelfImprovementConfig {
  /** Maximum number of opportunities per cycle */
  maxOpportunities?: number;
  /** Maximum total complexity per cycle */
  maxComplexity?: number;
  /** Allowed opportunity types */
  allowedTypes?: OpportunityType[];
  /** Blocked file patterns */
  blockedFiles?: string[];
  /** Whether to auto-rollback on failure */
  autoRollback?: boolean;
  /** Whether to create git snapshot before changes */
  createSnapshot?: boolean;
}
