/**
 * Self-Improvement Types
 */

/**
 * Improvement opportunity types
 */
export type OpportunityType =
  | 'bug_fix'
  | 'performance'
  | 'code_quality'
  | 'feature_addition'
  | 'refactoring'
  | 'documentation'
  | 'test_coverage'
  | 'security';

/**
 * Improvement opportunity
 */
export interface ImprovementOpportunity {
  /** Unique identifier */
  id: string;
  /** Type of improvement */
  type: OpportunityType;
  /** Title/summary */
  title: string;
  /** Detailed description */
  description: string;
  /** Files affected */
  files: string[];
  /** Estimated complexity (1-10) */
  complexity: number;
  /** Estimated impact (1-10) */
  impact: number;
  /** Proposed solution */
  solution: string;
  /** Dependencies on other improvements */
  dependencies?: string[];
}

/**
 * Improvement plan
 */
export interface ImprovementPlan {
  /** Plan identifier */
  id: string;
  /** Opportunities included */
  opportunities: ImprovementOpportunity[];
  /** Execution order (opportunity IDs) */
  executionOrder: string[];
  /** Total estimated complexity */
  totalComplexity: number;
  /** Total estimated impact */
  totalImpact: number;
}

/**
 * Improvement result
 */
export interface ImprovementResult {
  /** Opportunity ID */
  opportunityId: string;
  /** Success status */
  success: boolean;
  /** Changes made */
  changes: Array<{
    file: string;
    type: 'created' | 'modified' | 'deleted';
    description: string;
  }>;
  /** Output/summary */
  output: string;
  /** Error if failed */
  error?: string;
  /** Duration in ms */
  duration: number;
}

/**
 * Improvement cycle result
 */
export interface ImprovementCycleResult {
  /** Cycle ID */
  cycleId: string;
  /** Start timestamp */
  startTime: number;
  /** End timestamp */
  endTime: number;
  /** Total duration */
  duration: number;
  /** Number of opportunities processed */
  opportunitiesProcessed: number;
  /** Number of successful improvements */
  successful: number;
  /** Number of failed improvements */
  failed: number;
  /** Individual results */
  results: ImprovementResult[];
  /** Rollback performed */
  rolledBack?: boolean;
  /** Summary */
  summary: string;
}

/**
 * Self-improvement configuration
 */
export interface SelfImprovementConfig {
  /** Maximum complexity per cycle */
  maxComplexity?: number;
  /** Maximum opportunities per cycle */
  maxOpportunities?: number;
  /** Allowed opportunity types */
  allowedTypes?: OpportunityType[];
  /** Blocked files (regex patterns) */
  blockedFiles?: string[];
  /** Required opportunity types */
  requiredTypes?: OpportunityType[];
  /** Dry run (no changes) */
  dryRun?: boolean;
  /** Auto-rollback on failure */
  autoRollback?: boolean;
  /** Skip tests (not recommended) */
  skipTests?: boolean;
  /** Skip deployment (not recommended) */
  skipDeploy?: boolean;
}

/**
 * Analysis context
 */
export interface AnalysisContext {
  /** Repository root */
  root: string;
  /** Branch name */
  branch: string;
  /** Recent commits */
  recentCommits: number;
  /** Focus areas (specific files/directories) */
  focusAreas?: string[];
  /** Exclude patterns */
  exclude?: string[];
}

/**
 * Validation result
 */
export interface ValidationResult {
  /** Passed validation */
  passed: boolean;
  /** Type check result */
  typeCheck: { success: boolean; errors?: string };
  /** Lint result */
  lint: { success: boolean; errors?: string };
  /** Test result */
  tests: { success: boolean; errors?: string };
  /** Build result */
  build: { success: boolean; errors?: string };
  /** Overall errors */
  errors: string[];
}

/**
 * Rollback result
 */
export interface RollbackResult {
  /** Rollback successful */
  success: boolean;
  /** Files reverted */
  files: string[];
  /** Error if failed */
  error?: string;
}
