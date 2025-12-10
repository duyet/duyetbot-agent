/**
 * @duyetbot/cloudflare-agent
 *
 * Reusable chat agent with LLM and MCP tools support
 */

// Core agent
export { ChatAgent } from './agent.js';
// Batch types (alarm-based processing)
// DEPRECATED: Legacy module for backward compatibility with cloudflare-agent.ts
// Use ExecutionContext and AgentProvider from './execution/' for new implementations.
export {
  type BatchConfig,
  type BatchState,
  type BatchStatus,
  calculateRetryDelay,
  combineBatchMessages,
  createInitialBatchState,
  createInitialEnhancedBatchState,
  DEFAULT_BATCH_CONFIG,
  DEFAULT_RETRY_CONFIG,
  type EnhancedBatchState,
  isDuplicateMessage,
  type MessageStage,
  type PendingMessage,
  type RetryConfig,
  type RetryError,
  type StageTransition,
  shouldProcessImmediately,
} from './batch-types.js';
// Cloudflare Durable Object wrapper
// DEPRECATED: Legacy module for backward compatibility during migration to new agent architecture
// Use createChatAgent() from './agents/chat-agent.js' for new implementations.
// MCPServerConnection is still exported for use by mcp-worker but will be refactored separately.
export {
  type CloudflareAgentConfig,
  type CloudflareAgentState,
  type CloudflareChatAgentClass,
  type CloudflareChatAgentMethods,
  type CloudflareChatAgentNamespace,
  createCloudflareChatAgent,
  getChatAgent,
  type MCPServerConnection,
  type RouterConfig,
} from './cloudflare-agent.js';
// Debug footer utilities
export {
  escapeHtml,
  escapeMarkdownV2,
  formatDebugFooter,
  formatDebugFooterMarkdownV2,
  formatProgressiveDebugFooter,
  smartEscapeMarkdownV2,
} from './debug-footer.js';
// Factory
export { createAgent } from './factory.js';
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
  type ProgressConfig,
  type QuotedContext,
  type ThinkingRotator,
  type ThinkingRotatorConfig,
  type ToolExecution,
  type ToolStatus,
} from './format.js';
// Utilities
export { formatForLLM, getMessageText, trimHistory } from './history.js';
export {
  createMCPMemoryAdapter,
  createResilientMCPMemoryAdapter,
  DEFAULT_MEMORY_MCP_URL,
  MCPMemoryAdapter,
  type MCPMemoryAdapterConfig,
  MCPMemoryAdapterError,
  ResilientMCPMemoryAdapter,
} from './mcp-memory-adapter.js';
// Memory adapters
export type {
  MemoryAdapter,
  MemoryData,
  MemoryMessage,
  MemorySearchResult,
  SaveMemoryResult,
  SessionInfo,
} from './memory-adapter.js';
export { fromMemoryMessage, toMemoryMessage } from './memory-adapter.js';
// Service binding adapter (for Cloudflare Workers)
export {
  createServiceBindingMemoryAdapter,
  type MemoryServiceBinding,
  ServiceBindingMemoryAdapter,
  type ServiceBindingMemoryAdapterConfig,
} from './service-binding-adapter.js';
// Step progress tracker
export {
  createStepProgressTracker,
  StepProgressTracker,
} from './step-progress.js';
// Transport layer
export {
  TransportManager,
  type TransportManagerConfig,
} from './transport/index.js';
export type {
  MessageRef,
  ParsedInput,
  Transport,
  TransportHooks,
} from './transport.js';
// Types
export type {
  AgentState,
  ChatAgentConfig,
  DebugContext,
  LLMMessage,
  LLMProvider,
  LLMResponse,
  Message,
  MessageRole,
  OpenAITool,
  // Step progress types
  StepEvent,
  StepProgressConfig,
  StepType,
  Tool,
  ToolCall,
  ToolExecutor,
  WebSearchPlugin,
} from './types.js';

// =============================================================================
// NEW: Routing & Orchestration Architecture
// =============================================================================

