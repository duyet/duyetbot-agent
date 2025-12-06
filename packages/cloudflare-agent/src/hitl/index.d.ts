/**
 * HITL (Human-in-the-Loop) Module
 *
 * Provides functionality for tool confirmation workflows where
 * sensitive operations require explicit user approval before execution.
 */
export {
  type ConfirmableTool,
  type ConfirmationParseResult,
  createToolConfirmation,
  DEFAULT_CONFIRMATION_EXPIRY_MS,
  DEFAULT_HIGH_RISK_TOOLS,
  determineRiskLevel,
  filterExpiredConfirmations,
  formatConfirmationRequest,
  formatMultipleConfirmations,
  hasToolConfirmation,
  isConfirmationValid,
  parseConfirmationResponse,
  type RiskLevel,
  requiresConfirmation,
} from './confirmation.js';
export {
  type BatchExecutionResult,
  createMockExecutor,
  createRegistryExecutor,
  type ExecutionOptions,
  executeApprovedTools,
  executeTool,
  executeToolsParallel,
  formatExecutionResults,
  type ToolExecutor,
} from './executions.js';
export {
  canTransitionTo,
  createInitialHITLState,
  type ExecutionEntry,
  getApprovedConfirmations,
  getExpiredConfirmationIds,
  getPendingConfirmations,
  type HITLEvent,
  type HITLState,
  type HITLStatus,
  hasExpiredConfirmations,
  isAwaitingConfirmation,
  transitionHITLState,
} from './state-machine.js';
//# sourceMappingURL=index.d.ts.map
