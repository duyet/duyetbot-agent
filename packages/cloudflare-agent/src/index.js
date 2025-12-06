/**
 * @duyetbot/cloudflare-agent
 *
 * Reusable chat agent with LLM and MCP tools support
 */
// Core agent

// =============================================================================
// NEW: Modular Architecture (Phase 2-5 Refactoring)
// =============================================================================
// Adapters (Dependency Injection)
export {
  D1MessagePersistence,
  D1ObservabilityAdapter,
  MemoryMessagePersistence,
  NoOpObservabilityAdapter,
  NoOpStateReporter,
  StateDOReporter,
} from './adapters/index.js';
export { ChatAgent } from './agent.js';
// =============================================================================
// NEW: Routing & Orchestration Architecture
// =============================================================================
// Agents (Router, Simple, HITL, Orchestrator, DuyetInfo)
export {
  AgentMixin,
  createBaseState,
  createDuyetInfoAgent,
  createHITLAgent,
  createOrchestratorAgent,
  createRouterAgent,
  createSimpleAgent,
  duyetToolFilter,
  getTypedAgent,
  isAgent,
} from './agents/index.js';
// =============================================================================
// State Management DO (Observability & Watchdog)
// =============================================================================
// State DO
// DEPRECATED: Legacy observability module during migration to ExecutionContext-based design
// Use createDebugAccumulator() and ExecutionContext from './execution/' for new implementations.
export { StateDO } from './agents/state-do.js';
// Batch Processing Module
export {
  BatchProcessor,
  BatchQueue,
  ContextBuilder,
  createBatchProcessor,
  StuckDetector,
} from './batch/index.js';
// Batch types (alarm-based processing)
// DEPRECATED: Legacy module for backward compatibility with cloudflare-agent.ts
// Use ExecutionContext and AgentProvider from './execution/' for new implementations.
export {
  calculateRetryDelay,
  combineBatchMessages,
  createInitialBatchState,
  createInitialEnhancedBatchState,
  DEFAULT_BATCH_CONFIG,
  DEFAULT_RETRY_CONFIG,
  isDuplicateMessage,
  shouldProcessImmediately,
} from './batch-types.js';
// Cloudflare Durable Object wrapper
// DEPRECATED: Legacy module for backward compatibility during migration to new agent architecture
// Use createChatAgent() from './agents/chat-agent.js' for new implementations.
// MCPServerConnection is still exported for use by mcp-worker but will be refactored separately.
export { createCloudflareChatAgent, getChatAgent } from './cloudflare-agent.js';
// Core Module (Slim Orchestrator) - Re-exports for convenience
export { createAdapterFactory } from './core/index.js';
// Debug footer utilities
export {
  escapeHtml,
  escapeMarkdownV2,
  formatDebugFooter,
  formatDebugFooterMarkdownV2,
  formatProgressiveDebugFooter,
  smartEscapeMarkdownV2,
} from './debug-footer.js';
// Execution Context
export {
  addDebugError,
  addDebugWarning,
  createDebugAccumulator,
  createProviderContext,
  createSpanId,
  createTraceId,
  recordAgentSpan,
  recordToolCall,
} from './execution/index.js';
// Factory
export { createAgent } from './factory.js';
// Feature Flags
export { parseFlagsFromEnv, RoutingFlagsSchema } from './feature-flags.js';
// Format utilities
export {
  cleanToolName,
  createThinkingRotator,
  formatCompleteResponse,
  formatErrorMessage,
  formatHistoryAsXML,
  formatThinkingMessage,
  formatToolProgress,
  formatWithEmbeddedHistory,
  getDefaultThinkingMessages,
  getExtendedThinkingMessages,
  getRandomThinkingMessage,
} from './format.js';
// Utilities
export { formatForLLM, getMessageText, trimHistory } from './history.js';
// HITL (Human-in-the-Loop)
export {
  canTransitionTo,
  createInitialHITLState,
  createMockExecutor,
  createRegistryExecutor,
  createToolConfirmation,
  DEFAULT_CONFIRMATION_EXPIRY_MS,
  DEFAULT_HIGH_RISK_TOOLS,
  determineRiskLevel,
  executeApprovedTools,
  executeTool,
  executeToolsParallel,
  filterExpiredConfirmations,
  formatConfirmationRequest,
  formatExecutionResults,
  formatMultipleConfirmations,
  getApprovedConfirmations,
  getExpiredConfirmationIds,
  getPendingConfirmations,
  hasExpiredConfirmations,
  hasToolConfirmation,
  isAwaitingConfirmation,
  isConfirmationValid,
  parseConfirmationResponse,
  requiresConfirmation,
  transitionHITLState,
} from './hitl/index.js';
export {
  createMCPMemoryAdapter,
  createResilientMCPMemoryAdapter,
  DEFAULT_MEMORY_MCP_URL,
  MCPMemoryAdapter,
  MCPMemoryAdapterError,
  ResilientMCPMemoryAdapter,
} from './mcp-memory-adapter.js';
export { fromMemoryMessage, toMemoryMessage } from './memory-adapter.js';
// Orchestration (Planner, Executor, Aggregator)
export {
  aggregateResults,
  createMockDispatcher,
  createPlan,
  createWorkerDispatcher,
  executePlan,
  extractKeyFindings,
  groupStepsByLevel,
  optimizePlan,
  quickAggregate,
  validatePlanDependencies,
} from './orchestration/index.js';
// Routing (Classification, Schemas)
export {
  ComplexityLevel,
  classifyQuery,
  createClassifier,
  determineRouteTarget,
  ExecutionPlanSchema,
  hybridClassify,
  PlanStepSchema,
  QueryCategory,
  QueryClassificationSchema,
  QueryType,
  quickClassify,
  RouteTarget,
  RoutingDecisionSchema,
  ToolConfirmationSchema,
  WorkerResultSchema,
} from './routing/index.js';
// =============================================================================
// Safety Kernel Integration
// =============================================================================
// Heartbeat emission for dead man's switch
export {
  createHeartbeatEmitter,
  emitHeartbeat,
  emitHeartbeatHttp,
  HEARTBEAT_KEYS,
} from './safety/index.js';
// Scheduler DO and utilities
export {
  // Queue management
  addTask,
  // Energy management
  calculateEffectiveEnergyCost,
  // Proactive research
  calculateRelevance,
  calculateUrgency,
  canAffordTask,
  // Scheduler client (for apps to schedule tasks)
  cancelTask,
  cleanupStaleTasks,
  // State initialization
  createInitialEnergyBudget,
  createInitialSchedulerState,
  DEFAULT_ACTIVITY_PATTERNS,
  DEFAULT_ENERGY_COSTS,
  DEFAULT_PRIORITY_WEIGHTS,
  DEFAULT_RESEARCH_SOURCES,
  DEFAULT_SCHEDULER_CONFIG,
  DEFAULT_TASTE_FILTER,
  deductEnergy,
  ENERGY_CONSTANTS,
  executeResearchTask,
  fetchHackerNewsStories,
  findTasksByType,
  formatResearchDigest,
  getEnergyBreakdown,
  getEnergyPercentage,
  getQueueStats,
  getReadyTasks,
  getSchedulerStatus,
  getSchedulerStub,
  processHackerNewsStories,
  QUEUE_CONSTANTS,
  regenerateEnergy,
  removeTask,
  // Scheduler DO
  SchedulerDO,
  scheduleMaintenance,
  scheduleNotification,
  scheduleResearch,
  scheduleResearchTask,
  scheduleTask,
  triggerSchedulerTick,
} from './scheduler/index.js';
// Service binding adapter (for Cloudflare Workers)
export {
  createServiceBindingMemoryAdapter,
  ServiceBindingMemoryAdapter,
} from './service-binding-adapter.js';
// State types
// DEPRECATED: Legacy types for backward compatibility with cloudflare-agent.ts and state-do.ts
// Use ExecutionContext, DebugAccumulator, and AgentSpan from './execution/' for new implementations.
export {
  createInitialStateDOState,
  createSessionState,
  DEFAULT_STUCK_THRESHOLD_MS,
  MAX_TRACES,
  WATCHDOG_INTERVAL_SECONDS,
} from './state-types.js';
// Step progress tracker
export { createStepProgressTracker, StepProgressTracker } from './step-progress.js';
// Transport layer
export { TransportManager } from './transport/index.js';
// Workers (Base, Code, Research, GitHub, SubAgent Protocol)
export {
  createBaseWorker,
  createCodeWorker,
  createContextGatheringStep,
  createGitHubWorker,
  createResearchWorker,
  createSubAgentWorkerAdapter,
  defaultWorkerRegistry,
  detectCodeTaskType,
  detectGitHubTaskType,
  detectResearchTaskType,
  formatDependencyContext,
  isSuccessfulResult,
  summarizeResults,
  validateReplanningRequest,
  WorkerRegistry,
} from './workers/index.js';
