/**
 * Shared system prompts for duyetbot agents
 */

// Base prompt fragments
export {
  BOT_NAME,
  CORE_CAPABILITIES,
  CODE_GUIDELINES,
  RESPONSE_GUIDELINES,
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
