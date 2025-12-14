/**
 * Platform Response Helper
 *
 * Sends responses directly to platforms (Telegram, GitHub) bypassing the transport layer.
 * Used by RouterAgent alarm handler to deliver responses after fire-and-forget delegation.
 *
 * Phase 5: Full Debug Footer Support
 * ===================================
 * Debug footer IS NOW SUPPORTED in fire-and-forget flow:
 *
 * 1. ResponseTarget includes adminUsername + username
 * 2. sendPlatformResponse() accepts optional debugContext parameter
 * 3. Admin users see expandable debug footer with routing flow, tools, and timing
 *
 * The footer shows:
 * - Agent chain: router → simple-agent → (sub-agents if any)
 * - Tools used: (search, calculator) per agent
 * - Duration: 2.34s total processing time
 * - Classification: type/category/complexity
 *
 * Phase 6: Real-Time Progress Display
 * ====================================
 * Added progressive message editing during execution:
 *
 * 1. ProgressAccumulator tracks execution steps (thinking, tool calls, results)
 * 2. editProgressMessage() updates Telegram message with chain display
 * 3. formatWorkflowProgress() from workflow module formats the chain
 * 4. Debouncing prevents rate limiting from frequent edits
 */

import { logger } from '@duyetbot/hono-middleware';
import type { PlatformConfig } from './agents/base-agent.js';
import { formatDebugFooter, formatDebugFooterMarkdownV2 } from './debug-footer.js';
import type { DebugContext, ExecutionStep, ProgressCallback } from './types.js';
import { formatWorkflowProgress } from './workflow/formatting.js';
import type { WorkflowProgressEntry } from './workflow/types.js';

/**
 * Target information for response delivery
 */
export interface ResponseTarget {
  /** Chat/conversation identifier */
  chatId: string;
  /** Reference to the message to edit */
  messageRef: { messageId: number };
  /** Platform to send response to */
  platform: 'telegram' | 'github' | string;
  /** Bot token for authentication (optional, falls back to env) */
  botToken?: string;
  /** Admin username for debug footer (Phase 5) */
  adminUsername?: string;
  /** Current user's username for admin check (Phase 5) */
  username?: string;
  /**
   * Platform-specific configuration from parent worker.
   * Used to get parseMode and other platform settings.
   */
  platformConfig?: PlatformConfig;

  // GitHub-specific fields (required when platform === 'github')
  /** GitHub repository owner (for GitHub platform) */
  githubOwner?: string;
  /** GitHub repository name (for GitHub platform) */
  githubRepo?: string;
  /** GitHub issue/PR number (for GitHub platform) */
  githubIssueNumber?: number;
  /** GitHub token for API authentication (for GitHub platform) */
  githubToken?: string;
}

/**
 * Environment with platform tokens
 */
export interface PlatformEnv {
  TELEGRAM_BOT_TOKEN?: string;
  GITHUB_TOKEN?: string;
}

/**
 * Normalize username by removing leading @ if present
 */
function normalizeUsername(username: string): string {
  return username.startsWith('@') ? username.slice(1) : username;
}

/**
 * Check if current user is admin
 */
function isAdminUser(target: ResponseTarget): boolean {
  if (!target.adminUsername || !target.username) {
    return false;
  }
  return normalizeUsername(target.username) === normalizeUsername(target.adminUsername);
}

/**
 * Send response directly to platform (bypassing transport layer)
 *
 * Used by RouterAgent alarm handler to deliver responses after fire-and-forget.
 * This allows the RouterAgent to send responses even after the original
 * TelegramAgent/CloudflareAgent has returned.
 *
 * @param env - Environment with platform tokens
 * @param target - Target information (chatId, messageRef, platform, adminUsername, username)
 * @param text - Response text to send
 * @param debugContext - Optional debug context for admin users
 */
