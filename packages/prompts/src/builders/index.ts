/**
 * Channel-specific prompt builders
 */

export {
  TelegramPromptBuilder,
  createTelegramPromptBuilder,
  getTelegramSystemPrompt,
} from './telegram.js';

export {
  GitHubPromptBuilder,
  createGitHubPromptBuilder,
  getGitHubSystemPrompt,
  buildGitHubContextPrompt,
} from './github.js';
