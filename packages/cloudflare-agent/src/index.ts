/**
 * @duyetbot/cloudflare-agent
 *
 * Reusable chat agent with LLM and MCP tools support
 */

// Re-export thinking messages from @duyetbot/progress
export {
  createRotator as createThinkingRotator,
  EXTENDED_MESSAGES as getExtendedThinkingMessages,
  getRandomMessage as getRandomThinkingMessage,
  THINKING_MESSAGES as getDefaultThinkingMessages,
  type ThinkingRotator,
  type ThinkingRotatorConfig,
} from '@duyetbot/progress';
// Core agent
export { ChatAgent } from './agent.js';
// Cloudflare Durable Object wrapper
// DEPRECATED: Legacy module for backward compatibility during migration to new agent architecture
// Use createChatAgent() from './agents/chat-agent.js' for new implementations.
// MCPServerConnection is still exported for use by mcp-worker but will be refactored separately.
export {
  type ActiveWorkflowExecution,
  createCloudflareChatAgent,
  getChatAgent,
  type MCPServerConnection,
} from './cloudflare-agent.js';
export type {
  AdminTelegramContext,
  TelegramContextFull,
  TelegramContextFull as TelegramContextWithRequiredFields,
} from './context-validation.js';
// Context validation & typing
export {
  assertAdminContext,
  assertContextComplete,
  hasMessagingFields,
  isAdminContext,
  TelegramContextBuilder,
  updateContextSafe,
  validateContextMiddleware,
} from './context-validation.js';
export type {
  CloudflareAgentConfig,
  CloudflareAgentState,
  CloudflareChatAgentClass,
  CloudflareChatAgentMethods,
  CloudflareChatAgentNamespace,
} from './core/types.js';
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
  formatCompleteResponse,
  formatErrorMessage,
  formatHistoryAsXML,
  formatThinkingMessage,
  formatToolProgress,
  formatWithEmbeddedHistory,
  type ProgressConfig,
  type QuotedContext,
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
// Mem0.ai memory adapter
export {
  createMem0MemoryAdapter,
  createResilientMem0MemoryAdapter,
  type DuyetbotCategory,
  MEM0_CATEGORY_MAP,
  Mem0AdapterError,
  type Mem0AddMemoryRequest,
  type Mem0AddMemoryResponse,
  type Mem0Category,
  type Mem0Config,
  type Mem0GetMemoriesRequest,
  type Mem0Memory,
  Mem0MemoryAdapter,
  type Mem0SearchRequest,
  ResilientMem0MemoryAdapter,
} from './mem0/index.js';
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
// Progress adapter (NEW - replaces StepProgressTracker)
export {
  ProgressTracker,
  type ProgressTrackerConfig,
} from './progress-adapter.js';
// Service binding adapter (for Cloudflare Workers)
export {
  createServiceBindingMemoryAdapter,
  type MemoryServiceBinding,
  ServiceBindingMemoryAdapter,
  type ServiceBindingMemoryAdapterConfig,
} from './service-binding-adapter.js';
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
  ChatOptions,
  Citation,
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
// Step progress tracker (DEPRECATED - use ProgressTracker instead)
export { StepProgressTracker } from './workflow/step-tracker.js';

// =============================================================================
// NEW: Routing & Orchestration Architecture
// =============================================================================

// Agents (Base Agent utilities and Chat Agent)
export {
  type AgentContext,
  AgentMixin,
  type AgentResult,
  type BaseAgentConfig,
  type BaseAgentState,
  type ChatAgentClass,
  type ChatAgentConfig,
  type ChatAgentEnv,
  type ChatAgentMethods,
  type ChatAgentState,
  type CommonPlatformConfig,
  createBaseState,
  createChatAgent,
  type GenericPlatformConfig,
  type GitHubPlatformConfig,
  getTypedAgent,
  isAgent,
  type PlatformConfig,
  type TelegramPlatformConfig,
} from './agents/index.js';
// Callbacks (Telegram Inline Keyboard Support)
export {
  type CallbackAction,
  type CallbackContext,
  type CallbackHandler,
  type CallbackResult,
  callbackHandlers,
  getCallbackDataSize,
  isValidAction,
  type ParsedCallback,
  parseCallbackData,
  serializeCallbackData,
} from './callbacks/index.js';
// Feature Flags
export {
  type FeatureFlagEnv,
  type MemoryFlags,
  MemoryFlagsSchema,
  parseFlagsFromEnv,
  parseMem0Flags,
  type RoutingFlags,
  RoutingFlagsSchema,
} from './feature-flags.js';

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
  // Observability
  type IObservabilityAdapter,
  // State Reporting
  type IStateReporter,
  MemoryMessagePersistence,
  NoOpObservabilityAdapter,
  NoOpStateReporter,
  type ObservabilityEventData,
  type RegisterBatchParams as StateRegisterBatchParams,
  StateDOReporter,
} from './adapters/index.js';

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

// =============================================================================
// NEW: Modular Components (Phase 1-7 Extraction)
// =============================================================================

// Re-export core modular components
export * from './auth/index.js';
// Chat module (LLM loop, tool execution, context building)
export {
  buildInitialMessages,
  buildToolIterationMessages,
  ChatLoop,
  type ChatLoopConfig,
  type ChatResult,
  type ContextBuilderConfig,
  getToolCalls,
  hasToolCalls,
  type MCPCallResult,
  type MCPToolCallParams,
  type ParsedResponse,
  parse,
  type ToolExecutionResult,
  ToolExecutor as ChatToolExecutor,
  type ToolExecutorConfig,
} from './chat/index.js';
export * from './commands/index.js';
export * from './events/index.js';
export * from './mcp/index.js';
// Persistence module (message store, session management)
export {
  createSessionId,
  formatSessionKey,
  MessageStore,
  parseSessionKey,
  type SessionId,
} from './persistence/index.js';
export * from './sanitization/index.js';
// Tracking module (token tracking, execution logging)
export {
  type ExecutionContext,
  type ExecutionLog,
  ExecutionLogger,
  type ExecutionLoggerOptions,
  type LogLevel,
  TokenTracker,
} from './tracking/index.js';
export * from './workflow/index.js';
