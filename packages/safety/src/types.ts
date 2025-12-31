/**
 * Safety Types
 *
 * Type definitions for safety validation layer.
 */

/**
 * Severity levels for safety violations
 */
export type Severity = 'critical' | 'danger' | 'warning' | 'info';

/**
 * Safety violation types
 */
export type ViolationType =
  | 'credential_leak'
  | 'destructive_operation'
  | 'security_issue'
  | 'infinite_loop'
  | 'data_loss'
  | 'unauthorized_access'
  | 'resource_exhaustion';

/**
 * Safety check result
 */
export interface SafetyCheckResult {
  /** Whether the check passed */
  passed: boolean;
  /** Violations found (if any) */
  violations: SafetyViolation[];
  /** Whether to block the operation */
  shouldBlock: boolean;
}

/**
 * Individual safety violation
 */
export interface SafetyViolation {
  /** Type of violation */
  type: ViolationType;
  /** Severity level */
  severity: Severity;
  /** Description of the violation */
  message: string;
  /** Context where violation occurred */
  context: string;
  /** Suggested fix */
  suggestion: string;
}

/**
 * Safety check context
 */
export interface SafetyContext {
  /** Files being operated on */
  files: string[];
  /** Commands being executed */
  commands?: string[];
  /** Network requests being made */
  requests?: NetworkRequest[];
  /** Additional context data */
  metadata?: Record<string, unknown>;
}

/**
 * Network request information
 */
export interface NetworkRequest {
  /** Request URL */
  url: string;
  /** Request method */
  method: string;
  /** Request headers */
  headers?: Record<string, string>;
}

/**
 * Safety rule definition
 */
export interface SafetyRule {
  /** Rule name/identifier */
  name: string;
  /** Rule description */
  description: string;
  /** Type of violation this rule checks */
  type: ViolationType;
  /** Whether rule is enabled */
  enabled: boolean;
  /** Check function */
  check: (ctx: SafetyContext) => SafetyViolation | null;
}

/**
 * Safety policy configuration
 */
export interface SafetyPolicy {
  /** Policy name */
  name: string;
  /** Description */
  description: string;
  /** Whether policy is enabled */
  enabled: boolean;
  /** Violation types to block */
  blockTypes: ViolationType[];
  /** Severities to block */
  blockSeverities: Severity[];
}