export async function sendPlatformResponse(
  env: PlatformEnv,
  target: ResponseTarget,
  text: string,
  debugContext?: DebugContext
): Promise<void> {
  const { platform, chatId, messageRef, botToken } = target;

  // Diagnostic logging for debug footer troubleshooting
  logger.debug('[sendPlatformResponse] Debug footer check', {
    platform,
    isAdmin: isAdminUser(target),
    username: target.username,
    adminUsername: target.adminUsername,
    hasDebugContext: !!debugContext,
    routingFlowLength: debugContext?.routingFlow?.length ?? 0,
    hasClassification: !!debugContext?.classification,
    totalDurationMs: debugContext?.totalDurationMs,
  });

  if (platform === 'telegram') {
    // Determine if admin and should show debug footer
    let finalText = text;

    // Get parseMode from platformConfig if available
    // Default to HTML for better formatting support
    let parseMode: 'HTML' | 'Markdown' | 'MarkdownV2' = 'HTML';
    const platformConfig = target.platformConfig;
    if (platformConfig?.platform === 'telegram') {
      const telegramConfig = platformConfig as {
        parseMode?: 'HTML' | 'MarkdownV2';
      };
      if (telegramConfig.parseMode) {
        parseMode = telegramConfig.parseMode;
      }
    }

    if (isAdminUser(target) && debugContext) {
      // Select formatter based on parseMode to avoid format mismatch
      // MarkdownV2 content + HTML footer = API rejection
      const debugFooter =
        parseMode === 'MarkdownV2'
          ? formatDebugFooterMarkdownV2(debugContext)
          : formatDebugFooter(debugContext);

      if (debugFooter) {
        // IMPORTANT: Text is NOT escaped because the LLM is instructed to produce
        // properly formatted content (HTML or MarkdownV2). Escaping would
        // break the LLM's intentional formatting.
        // See: packages/prompts/src/sections/guidelines.ts for LLM formatting instructions
        finalText = text + debugFooter;
        // DON'T override parseMode - keep original format to match response content

        logger.debug('[sendPlatformResponse] Debug footer applied', {
          username: target.username,
          flowLength: debugContext.routingFlow.length,
          parseMode, // Log actual parseMode used
        });
      }
    }

    await sendTelegramResponse(env, chatId, messageRef.messageId, finalText, botToken, parseMode);
  } else if (platform === 'github') {
    // GitHub response delivery - update comment via GitHub API
    await sendGitHubResponse(env, target, text, debugContext);
  } else {
    logger.warn('[sendPlatformResponse] Unknown platform', { platform });
  }
}

/**
 * Send response via Telegram Bot API
 *
 * @param env - Environment with tokens
 * @param chatId - Chat to send to
 * @param messageId - Message to edit
 * @param text - Message text
 * @param botToken - Optional bot token override
 * @param parseMode - Parse mode ('HTML' or 'Markdown')
 */
async function sendTelegramResponse(
  env: PlatformEnv,
  chatId: string,
  messageId: number,
  text: string,
  botToken?: string,
  parseMode: 'HTML' | 'Markdown' | 'MarkdownV2' = 'HTML'
): Promise<void> {
  const token = botToken || env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('No Telegram bot token available');
  }

  // Truncate text to Telegram's message limit with indicator
  const TELEGRAM_LIMIT = 4096;
  const TRUNCATION_SUFFIX = '\n\n[...truncated]';
  const truncatedText =
    text.length > TELEGRAM_LIMIT
      ? text.slice(0, TELEGRAM_LIMIT - TRUNCATION_SUFFIX.length) + TRUNCATION_SUFFIX
      : text;

  const url = `https://api.telegram.org/bot${token}/editMessageText`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text: truncatedText,
      parse_mode: parseMode,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();

    // Check for "message is not modified" error (not a real error)
    if (response.status === 400 && errorText.includes('message is not modified')) {
      logger.info('[sendTelegramResponse] Message unchanged, skipping');
      return;
    }

    logger.error('[sendTelegramResponse] Telegram API error', {
      status: response.status,
      error: errorText,
      chatId,
      messageId,
    });

    throw new Error(`Telegram API error: ${response.status} - ${errorText}`);
  }

  logger.info('[sendTelegramResponse] Message sent successfully', {
    chatId,
    messageId,
    textLength: truncatedText.length,
  });
}

