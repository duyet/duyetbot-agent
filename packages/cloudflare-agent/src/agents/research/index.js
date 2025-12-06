/**
 * Multi-Agent Research System
 *
 * Exports for the lead researcher and subagent system.
 */
// Delegation Templates
export {
  buildDelegationPrompt,
  buildSubagentPrompt,
  formatDependencyContext,
  getDefaultBoundaries,
  getDefaultToolGuidance,
  getSubagentSystemPrompt,
} from './delegation-templates.js';
// Lead Researcher Agent
export { createLeadResearcherAgent } from './lead-researcher-agent.js';
// Subagents
export {
  createCodeSubagent,
  createGeneralSubagent,
  createGitHubSubagent,
  createResearchSubagent,
  createSubagent,
} from './research-subagent.js';
export {
  CitationSchema,
  OutputFormat as OutputFormatSchema,
  ResearchPlanSchema,
  SubagentTaskSchema,
  SubagentType as SubagentTypeSchema,
} from './types.js';
