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
 */
import type { PlatformConfig } from './agents/base-agent.js';
import type { DebugContext } from './types.js';
/**
 * Target information for response delivery
 */
export interface ResponseTarget {
  /** Chat/conversation identifier */
  chatId: string;
  /** Reference to the message to edit */
  messageRef: {
    messageId: number;
  };
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
export declare function sendPlatformResponse(
  env: PlatformEnv,
  target: ResponseTarget,
  text: string,
  debugContext?: DebugContext
): Promise<void>;
//# sourceMappingURL=platform-response.d.ts.map
