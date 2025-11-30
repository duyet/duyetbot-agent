/**
 * Agent Prompts
 *
 * Centralized prompt getters for all agent types.
 */

// Core agents
export { getSimpleAgentPrompt } from './simple.js';
export { getRouterPrompt } from './router.js';
export {
  getOrchestratorPrompt,
  getPlanningPrompt,
  getAggregationPrompt,
} from './orchestrator.js';
export { getHITLAgentPrompt, getConfirmationPrompt } from './hitl.js';
export { getDuyetInfoPrompt } from './duyet-info.js';
export { getMemoryAgentPrompt } from './memory.js';

// Workers
export {
  getCodeWorkerPrompt,
  getResearchWorkerPrompt,
  getGitHubWorkerPrompt,
  RESEARCH_TOOLS,
  GITHUB_TOOLS,
} from './workers/index.js';
