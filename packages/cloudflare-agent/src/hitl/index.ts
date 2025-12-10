/**
 * HITL (Human-in-the-Loop) Module
 *
 * Provides functionality for tool confirmation workflows where
 * sensitive operations require explicit user approval before execution.
 */

// Confirmation logic
export {
  type ConfirmableTool,
  type ConfirmationParseResult,
  type ConfirmationWithKeyboard,
  createToolConfirmation,
  DEFAULT_CONFIRMATION_EXPIRY_MS,
  DEFAULT_HIGH_RISK_TOOLS,
  determineRiskLevel,
  filterExpiredConfirmations,
  formatConfirmationRequest,
  formatConfirmationWithKeyboard,
  formatMultipleConfirmations,
  formatMultipleConfirmationsWithKeyboard,
  hasToolConfirmation,
  isConfirmationValid,
  parseConfirmationResponse,
  type RiskLevel,
  requiresConfirmation,
} from './confirmation.js';
// Executions
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
// Keyboards for Telegram inline interactions
export {
  createConfirmationKeyboard,
  createFeedbackKeyboard,
  createMultiConfirmationKeyboard,
  createQuickActionsKeyboard,
  isValidCallbackData,
  validateKeyboard,
} from './keyboards.js';
// State machine
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
