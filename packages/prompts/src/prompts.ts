/**
 * System prompts with static imports for Workers compatibility
 */

// Static imports - bundled at build time
import defaultPrompt from '../prompts/default.md';
import githubPrompt from '../prompts/github.md';
import telegramPrompt from '../prompts/telegram.md';
import { config } from './config.js';

const prompts: Record<string, string> = {
  default: defaultPrompt,
  github: githubPrompt,
  telegram: telegramPrompt,
};

export type Platform = 'telegram' | 'github';

export interface PromptContext {
  botName?: string;
  creator?: string;
}

/**
 * Get the system prompt for a platform
 * Falls back to default.md if platform-specific prompt not found
 */
export function getSystemPrompt(platform: Platform, context?: PromptContext): string {
  const content = prompts[platform] ?? defaultPrompt;

  // Template binding
  const botName = context?.botName || config.botName;
  const creator = context?.creator || config.creator;

  return content
    .replace(/\{\{botName\}\}/g, botName)
    .replace(/\{\{creator\}\}/g, creator)
    .trim();
}

// Pre-compiled for backwards compatibility
export const GITHUB_SYSTEM_PROMPT = getSystemPrompt('github');
export const TELEGRAM_SYSTEM_PROMPT = getSystemPrompt('telegram');

export const TELEGRAM_WELCOME_MESSAGE = `Hello! I'm ${config.botName}, created by ${config.creator}. Send me a message and I'll help you out.

Commands:
/help - Show help
/clear - Clear conversation history`;

export const TELEGRAM_HELP_MESSAGE = `Commands:
/start - Start bot
/help - Show this help
/clear - Clear conversation history

Just send me any message!`;
