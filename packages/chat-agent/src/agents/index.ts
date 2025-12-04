/**
 * Agents Module
 *
 * Agent implementations for the routing/orchestration system.
 *
 * IMPORTANT: Agent modules must be imported BEFORE using routing functions
 * because agents self-register at module load time. The imports below
 * trigger registration in the agentRegistry.
 */

// Base agent utilities
export {
  type AgentContext,
  AgentMixin,
  type AgentResult,
  type BaseAgentConfig,
  type BaseAgentState,
  type CommonPlatformConfig,
  createBaseState,
  type GenericPlatformConfig,
  type GitHubPlatformConfig,
  getTypedAgent,
  isAgent,
  type PlatformConfig,
  type TelegramPlatformConfig,
} from './base-agent.js';
// Chat Agent - primary entry point
export {
  type ChatAgentClass,
  type ChatAgentConfig,
  type ChatAgentEnv,
  type ChatAgentMethods,
  type ChatAgentState,
  createChatAgent,
} from './chat-agent.js';
// Duyet Info agent
export {
  createDuyetInfoAgent,
  type DuyetInfoAgentClass,
  type DuyetInfoAgentConfig,
  type DuyetInfoAgentEnv,
  type DuyetInfoAgentInstance,
  type DuyetInfoAgentMethods,
  type DuyetInfoAgentState,
  duyetToolFilter,
} from './duyet-info-agent.js';
// HITL agent (Human-in-the-Loop)
export {
  createHITLAgent,
  type HITLAgentClass,
  type HITLAgentConfig,
  type HITLAgentEnv,
  type HITLAgentInstance,
  type HITLAgentMethods,
  type HITLAgentState,
} from './hitl-agent.js';
// Orchestrator agent
export {
  createOrchestratorAgent,
  type OrchestratorAgentClass,
  type OrchestratorAgentInstance,
  type OrchestratorConfig,
  type OrchestratorEnv,
  type OrchestratorMethods,
  type OrchestratorState,
} from './orchestrator-agent.js';
// Agent Registry - exports first for use by other modules
export {
  type AgentDefinition,
  type AgentRegistry,
  agentRegistry,
} from './registry.js';
// Multi-agent research system
export {
  // Templates
  buildDelegationPrompt,
  buildSubagentPrompt,
  // Types
  type Citation,
  // Subagents
  createCodeSubagent,
  createGeneralSubagent,
  createGitHubSubagent,
  // Lead Researcher Agent
  createLeadResearcherAgent,
  createResearchSubagent,
  createSubagent,
  type DelegationContext,
  formatDependencyContext,
  getDefaultBoundaries,
  getDefaultToolGuidance,
  getSubagentSystemPrompt,
  type LeadResearcherAgentClass,
  type LeadResearcherAgentInstance,
  type LeadResearcherConfig,
  type LeadResearcherEnv,
  type LeadResearcherMethods,
  type LeadResearcherState,
  type OutputFormat,
  type ResearchPlan,
  type ResearchResult,
  type SubagentClass,
  type SubagentConfig,
  type SubagentEnv,
  type SubagentMethods,
  type SubagentResult,
  type SubagentState,
  type SubagentTask,
  type SubagentType,
} from './research/index.js';
// Router agent
export {
  createRouterAgent,
  type RouterAgentClass,
  type RouterAgentConfig,
  type RouterAgentEnv,
  type RouterAgentInstance,
  type RouterAgentMethods,
  type RouterAgentState,
} from './router-agent.js';
// Simple agent
export {
  createSimpleAgent,
  type SimpleAgentConfig,
  type SimpleAgentEnv,
  type SimpleAgentState,
} from './simple-agent.js';