/**
 * Send response via GitHub API
 *
 * Updates an existing comment on an issue/PR.
 * Similar to Telegram, but uses GitHub's REST API.
 *
 * @param env - Environment with tokens
 * @param target - Response target with GitHub-specific fields
 * @param text - Message text
 * @param debugContext - Optional debug context for admin users
 */
async function sendGitHubResponse(
  env: PlatformEnv,
  target: ResponseTarget,
  text: string,
  debugContext?: DebugContext
): Promise<void> {
  const { githubOwner, githubRepo, githubToken, messageRef } = target;
  const token = githubToken || env.GITHUB_TOKEN;

  // Validate required fields
  if (!token) {
    logger.error('[sendGitHubResponse] No GitHub token available');
    throw new Error('No GitHub token available');
  }

  if (!githubOwner || !githubRepo) {
    logger.error('[sendGitHubResponse] Missing owner/repo', {
      owner: githubOwner,
      repo: githubRepo,
    });
    throw new Error('Missing GitHub owner/repo in responseTarget');
  }

  const commentId = messageRef?.messageId;
  if (!commentId) {
    logger.error('[sendGitHubResponse] No comment ID available');
    throw new Error('No comment ID available for GitHub response');
  }

  // Format response text with debug footer for admin users
  let finalText = text;
  if (isAdminUser(target) && debugContext) {
    // GitHub uses Markdown, format debug footer accordingly
    const debugFooter = formatGitHubDebugFooter(debugContext);
    if (debugFooter) {
      finalText = text + debugFooter;
      logger.debug('[sendGitHubResponse] Debug footer applied', {
        username: target.username,
        flowLength: debugContext.routingFlow.length,
      });
    }
  }

  // GitHub API: Update issue comment
  // https://docs.github.com/en/rest/issues/comments#update-an-issue-comment
  const url = `https://api.github.com/repos/${githubOwner}/${githubRepo}/issues/comments/${commentId}`;

  logger.debug('[sendGitHubResponse] Updating comment', {
    owner: githubOwner,
    repo: githubRepo,
    commentId,
    textLength: finalText.length,
  });

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'duyetbot-agent',
    },
    body: JSON.stringify({
      body: finalText,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('[sendGitHubResponse] GitHub API error', {
      status: response.status,
      error: errorText,
      owner: githubOwner,
      repo: githubRepo,
      commentId,
    });
    throw new Error(`GitHub API error: ${response.status} - ${errorText}`);
  }

  logger.info('[sendGitHubResponse] Comment updated successfully', {
    owner: githubOwner,
    repo: githubRepo,
    commentId,
    textLength: finalText.length,
  });
}

/**
 * Format debug footer for GitHub (Markdown format)
 *
 * Uses <details> for collapsible debug info similar to Telegram's HTML format.
 */
function formatGitHubDebugFooter(debugContext: DebugContext): string {
  const { routingFlow, classification, totalDurationMs } = debugContext;

  // Build agent chain with tools
  const agentChain = routingFlow
    .map((step) => {
      let entry = step.agent;
      if (step.tools && step.tools.length > 0) {
        entry += ` (${step.tools.join(', ')})`;
      }
      return entry;
    })
    .join(' → ');

  // Build classification info
  const classInfo = [
    classification?.type && `type: ${classification.type}`,
    classification?.category && `category: ${classification.category}`,
    classification?.complexity && `complexity: ${classification.complexity}`,
  ]
    .filter(Boolean)
    .join(', ');

  // Format duration
  const duration = totalDurationMs ? `${(totalDurationMs / 1000).toFixed(2)}s` : 'N/A';

  // GitHub-flavored Markdown with collapsible details
  return `

<details>
<summary>[debug] Info</summary>

| Property | Value |
|----------|-------|
| **Flow** | ${agentChain} |
| **Classification** | ${classInfo || 'N/A'} |
| **Duration** | ${duration} |

</details>`;
}

/**
 * Minimum interval between message edits to avoid rate limiting
 * Telegram rate limits edits to ~20/minute per chat
 */
