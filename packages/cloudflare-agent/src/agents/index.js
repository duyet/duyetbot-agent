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
export { AgentMixin, createBaseState, getTypedAgent, isAgent } from './base-agent.js';
// Chat Agent - primary entry point
export { createChatAgent } from './chat-agent.js';
// Duyet Info agent
export { createDuyetInfoAgent, duyetToolFilter } from './duyet-info-agent.js';
// HITL agent (Human-in-the-Loop)
export { createHITLAgent } from './hitl-agent.js';
// Orchestrator agent
export { createOrchestratorAgent } from './orchestrator-agent.js';
// Agent Registry - exports first for use by other modules
export { agentRegistry } from './registry.js';
// Multi-agent research system
export {
  // Templates
  buildDelegationPrompt,
  buildSubagentPrompt,
  // Subagents
  createCodeSubagent,
  createGeneralSubagent,
  createGitHubSubagent,
  // Lead Researcher Agent
  createLeadResearcherAgent,
  createResearchSubagent,
  createSubagent,
  formatDependencyContext,
  getDefaultBoundaries,
  getDefaultToolGuidance,
  getSubagentSystemPrompt,
} from './research/index.js';
// Router agent
export { createRouterAgent } from './router-agent.js';
// Simple agent
export { createSimpleAgent } from './simple-agent.js';
