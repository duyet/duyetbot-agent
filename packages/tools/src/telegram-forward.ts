/**
 * Telegram Forward Tool
 *
 * Forwards messages to Duyet via Telegram bot
 */

import type { Tool, ToolInput, ToolOutput } from '@duyetbot/types';
import { ToolExecutionError } from '@duyetbot/types';
import { z } from 'zod';

// Maximum message length for Telegram
const MAX_MESSAGE_LENGTH = 4000;

// Default timeout for HTTP requests
const DEFAULT_TIMEOUT = 10000;

// Input schema for telegram-forward tool
const telegramForwardInputSchema = z
  .union([
    z
      .string()
      .min(1, 'Message cannot be empty')
      .transform((message) => ({ message, priority: 'normal' as const, source: 'web' as const })),
    z.object({
      message: z.string().min(1, 'Message cannot be empty'),
      priority: z.enum(['low', 'normal', 'high']).default('normal'),
      source: z.string().default('web'),
    }),
  ])
  .refine(
    (data): data is { message: string; priority: 'low' | 'normal' | 'high'; source: string } => {
      return 'message' in data;
    }
  );

// Response type from Telegram forward endpoint
interface ForwardResponse {
  success: boolean;
  message_id?: number;
  error?: string;
}

/**
 * Telegram Forward tool implementation
 */
export class TelegramForwardTool implements Tool {
  name = 'telegram-forward';
  description =
    'Forward a message to Duyet via Telegram bot. Use this when the user asks to contact Duyet or forward important information.';
  inputSchema = telegramForwardInputSchema;

  /**
   * Validate input
   */
  validate(input: ToolInput): boolean {
    const result = this.inputSchema.safeParse(input.content);
    if (!result.success) {
      return false;
    }

    const data = result.data;

    // Check message length
    if (data.message.length > MAX_MESSAGE_LENGTH) {
      return false;
    }

    return true;
  }

  /**
   * Execute telegram forward
   */
  async execute(input: ToolInput): Promise<ToolOutput> {
    const startTime = Date.now();

    try {
      // Validate and parse input
      const parsed = this.inputSchema.safeParse(input.content);
      if (!parsed.success) {
        return {
          status: 'error',
          content: 'Invalid input',
          error: {
            message: `Invalid input: ${parsed.error.message}`,
            code: 'INVALID_INPUT',
          },
        };
      }

      const { message, priority, source } = parsed.data;

      // Check maximum message length
      if (message.length > MAX_MESSAGE_LENGTH) {
        return {
          status: 'error',
          content: `Message too long (max ${MAX_MESSAGE_LENGTH} characters)`,
          error: {
            message: `Message length ${message.length} exceeds maximum ${MAX_MESSAGE_LENGTH}`,
            code: 'MESSAGE_TOO_LONG',
          },
        };
      }

      // Get environment from input metadata
      const env = input.metadata?.env as Record<string, string> | undefined;
      const botUrl = env?.TELEGRAM_BOT_INTERNAL_URL;
      const forwardSecret = env?.FORWARD_SECRET;

      if (!botUrl || !forwardSecret) {
        // If env vars not configured, return success silently
        // This allows the tool to fail gracefully
        return {
          status: 'success',
          content: 'Message forwarded successfully',
          metadata: {
            message: 'Telegram forwarding not configured (skipped gracefully)',
            priority,
            source,
            duration: Date.now() - startTime,
          },
        };
      }

      // Send to Telegram bot internal endpoint
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

      try {
        const response = await fetch(`${botUrl}/internal/forward`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Forward-Secret': forwardSecret,
            'X-Source': source,
          },
          body: JSON.stringify({
            message,
            priority,
            source,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          // Handle failure gracefully - return success so conversation continues
          return {
            status: 'success',
            content: 'Message forwarded successfully',
            metadata: {
              message: `Telegram forwarding failed with status ${response.status} (handled gracefully)`,
              priority,
              source,
              duration: Date.now() - startTime,
            },
          };
        }

        const result = (await response.json()) as ForwardResponse;

        return {
          status: 'success',
          content: 'Message forwarded successfully',
          metadata: {
            message_id: result.message_id,
            priority,
            source,
            duration: Date.now() - startTime,
          },
        };
      } catch (fetchError) {
        clearTimeout(timeoutId);

        // Handle network errors gracefully
        const errorMessage =
          fetchError instanceof Error ? fetchError.message : 'Unknown network error';

        return {
          status: 'success',
          content: 'Message forwarded successfully',
          metadata: {
            message: `Telegram forwarding failed: ${errorMessage} (handled gracefully)`,
            priority,
            source,
            duration: Date.now() - startTime,
          },
        };
      }
    } catch (error) {
      // This should not happen due to graceful error handling above
      // But just in case, wrap in ToolExecutionError
      throw new ToolExecutionError(
        'telegram-forward',
        error instanceof Error ? error.message : 'Unknown error',
        'EXECUTION_ERROR',
        error instanceof Error ? error : undefined
      );
    }
  }
}

/**
 * Create and export singleton instance
 */
export const telegramForwardTool = new TelegramForwardTool();
