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
export {
  createLeadResearcherAgent,
  type LeadResearcherAgentClass,
  type LeadResearcherAgentInstance,
  type LeadResearcherConfig,
  type LeadResearcherEnv,
  type LeadResearcherMethods,
} from './lead-researcher-agent.js';
// Subagents
export {
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
} from './research-subagent.js';
// Types
export type {
  Citation,
  DelegationContext,
  LeadResearcherState,
  OutputFormat,
  ResearchPlan,
  ResearchResult,
  SubagentResult,
  SubagentTask,
  SubagentType,
} from './types.js';
export {
  CitationSchema,
  OutputFormat as OutputFormatSchema,
  ResearchPlanSchema,
  SubagentTaskSchema,
  SubagentType as SubagentTypeSchema,
} from './types.js';
