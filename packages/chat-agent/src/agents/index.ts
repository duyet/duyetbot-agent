/**
 * Agents Module
 *
 * Agent implementations for the routing/orchestration system.
 *
 * IMPORTANT: Agent modules must be imported BEFORE using routing functions
 * because agents self-register at module load time. The imports below
 * trigger registration in the agentRegistry.
 */

// Agent Registry - exports first for use by other modules
export {
  agentRegistry,
  type AgentDefinition,
  type AgentRegistry,
} from './registry.js';

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
  getTypedAgent,
  type GitHubPlatformConfig,
  isAgent,
  type PlatformConfig,
  type TelegramPlatformConfig,
} from './base-agent.js';
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
  type OrchestratorAgentConfig,
  type OrchestratorAgentEnv,
  type OrchestratorAgentInstance,
  type OrchestratorAgentMethods,
  type OrchestratorAgentState,
} from './orchestrator-agent.js';
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
  type SimpleAgentClass,
  type SimpleAgentConfig,
  type SimpleAgentEnv,
  type SimpleAgentInstance,
  type SimpleAgentMethods,
  type SimpleAgentState,
} from './simple-agent.js';
// Duyet Info agent
export {
  createDuyetInfoAgent,
  duyetToolFilter,
  type DuyetInfoAgentClass,
  type DuyetInfoAgentConfig,
  type DuyetInfoAgentEnv,
  type DuyetInfoAgentInstance,
  type DuyetInfoAgentMethods,
  type DuyetInfoAgentState,
} from './duyet-info-agent.js';
// Multi-agent research system
export {
  // Lead Researcher Agent
  createLeadResearcherAgent,
  type LeadResearcherAgentClass,
  type LeadResearcherAgentInstance,
  type LeadResearcherConfig,
  type LeadResearcherEnv,
  type LeadResearcherMethods,
  // Subagents
  createCodeSubagent,
  createGeneralSubagent,
  createGitHubSubagent,
  createResearchSubagent,
  createSubagent,
  type SubagentClass,
  type SubagentConfig,
  type SubagentEnv,
  type SubagentMethods,
  type SubagentState,
  // Types
  type Citation,
  type DelegationContext,
  type LeadResearcherState,
  type OutputFormat,
  type ResearchPlan,
  type ResearchResult,
  type SubagentResult,
  type SubagentTask,
  type SubagentType,
  // Templates
  buildDelegationPrompt,
  buildSubagentPrompt,
  formatDependencyContext,
  getDefaultBoundaries,
  getDefaultToolGuidance,
  getSubagentSystemPrompt,
} from './research/index.js';
