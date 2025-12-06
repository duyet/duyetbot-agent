/**
 * Debug Footer Formatter
 *
 * Shared implementation for formatting debug context as a collapsible footer
 * for admin users. Used by both direct responses and fire-and-forget paths.
 *
 * Format:
 * - Simple: 🔍 router-agent (0.4s) → [simple/general/low] → simple-agent (3.77s)
 * - Orchestrator:
 *   🔍 router-agent (0.4s) → [complex/research/low] → orchestrator-agent (5.2s)
 *      ├─ research-worker (2.5s)
 *      └─ code-worker (1.2s)
 * - Progressive: Shows (running) for active agents/workers
 */
import type { DebugContext } from './types.js';
/**
 * Escape HTML entities in text for safe inclusion in HTML messages
 */
export declare function escapeHtml(text: string): string;
/**
 * Escape special characters for Telegram MarkdownV2 format (simple version)
 *
 * MarkdownV2 requires escaping: _ * [ ] ( ) ~ ` > # + - = | { } . !
 * This is a simple escape that escapes ALL special characters.
 * Use smartEscapeMarkdownV2() to preserve formatting syntax.
 *
 * @see https://core.telegram.org/bots/api#markdownv2-style
 */
export declare function escapeMarkdownV2(text: string): string;
/**
 * Smart escape for Telegram MarkdownV2 that preserves formatting syntax
 *
 * Handles these MarkdownV2 constructs:
 * - *bold*, _italic_, __underline__, ~strikethrough~, ||spoiler||
 * - [text](url) links - escapes text, preserves URL (only escape ) and \)
 * - *[text](url)* bold-wrapped links - preserves outer markers
 * - _[text](url)_ italic-wrapped links - preserves outer markers
 * - `inline code` and ```code blocks```
 * - >blockquotes (at line start)
 *
 * Per Telegram docs: "Any character with code between 1 and 126 can be escaped
 * anywhere with a preceding '\' character"
 *
 * @see https://core.telegram.org/bots/api#markdownv2-style
 */
export declare function smartEscapeMarkdownV2(text: string): string;
/**
 * Format debug context as expandable blockquote footer
 *
 * @example Output (simple agent):
 * ```
 * 🔍 router-agent (0.4s) → [simple/general/low] → simple-agent (3.77s)
 * ```
 *
 * @example Output (orchestrator with workers):
 * ```
 * 🔍 router-agent (0.4s) → [complex/research/low] → orchestrator-agent (5.2s)
 *    ├─ research-worker (2.5s)
 *    └─ code-worker (1.2s)
 * ```
 */
export declare function formatDebugFooter(debugContext?: DebugContext): string | null;
/**
 * Format debug context as expandable quote for MarkdownV2
 *
 * Uses MarkdownV2 expandable blockquote syntax: **>content||
 * All special characters in content are escaped.
 *
 * @example Output (simple agent):
 * ```
 * **>🔍 router\-agent \(0\.4s\) → \[simple/general/low\] → simple\-agent \(3\.77s\)||
 * ```
 */
export declare function formatDebugFooterMarkdownV2(debugContext?: DebugContext): string | null;
/**
 * Format progressive debug footer for loading states (no blockquote wrapper)
 *
 * Used during loading to show debug info below the rotating loading message.
 * This version doesn't include the blockquote wrapper since it's meant for
 * transient display during execution.
 *
 * @example Output:
 * ```
 * 🔍 router-agent (0.4s) → [complex/research/low] → orchestrator-agent (running)
 *    ├─ research-worker (running)
 * ```
 */
export declare function formatProgressiveDebugFooter(debugContext?: DebugContext): string | null;
/**
 * Format debug footer for GitHub-flavored Markdown
 *
 * Uses <details> for collapsible section and code block for tree structure.
 * Shows full agent flow with timing, nested workers, and error metadata.
 *
 * @example Output (simple agent):
 * ```markdown
 * <details>
 * <summary>🔍 Debug Info</summary>
 *
 * ```
 * router-agent (0.4s) → [simple/general/low] → simple-agent (3.77s)
 * ```
 *
 * </details>
 * ```
 *
 * @example Output (orchestrator with workers):
 * ```markdown
 * <details>
 * <summary>🔍 Debug Info</summary>
 *
 * ```
 * router-agent (0.4s) → [complex/research/low] → orchestrator-agent (5.2s)
 *    ├─ research-worker (2.5s)
 *    └─ code-worker (1.2s)
 * ⚠️ Tool timeout: external_api
 * ```
 *
 * </details>
 * ```
 */
export declare function formatDebugFooterMarkdown(debugContext?: DebugContext): string | null;
//# sourceMappingURL=debug-footer.d.ts.map