const MIN_EDIT_INTERVAL_MS = 500;

/**
 * ProgressAccumulator for tracking execution steps
 *
 * Accumulates thinking text, tool calls, and results during agent execution.
 * Used to:
 * 1. Format progressive updates during execution
 * 2. Build ExecutionStep[] for final debug footer
 *
 * @example
 * ```typescript
 * const accumulator = new ProgressAccumulator();
 * const callback = accumulator.createProgressCallback(editFn);
 *
 * await callback.onThinking('Let me search for information...');
 * await callback.onToolStart('search', { query: 'OpenAI skills' });
 * await callback.onToolComplete('search', 'Found 5 results...', 1234);
 *
 * const steps = accumulator.getExecutionSteps();
 * ```
 */
export class ProgressAccumulator {
  private history: WorkflowProgressEntry[] = [];
  private iteration = 1;
  private tokenCount = 0;

  /**
   * Add a thinking entry
   */
  addThinking(text: string): void {
    this.history.push({
      type: 'thinking',
      iteration: this.iteration,
      message: text,
      timestamp: Date.now(),
    });
  }

  /**
   * Add a tool start entry
   */
  addToolStart(toolName: string, args: Record<string, unknown>): void {
    this.history.push({
      type: 'tool_start',
      iteration: this.iteration,
      message: `Running ${toolName}...`,
      toolName,
      toolArgs: args,
      timestamp: Date.now(),
    });
  }

  /**
   * Add a tool complete entry
   */
  addToolComplete(toolName: string, result: string, durationMs: number): void {
    this.history.push({
      type: 'tool_complete',
      iteration: this.iteration,
      message: `${toolName} completed`,
      toolName,
      toolResult: result,
      durationMs,
      timestamp: Date.now(),
    });
  }

  /**
   * Add a tool error entry
   */
  addToolError(toolName: string, error: string, durationMs?: number): void {
    const entry: WorkflowProgressEntry = {
      type: 'tool_error',
      iteration: this.iteration,
      message: `${toolName} failed: ${error}`,
      toolName,
      toolResult: error,
      timestamp: Date.now(),
    };
    // Only add durationMs if defined (exactOptionalPropertyTypes)
    if (durationMs !== undefined) {
      entry.durationMs = durationMs;
    }
    this.history.push(entry);
  }

  /**
   * Increment iteration counter (after LLM response with tools)
   */
  nextIteration(): void {
    this.iteration++;
  }

  /**
   * Set token count for display
   */
  setTokenCount(count: number): void {
    this.tokenCount = count;
  }

  /**
   * Get formatted progress message for display
   */
  getFormattedProgress(): string {
    return formatWorkflowProgress(this.history, this.tokenCount);
  }

  /**
   * Get execution steps for debug footer
   */
  getExecutionSteps(): ExecutionStep[] {
    return this.history.map((entry) => {
      // Build step with required fields only, add optional fields conditionally
      // (exactOptionalPropertyTypes requires this approach)
      const step: ExecutionStep = {
        iteration: entry.iteration,
        type: entry.type as ExecutionStep['type'],
      };

      // Add optional fields only if they have values
      if (entry.toolName) {
        step.toolName = entry.toolName;
      }
      if (entry.toolArgs) {
        step.args = entry.toolArgs;
      }
      if (entry.toolResult) {
        step.result = entry.toolResult;
      }
      if (entry.type === 'thinking' && entry.message) {
        step.thinking = entry.message;
      }
      if (entry.durationMs !== undefined) {
        step.durationMs = entry.durationMs;
      }

      return step;
    });
  }

  /**
   * Get history for workflow display
   */
  getHistory(): WorkflowProgressEntry[] {
    return [...this.history];
  }

