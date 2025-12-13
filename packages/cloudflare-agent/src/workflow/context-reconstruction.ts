import type { ActiveWorkflowExecution } from './types.js';

export interface TransportContextDeps {
  env: Record<string, unknown>;
}

/**
 * Reconstruct transport context from workflow metadata
 *
 * Creates a minimal context object that the transport can use
 * to edit messages. Platform tokens come from env, not workflow params.
 *
 * IMPORTANT: The returned object MUST match the platform's context interface:
 * - Telegram: TelegramContext with {token, chatId, ...}
 * - GitHub: GitHubContext with {token, chatId, ...}
 */
export function reconstructTransportContext<TContext>(
  workflow: ActiveWorkflowExecution,
  env: Record<string, unknown>
): TContext | null {
  const telegramBotToken = env.TELEGRAM_BOT_TOKEN as string | undefined;
  const telegramParseMode = (env.TELEGRAM_PARSE_MODE as 'HTML' | 'MarkdownV2') || 'HTML';
  const githubToken = env.GITHUB_TOKEN as string | undefined;

  if (workflow.platform === 'telegram') {
    // Reconstruct TelegramContext for transport.edit()
    // Must match apps/telegram-bot/src/transport.ts TelegramContext interface
    return {
      token: telegramBotToken,
      chatId: Number(workflow.chatId),
      userId: 0, // Not needed for edit
      text: '', // Not needed for edit
      startTime: Date.now(),
      isAdmin: false, // Debug footer handled separately
      parseMode: telegramParseMode, // Default to HTML for expandable blockquote support
      messageId: 0, // Not needed for edit
    } as unknown as TContext;
  }

  if (workflow.platform === 'github') {
    // GitHub context for transport.edit()
    return {
      token: githubToken,
      chatId: workflow.chatId,
    } as unknown as TContext;
  }

  return null;
}
