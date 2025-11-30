/**
 * Platform Prompts
 *
 * Platform-specific prompt getters for different deployment targets.
 */

export {
  getTelegramPrompt,
  getTelegramWelcomeMessage,
  getTelegramHelpMessage,
} from './telegram.js';

export { getGitHubBotPrompt } from './github.js';
