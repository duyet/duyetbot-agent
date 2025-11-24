/**
 * Shared system prompts for duyetbot agents
 */

export {
  getSystemPrompt,
  GITHUB_SYSTEM_PROMPT,
  TELEGRAM_SYSTEM_PROMPT,
  TELEGRAM_WELCOME_MESSAGE,
  TELEGRAM_HELP_MESSAGE,
  type Platform,
  type PromptContext,
} from './prompts.js';

export {
  renderTemplate,
  renderString,
  addFilter,
  addGlobal,
  type TemplateContext,
} from './engine.js';

export { config } from './config.js';
