/**
 * Shared system prompts for duyetbot agents
 */

// Base prompt fragments
export {
  BOT_NAME,
  BOT_CREATOR,
  CORE_CAPABILITIES,
  CODE_GUIDELINES,
  RESPONSE_GUIDELINES,
  CREATOR_INFO,
} from './base.js';

// Telegram prompts
export {
  TELEGRAM_SYSTEM_PROMPT,
  TELEGRAM_WELCOME_MESSAGE,
  TELEGRAM_HELP_MESSAGE,
} from './telegram.js';

// GitHub prompts
export {
  GITHUB_SYSTEM_PROMPT,
  buildGitHubContextPrompt,
  GITHUB_REVIEW_PROMPT,
  GITHUB_EXPLAIN_PROMPT,
} from './github.js';

// Types
export type {
  SectionPriority,
  ModelType,
  RoleType,
  PromptSection,
  PromptContext,
  GitHubContext,
  CompileOptions,
  CompiledPrompt,
} from './types.js';

// Base builder
export { PromptBuilder, createPromptBuilder } from './builder.js';

// Template loader
export {
  loadTemplate,
  loadTemplates,
  templateExists,
  templateNames,
  defaultContext,
  type TemplateContext,
  type TemplateName,
} from './loader.js';

// Channel-specific builders
export {
  TelegramPromptBuilder,
  createTelegramPromptBuilder,
  getTelegramSystemPrompt,
  GitHubPromptBuilder,
  createGitHubPromptBuilder,
  getGitHubSystemPrompt,
} from './builders/index.js';
