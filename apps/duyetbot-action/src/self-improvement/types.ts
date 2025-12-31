/**
 * Self-Improvement Types
 *
 * Core types for error detection, recovery, and learning
 */

/**
 * Error categories for classification
 */
export const enum ErrorCategory {
  // Build & compilation
  BUILD = 'build',
  DEPENDENCY = 'dependency',

  // Type system
  TYPE = 'type',
  TYPE_MISSING = 'type_missing',
  TYPE_MISMATCH = 'type_mismatch',

  // Code quality
  LINT = 'lint',
  FORMAT = 'format',

  // Testing
  TEST_FAILURE = 'test_failure',
  TEST_TIMEOUT = 'test_timeout',

  // Runtime
  RUNTIME = 'runtime',
  RUNTIME_REFERENCE = 'runtime_reference',

  // Git & repository
  GIT = 'git',
  MERGE_CONFLICT = 'merge_conflict',

  // Unknown
  UNKNOWN = 'unknown',
}

/**
 * Severity levels
 */
export const enum ErrorSeverity {
  LOW = 'low',       // Warnings, style issues
  MEDIUM = 'medium', // Type errors, test failures
  HIGH = 'high',     // Build failures, runtime errors
  CRITICAL = 'critical', // Blocks all progress
}

/**
 * Parsed error information
 */
export interface ParsedError {
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  file?: string;
  line?: number;
  column?: number;
  code?: string;        // Error code (e.g., TS2322)
  stack?: string;       // Stack trace if available
  context?: string;     // Lines of code around the error
}

/**
 * Fix suggestion
 */
export interface FixSuggestion {
  error: ParsedError;
  description: string;
  confidence: number;  // 0-1, how confident we are this will work
  autoAppliable: boolean;
  patch?: {
    file: string;
    oldText: string;
    newText: string;
  };
  command?: {
    cwd: string;
    command: string;
    args: string[];
  };
}

/**
 * Verification check result
 */
export interface VerificationCheck {
  name: string;
  passed: boolean;
  duration: number;
  output: string;
  errors?: ParsedError[];
}

/**
 * Verification result
 */
export interface VerificationResult {
  passed: boolean;
  checks: VerificationCheck[];
  totalDuration: number;
  errors: ParsedError[];
}

/**
 * Recovery attempt result
 */
export interface RecoveryResult {
  success: boolean;
  attempts: number;
  fixesApplied: FixSuggestion[];
  remainingErrors: ParsedError[];
}

/**
 * Failure pattern for learning
 */
export interface FailurePattern {
  id: string;
  category: ErrorCategory;
  pattern: string;      // Regex pattern to match errors
  symptom: string;      // Human-readable description
  solution: string;     // How to fix it
  frequency: number;    // How often seen
  lastSeen: number;     // Timestamp
  successRate: number;  // 0-1, how often fix works
  exampleError: string; // Example error message
}

/**
 * Learned fix from past success
 */
export interface LearnedFix {
  id: string;
  errorSignature: string;  // Hash of error pattern
  fix: {
    type: 'patch' | 'command' | 'refactor';
    description: string;
    patch?: FixSuggestion['patch'];
    command?: FixSuggestion['command'];
  };
  appliedAt: number;
  worked: boolean;
  timesSeen: number;
  timesSuccessful: number;
}

/**
 * Post-mortem analysis result
 */
export interface PostMortemAnalysis {
  taskId: string;
  duration: number;
  success: boolean;
  errorsEncountered: ParsedError[];
  fixesAttempted: FixSuggestion[];
  successfulFixes: FixSuggestion[];
  failedFixes: FixSuggestion[];
  lessonsLearned: string[];
  newPatterns: FailurePattern[];
  suggestions: string[];
}

/**
 * Self-improvement configuration
 */
export interface SelfImprovementConfig {
  enabled: boolean;
  maxRecoveryAttempts: number;
  autoFixEnabled: boolean;
  verifyBeforePR: boolean;
  learnFromFailures: boolean;
  memoryPath: string;
}

/**
 * Recovery context
 */
export interface RecoveryContext {
  workDir: string;
  taskId: string;
  attemptNumber: number;
  maxAttempts: number;
  previousFixes: FixSuggestion[];
  errorHistory: ParsedError[];
}
