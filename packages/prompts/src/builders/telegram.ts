/**
 * Telegram-specific PromptBuilder
 */

import { PromptBuilder } from '../builder.js';
import { loadTemplate, templateNames } from '../loader.js';

/**
 * PromptBuilder configured for Telegram bot interactions
 */
export class TelegramPromptBuilder extends PromptBuilder {
  constructor() {
    super();

    // Set default context for Telegram
    this.addContext({ channel: 'telegram' });

    // Add role
    this.addRole('assistant');

    // Add standard sections
    this.addCapabilities();
    this.addCreatorInfo();
    this.addResponseGuidelines();

    // Add Telegram-specific constraints from template
    this.addText(
      'telegram_constraints',
      loadTemplate(templateNames.telegramConstraints),
      'important'
    );

    // Add channel context
    this.addText('channel_context', 'Current conversation is via Telegram chat.', 'optional');
  }

  /**
   * Create a welcome message builder
   */
  static welcomeMessage(): string {
    return `Hello! I'm @duyetbot, created by Duyet Le. Send me a message and I'll help you out.

Commands:
/help - Show help
/clear - Clear conversation history`;
  }

  /**
   * Create a help message
   */
  static helpMessage(): string {
    return `Commands:
/start - Start bot
/help - Show this help
/clear - Clear conversation history

Just send me any message!`;
  }
}

/**
 * Create a pre-configured Telegram prompt builder
 */
export function createTelegramPromptBuilder(): TelegramPromptBuilder {
  return new TelegramPromptBuilder();
}

/**
 * Get the default Telegram system prompt
 */
export function getTelegramSystemPrompt(): string {
  return new TelegramPromptBuilder().compile();
}
