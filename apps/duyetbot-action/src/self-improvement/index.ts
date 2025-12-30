/**
 * Self-Improvement System
 *
 * Main export for the self-improvement system
 */

// Types - export enums as values, other types as type-only
export { ErrorCategory, ErrorSeverity } from './types.js';
export type {
  ParsedError,
  FixSuggestion,
  VerificationCheck,
  VerificationResult,
  RecoveryResult,
  FailurePattern,
  LearnedFix,
  PostMortemAnalysis,
  SelfImprovementConfig,
  RecoveryContext,
} from './types.js';

// Auto-merge types
export type {
  AutoMergeConfig,
  AutoMergeResult,
  PRStatus,
  StatusCheck,
} from './auto-merge.js';

// Error analyzer
export { ErrorAnalyzer, errorAnalyzer } from './error-analyzer.js';

// Verification loop
export { VerificationLoop, verifyWorkDir } from './verification-loop.js';

// Failure memory
export { FailureMemory, getFailureMemory } from './failure-memory.js';

// Auto-merge
export { AutoMergeService, autoMergePR } from './auto-merge.js';

/**
 * Initialize self-improvement system
 */
export async function initializeSelfImprovement(memoryPath: string) {
  const { getFailureMemory } = await import('./failure-memory.js');
  const memory = getFailureMemory(memoryPath);
  await memory.load();

  return {
    memory,
    analyzer: await import('./error-analyzer.js').then((m) => m.errorAnalyzer),
  };
}

/**
 * Create a self-improvement enabled agent
 */
export function createSelfImprovingAgent(config: {
  memoryPath: string;
  verifyBeforePR?: boolean;
  autoFix?: boolean;
  maxRecoveryAttempts?: number;
}) {
  return {
    async verify(workDir: string) {
      const { VerificationLoop } = await import('./verification-loop.js');
      const loop = new VerificationLoop({ cwd: workDir });
      return loop.verify();
    },

    async analyzeErrors(output: string) {
      const { errorAnalyzer } = await import('./error-analyzer.js');
      return errorAnalyzer.parseErrors(output);
    },

    async getFix(error: import('./types.js').ParsedError) {
      const { getFailureMemory } = await import('./failure-memory.js');
      const memory = getFailureMemory(config.memoryPath);
      return memory.getFixForError(error);
    },

    async recordSuccess(error: any, fix: any) {
      const { getFailureMemory } = await import('./failure-memory.js');
      const memory = getFailureMemory(config.memoryPath);
      return memory.recordSuccess(error, fix);
    },
  };
}
