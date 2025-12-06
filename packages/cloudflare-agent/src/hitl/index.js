/**
 * HITL (Human-in-the-Loop) Module
 *
 * Provides functionality for tool confirmation workflows where
 * sensitive operations require explicit user approval before execution.
 */
// Confirmation logic
export {
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
  requiresConfirmation,
} from './confirmation.js';
// Executions
export {
  createMockExecutor,
  createRegistryExecutor,
  executeApprovedTools,
  executeTool,
  executeToolsParallel,
  formatExecutionResults,
} from './executions.js';
// State machine
export {
  canTransitionTo,
  createInitialHITLState,
  getApprovedConfirmations,
  getExpiredConfirmationIds,
  getPendingConfirmations,
  hasExpiredConfirmations,
  isAwaitingConfirmation,
  transitionHITLState,
} from './state-machine.js';
