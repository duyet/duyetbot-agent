/**
 * Telegram Platform Prompt
 *
 * Mobile-optimized prompt for Telegram bot interactions.
 * Concise responses, emoji support, and mobile-friendly formatting.
 */

import { createPrompt } from '../builder.js';
import { config } from '../config.js';
import { DEFAULT_CAPABILITIES } from '../sections/index.js';
import type { PromptConfig, ToolDefinition } from '../types.js';

/**
 * Telegram-specific tools
 */
const TELEGRAM_TOOLS: ToolDefinition[] = [
  {
    name: 'creator_info',
    description: `Information about ${config.creator} and his projects`,
  },
  { name: 'knowledge', description: 'General knowledge and reasoning' },
];

/**
 * Get the system prompt for Telegram bot
 * @param customConfig - Optional configuration overrides
 */
export function getTelegramPrompt(customConfig?: Partial<PromptConfig>): string {
  return createPrompt(customConfig)
    .withIdentity()
    .withPolicy()
    .withTools(TELEGRAM_TOOLS)
    .withCapabilities(DEFAULT_CAPABILITIES)
    .withCodingStandards()
    .withCustomSection(
      'creator_info',
      `
When users ask about ${config.creator}, use the available tools to get accurate, up-to-date information about his profile, CV, blog posts, and GitHub activity.
`
    )
    .withGuidelines()
    .withHistoryContext()
    .forTelegram()
    .build();
}

/**
 * Telegram welcome message
 */
export function getTelegramWelcomeMessage(): string {
  return `Hello! I'm ${config.botName}, created by ${config.creator}. Send me a message and I'll help you out.

Commands:
/help - Show all available commands
/clear - Clear conversation history`;
}

/**
 * Telegram help message
 */
export function getTelegramHelpMessage(): string {
  return `📚 Available Commands:

🤖 Basic Commands
/start - Start the bot
/help - Show this help message
/clear - Clear conversation history

🔧 Admin Commands (Admin only)
/debug - Show debug information
/status - Show system status

💬 Just send me any message and I'll help you out!`;
}