  /**
   * Create a ProgressCallback that accumulates steps and optionally edits a message
   *
   * @param editFn - Optional function to edit the message with progress
   * @returns ProgressCallback interface for agent execution
   */
  createProgressCallback(editFn?: (text: string) => Promise<void>): ProgressCallback {
    let lastEditTime = 0;

    const maybeEdit = async (): Promise<void> => {
      if (!editFn) return;

      const now = Date.now();
      if (now - lastEditTime < MIN_EDIT_INTERVAL_MS) {
        return; // Skip edit if too soon (debounce)
      }

      lastEditTime = now;
      const formatted = this.getFormattedProgress();
      try {
        await editFn(formatted);
      } catch (error) {
        // Log but don't throw - progress updates are best-effort
        logger.debug('[ProgressAccumulator] Edit failed (rate limit?)', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };

    return {
      onThinking: async (text: string): Promise<void> => {
        this.addThinking(text);
        await maybeEdit();
      },
      onToolStart: async (toolName: string, args: Record<string, unknown>): Promise<void> => {
        this.addToolStart(toolName, args);
        await maybeEdit();
      },
      onToolComplete: async (
        toolName: string,
        result: string,
        durationMs: number
      ): Promise<void> => {
        this.addToolComplete(toolName, result, durationMs);
        await maybeEdit();
      },
      onToolError: async (toolName: string, error: string, durationMs?: number): Promise<void> => {
        this.addToolError(toolName, error, durationMs);
        await maybeEdit();
      },
    };
  }
}

/**
 * Create a message edit function for Telegram progress updates
 *
 * Returns a function that edits a Telegram message by ID.
 * Used with ProgressAccumulator to show real-time progress.
 *
 * @param env - Environment with Telegram token
 * @param chatId - Chat ID to edit in
 * @param messageId - Message ID to edit
 * @param botToken - Optional bot token override
 * @returns Edit function compatible with ProgressAccumulator
 *
 * @example
 * ```typescript
 * const editFn = createTelegramEditFn(env, chatId, messageId);
 * const accumulator = new ProgressAccumulator();
 * const callback = accumulator.createProgressCallback(editFn);
 * ```
 */
export function createTelegramEditFn(
  env: PlatformEnv,
  chatId: string,
  messageId: number,
  botToken?: string
): (text: string) => Promise<void> {
  const token = botToken || env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    // Return no-op if no token
    return async () => {};
  }

  return async (text: string): Promise<void> => {
    const url = `https://api.telegram.org/bot${token}/editMessageText`;

    // Truncate if needed
    const TELEGRAM_LIMIT = 4096;
    const truncatedText =
      text.length > TELEGRAM_LIMIT ? text.slice(0, TELEGRAM_LIMIT - 20) + '\n\n...' : text;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text: truncatedText,
        parse_mode: 'HTML',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // Only throw if not "message is not modified" (expected during debounce)
      if (!errorText.includes('message is not modified')) {
        throw new Error(`Telegram edit failed: ${response.status}`);
      }
    }
  };
}

/**
 * Create progress callback for fire-and-forget execution
 *
 * Convenience function that creates a ProgressAccumulator with Telegram message editing.
 * Use this in RouterAgent.onExecutionAlarm() to enable real-time progress display.
 *
 * @param env - Environment with platform tokens
 * @param target - Response target with chat/message info
 * @returns Object with callback and accumulator for accessing steps
 *
 * @example
 * ```typescript
 * const { callback, accumulator } = createFireAndForgetProgress(env, target);
 *
 * // Pass callback to agent execution
 * const result = await agent.execute(ctx, { progressCallback: callback });
 *
 * // Get steps for debug footer
 * const steps = accumulator.getExecutionSteps();
 * ```
 */
export function createFireAndForgetProgress(
  env: PlatformEnv,
  target: ResponseTarget
): { callback: ProgressCallback; accumulator: ProgressAccumulator } {
  const accumulator = new ProgressAccumulator();

  // Create edit function based on platform
  let editFn: ((text: string) => Promise<void>) | undefined;

  if (target.platform === 'telegram' && target.messageRef?.messageId) {
    editFn = createTelegramEditFn(env, target.chatId, target.messageRef.messageId, target.botToken);
  }
  // GitHub doesn't support rapid edits well, so we skip progress for now

  const callback = accumulator.createProgressCallback(editFn);

  return { callback, accumulator };
}
