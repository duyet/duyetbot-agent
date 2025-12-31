/**
 * Safety Types
 */

/**
 * Safety check result
 */
export interface SafetyCheckResult {
  /** Check passed */
  passed: boolean;
  /** Severity of any violations */
  severity: 'safe' | 'warning' | 'danger' | 'critical';
  /** Violations found */
  violations: SafetyViolation[];
  /** Recommendations */
  recommendations: string[];
}

/**
 * Safety violation
 */
export interface SafetyViolation {
  /** Violation type */
  type: ViolationType;
  /** Severity level */
  severity: 'warning' | 'danger' | 'critical';
  /** Violation message */
  message: string;
  /** File or context where violation occurred */
  context?: string;
  /** Suggested fix */
  suggestion?: string;
}

/**
 * Violation types
 */
export type ViolationType =
  | 'destructive_operation'
  | 'sensitive_data'
  | 'infinite_loop'
  | 'resource_exhaustion'
  | 'security_issue'
  | 'dependency_attack'
  | 'unauthorized_access'
  | 'data_loss'
  | 'credential_leak'
  | 'malicious_code';

/**
 * Safety rule
 */
export interface SafetyRule {
  /** Rule name */
  name: string;
  /** Rule description */
  description: string;
  /** Violation type */
  type: ViolationType;
  /** Check function */
  check: (context: SafetyContext) => SafetyViolation | null;
  /** Enabled */
  enabled: boolean;
}

/**
 * Safety context
 */
export interface SafetyContext {
  /** Operation being performed */
  operation: string;
  /** Files being modified */
  files: string[];
  /** Commands being executed */
  commands?: string[];
  /** Network requests */
  requests?: Array<{ url: string; method: string }>;
  /** User intent */
  intent?: string;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Safety policy
 */
export interface SafetyPolicy {
  /** Allow destructive operations */
  allowDestructive: boolean;
  /** Allow file modifications outside working directory */
  allowOutsideWrites: boolean;
  /** Allow network access */
  allowNetwork: boolean;
  /** Maximum file size to read/write (bytes) */
  maxFileSize: number;
  /** Maximum execution time (ms) */
  maxExecutionTime: number;
  /** Blocked file patterns */
  blockedFiles: string[];
  /** Blocked commands */
  blockedCommands: string[];
  /** Blocked domains */
  blockedDomains: string[];
  /** Require approval for */
  requireApproval: ViolationType[];
}
