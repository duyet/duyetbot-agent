/**
 * @duyetbot/chat-agent
 *
 * Reusable chat agent with LLM and MCP tools support
 */

// Core agent
export { ChatAgent } from './agent.js';
// Cloudflare Durable Object wrapper
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
// Transport layer
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
  LLMMessage,
  LLMProvider,
  LLMResponse,
  Message,
  MessageRole,
  OpenAITool,
  Tool,
  ToolCall,
  ToolExecutor,
} from './types.js';

// =============================================================================
// NEW: Routing & Orchestration Architecture
// =============================================================================

// Agents (Router, Simple, HITL, Orchestrator)
export {
  type AgentContext,
  AgentMixin,
  type AgentResult,
  type BaseAgentConfig,
  type BaseAgentState,
  createBaseState,
  createHITLAgent,
  createOrchestratorAgent,
  createRouterAgent,
  createSimpleAgent,
  getTypedAgent,
  type HITLAgentClass,
  type HITLAgentConfig,
  type HITLAgentEnv,
  type HITLAgentInstance,
  type HITLAgentMethods,
  type HITLAgentState,
  isAgent,
  type OrchestratorAgentClass,
  type OrchestratorAgentConfig,
  type OrchestratorAgentEnv,
  type OrchestratorAgentInstance,
  type OrchestratorAgentMethods,
  type OrchestratorAgentState,
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
  type SimpleAgentMethods,
  type SimpleAgentState,
} from './agents/index.js';
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
// Workers (Base, Code, Research, GitHub)
export {
  type BaseWorkerConfig,
  type BaseWorkerEnv,
  type BaseWorkerState,
  type CodeTaskType,
  type CodeWorkerConfig,
  type CodeWorkerEnv,
  createBaseWorker,
  createCodeWorker,
  createGitHubWorker,
  createResearchWorker,
  detectCodeTaskType,
  detectGitHubTaskType,
  detectResearchTaskType,
  formatDependencyContext,
  type GitHubTaskType,
  type GitHubWorkerConfig,
  type GitHubWorkerEnv,
  isSuccessfulResult,
  type ResearchTaskType,
  type ResearchWorkerConfig,
  type ResearchWorkerEnv,
  summarizeResults,
  type WorkerClass,
  type WorkerInput,
  type WorkerMethods,
  type WorkerType,
} from './workers/index.js';