// Agents (Router, Simple, HITL, Orchestrator, DuyetInfo)
export {
  type AgentContext,
  AgentMixin,
  type AgentResult,
  type BaseAgentConfig,
  type BaseAgentState,
  type CommonPlatformConfig,
  createBaseState,
  createDuyetInfoAgent,
  createHITLAgent,
  createOrchestratorAgent,
  createRouterAgent,
  createSimpleAgent,
  type DuyetInfoAgentClass,
  type DuyetInfoAgentConfig,
  type DuyetInfoAgentEnv,
  type DuyetInfoAgentInstance,
  type DuyetInfoAgentMethods,
  type DuyetInfoAgentState,
  duyetToolFilter,
  type GenericPlatformConfig,
  type GitHubPlatformConfig,
  getTypedAgent,
  type HITLAgentClass,
  type HITLAgentConfig,
  type HITLAgentEnv,
  type HITLAgentInstance,
  type HITLAgentMethods,
  type HITLAgentState,
  isAgent,
  type OrchestratorAgentClass,
  type OrchestratorAgentInstance,
  type OrchestratorConfig,
  type OrchestratorEnv,
  type OrchestratorMethods,
  type OrchestratorState,
  type PlatformConfig,
  type RouterAgentClass,
  type RouterAgentConfig,
  type RouterAgentEnv,
  type RouterAgentInstance,
  type RouterAgentMethods,
  type RouterAgentState,
  type SimpleAgentClass,
  type SimpleAgentConfig,
  type SimpleAgentEnv,
  type SimpleAgentInstance,
  type SimpleAgentState,
  type TelegramPlatformConfig,
} from './agents/index.js';
// Context Module (Unified Pipeline Context)
export {
  // Types
  type AgentSpan,
  // Span context (parallel execution)
  addErrorSpan,
  addWarningSpan,
  completeSpan,
  // Global context factory and serialization
  createGlobalContext,
  createSpanContext,
  deserializeContext,
  type GitHubEnv,
  type GitHubWebhookContext,
  type GlobalContext,
  githubToWebhookInput,
  type RoutingDecisionRecord,
  recordTokenUsageSpan,
  recordToolCallSpan,
  type SpanContext,
  serializeContext,
  setMetadataSpan,
  type TelegramEnv,
  type TelegramUpdate,
  type TokenUsageRecord,
  type ToolCallRecord,
  // Webhook adapters
  telegramToWebhookInput,
  type WebhookInput,
} from './context/index.js';
// Execution Context
export {
  type AgentProvider,
  type AgentSpan as ExecutionAgentSpan,
  addDebugError,
  addDebugWarning,
  type ChatOptions,
  createDebugAccumulator,
  createProviderContext,
  createSpanId,
  createTraceId,
  type DebugAccumulator,
  type DebugToolCall,
  type ExecutionContext,
  type ExtendedAgentProvider,
  type ParsedInputOptions,
  type Platform,
  type ProviderExecutionContext,
  recordAgentSpan,
  recordToolCall,
} from './execution/index.js';
// Feature Flags
export {
  type FeatureFlagEnv,
  parseFlagsFromEnv,
  type RoutingFlags,
  RoutingFlagsSchema,
} from './feature-flags.js';

// HITL (Human-in-the-Loop)
export {
  type BatchExecutionResult,
  type ConfirmableTool,
  type ConfirmationParseResult,
  canTransitionTo,
  createInitialHITLState,
  createMockExecutor,
  createRegistryExecutor,
  createToolConfirmation,
  DEFAULT_CONFIRMATION_EXPIRY_MS,
  DEFAULT_HIGH_RISK_TOOLS,
  determineRiskLevel,
  type ExecutionEntry,
  type ExecutionOptions,
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
  type HITLEvent,
  type HITLState,
  type HITLStatus,
  hasExpiredConfirmations,
  hasToolConfirmation,
  isAwaitingConfirmation,
  isConfirmationValid,
  parseConfirmationResponse,
  type RiskLevel,
  requiresConfirmation,
  type ToolExecutor as HITLToolExecutor,
  transitionHITLState,
} from './hitl/index.js';

// Orchestration (Planner, Executor, Aggregator)
export {
  type AggregationResult,
  type AggregatorConfig,
  aggregateResults,
  createMockDispatcher,
  createPlan,
  createWorkerDispatcher,
  type ExecutionProgressCallback,
  type ExecutionResult,
  type ExecutorConfig,
  executePlan,
  extractKeyFindings,
  groupStepsByLevel,
  optimizePlan,
  type PlannerConfig,
  type PlanningContext,
  quickAggregate,
  validatePlanDependencies,
  type WorkerDispatcher,
} from './orchestration/index.js';
// Routing (Classification, Schemas)
export {
  type ClassificationContext,
  type ClassifierConfig,
  ComplexityLevel,
  classifyQuery,
  createClassifier,
  determineRouteTarget,
  type ExecutionPlan,
  ExecutionPlanSchema,
  hybridClassify,
  type PlanStep,
  PlanStepSchema,
  QueryCategory,
  type QueryClassification,
  QueryClassificationSchema,
  QueryType,
  quickClassify,
  RouteTarget,
  type RoutingDecision,
  RoutingDecisionSchema,
  type ToolConfirmation,
  ToolConfirmationSchema,
  type WorkerResult,
  WorkerResultSchema,
} from './routing/index.js';
// Workers (Base, Code, Research, GitHub, SubAgent Protocol)
export {
  type BaseWorkerConfig,
  type BaseWorkerEnv,
  type BaseWorkerState,
  type CodeTaskType,
  type CodeWorkerConfig,
  type CodeWorkerEnv,
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
  type GitHubTaskType,
  type GitHubWorkerConfig,
  type GitHubWorkerEnv,
  type HealthCheckResult,
  isSuccessfulResult,
  type ResearchTaskType,
  type ResearchWorkerConfig,
  type ResearchWorkerEnv,
  type SubAgentCapability,
  type SubAgentMetadata,
  type SubAgentWorker,
  type SubAgentWorkerResult,
  summarizeResults,
  validateReplanningRequest,
  type WorkerClass,
  type WorkerInput,
  type WorkerMethods,
  WorkerRegistry,
  type WorkerRegistryEntry,
  type WorkerType,
} from './workers/index.js';

