/**
 * Agent Prompts
 *
 * Centralized prompt getters for all agent types.
 */

export { getDuyetInfoPrompt } from './duyet-info.js';
export { type GitHubMCPPromptConfig, getGitHubMCPPrompt } from './github-mcp.js';
export { getConfirmationPrompt, getHITLAgentPrompt } from './hitl.js';
export { getMemoryAgentPrompt } from './memory.js';
export {
  getAggregationPrompt,
  getOrchestratorPrompt,
  getPlanningPrompt,
} from './orchestrator.js';
export { getRouterPrompt } from './router.js';
// Core agents
export { getSimpleAgentPrompt } from './simple.js';

// Workers
export {
  GITHUB_TOOLS,
  getCodeWorkerPrompt,
  getGitHubWorkerPrompt,
  getResearchWorkerPrompt,
  RESEARCH_TOOLS,
} from './workers/index.js';
