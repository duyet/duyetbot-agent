/**
 * Shared system prompts for duyetbot agents
 */

export { config } from './config.js';

export {
  addTemplate,
  getTemplateNames,
  renderString,
  renderTemplate,
  type TemplateContext,
} from './engine.js';
export {
  GITHUB_SYSTEM_PROMPT,
  getSystemPrompt,
  type Platform,
  type PromptContext,
  TELEGRAM_HELP_MESSAGE,
  TELEGRAM_SYSTEM_PROMPT,
  TELEGRAM_WELCOME_MESSAGE,
} from './prompts.js';