// =============================================================================
// State Management DO (Observability & Watchdog)
// =============================================================================

// State DO
// DEPRECATED: Legacy observability module during migration to ExecutionContext-based design
// Use createDebugAccumulator() and ExecutionContext from './execution/' for new implementations.
export { StateDO, type StateDOEnv } from './agents/state-do.js';

// State types
// DEPRECATED: Legacy types for backward compatibility with cloudflare-agent.ts and state-do.ts
// Use ExecutionContext, DebugAccumulator, and AgentSpan from './execution/' for new implementations.
export {
  type AgentMetrics,
  type AggregatedMetrics,
  type CompleteBatchParams,
  createInitialStateDOState,
  createSessionState,
  DEFAULT_STUCK_THRESHOLD_MS,
  type ExecutionTrace,
  type HeartbeatParams,
  type LogTraceParams,
  MAX_TRACES,
  type MarkDelegatedParams,
  type Platform as StatePlatform,
  type RecoveryResult,
  type RegisterBatchParams,
  type ResponseTarget,
  type SessionState,
  type StateDOMethods,
  type StateDOState,
  type TraceStatus,
  type TrackedBatchStatus,
  WATCHDOG_INTERVAL_SECONDS,
} from './state-types.js';

// =============================================================================
// Safety Kernel Integration
// =============================================================================

// Heartbeat emission for dead man's switch
export {
  createHeartbeatEmitter,
  emitHeartbeat,
  emitHeartbeatHttp,
  HEARTBEAT_KEYS,
  HEARTBEAT_MIN_INTERVAL_MS,
  type HeartbeatData,
  type HeartbeatEnv,
  type HeartbeatMetadata,
} from './safety/index.js';

// =============================================================================
// Agentic Scheduler (Phase 2)
// =============================================================================

// Scheduler types
export type {
  ActivityPatterns,
  EnergyBudget,
  EnergyCost,
  ScheduledTask,
  SchedulerConfig,
  SchedulerState,
  TaskExecutionResult,
  TaskSource,
  TaskType,
} from './scheduler/index.js';

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
  type ResearchFinding,
  type ResearchResult,
  type ResearchSource,
  type ResearchTaskPayload,
  regenerateEnergy,
  removeTask,
  // Scheduler DO
  SchedulerDO,
  type SchedulerDOContext,
  type SchedulerDOEnv,
  type SchedulerStatus,
  type ScheduleTaskOptions,
  scheduleMaintenance,
  scheduleNotification,
  scheduleResearch,
  scheduleResearchTask,
  scheduleTask,
  type TasteFilter,
  triggerSchedulerTick,
  type WakeUpDecision,
} from './scheduler/index.js';

// =============================================================================
// NEW: Modular Architecture (Phase 2-5 Refactoring)
// =============================================================================

// Adapters (Dependency Injection)
export {
  type CompleteBatchParams as StateCompleteBatchParams,
  D1MessagePersistence,
  D1ObservabilityAdapter,
  type HeartbeatParams as StateHeartbeatParams,
  // Message Persistence
  type IMessagePersistence,
  // Observability
  type IObservabilityAdapter,
  // State Reporting
  type IStateReporter,
  MemoryMessagePersistence,
  NoOpObservabilityAdapter,
  NoOpStateReporter,
  type ObservabilityEventData,
  type RegisterBatchParams as StateRegisterBatchParams,
  type SessionId,
  StateDOReporter,
} from './adapters/index.js';

// Batch Processing Module
export {
  type BatchProcessingResult,
  BatchProcessor,
  type BatchProcessorConfig,
  type BatchProcessorDeps,
  BatchQueue,
  ContextBuilder,
  createBatchProcessor,
  type QueueResult,
  StuckDetector,
} from './batch/index.js';

// Core Module (Slim Orchestrator) - Re-exports for convenience
export {
  type AdapterBundle,
  createAdapterFactory,
} from './core/index.js';

// Notifications Module (Admin Alerts)
export {
  AdminNotifier,
  type AdminNotifierConfig,
  type BatchFailureDetails,
  DEFAULT_ADMIN_NOTIFIER_CONFIG,
  formatBatchFailureMessage,
  formatStuckBatchMessage,
  type StuckBatchDetails,
} from './notifications/index.js';
