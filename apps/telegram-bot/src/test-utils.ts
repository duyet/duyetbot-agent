/**
 * Test utilities for Telegram Bot
 *
 * Provides factory functions for creating bot instances in test environments.
 */

/**
 * Configuration for creating a Telegram bot instance
 */
export interface TelegramBotConfig {
  env: Record<string, unknown>;
  bindings: Record<string, unknown>;
}

/**
 * Create a Telegram bot instance for testing
 */
export async function createTelegramBot(_config: TelegramBotConfig): Promise<TelegramBot> {
  // Create a mock bot instance with test configuration
  const bot: TelegramBot = {
    sendMessage: async (chatId: number, text: string, options?: any) => {
      // Mock implementation for testing
      console.log(`[MOCK] Sending to ${chatId}:`, text, options);

      return {
        message_id: Math.floor(Math.random() * 1000000),
        date: Math.floor(Date.now() / 1000),
        text,
        chat: {
          id: chatId,
          type: 'private' as const,
        },
      };
    },
    handleUpdate: async (update: any) => {
      // Mock implementation for testing - this would normally trigger the agent processing
      console.log(`[MOCK] Handling update:`, update);

      return {
        success: true,
        message: 'Update processed',
      };
    },
  };

  return bot;
}

/**
 * Type for Telegram bot interface
 */
export interface TelegramBot {
  sendMessage: (chatId: number, text: string, options?: any) => Promise<any>;
  handleUpdate: (update: any) => Promise<any>;
}
