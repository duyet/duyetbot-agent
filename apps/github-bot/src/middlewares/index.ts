/**
 * GitHub bot middlewares
 *
 * This module provides middleware components for GitHub webhook processing:
 *
 * - Signature middleware: Verifies HMAC-SHA256 webhook signatures
 * - Parser middleware: Parses webhook payloads and extracts context
 * - Mention middleware: Detects @bot mentions and extracts task text
 *
 * @example
 * ```typescript
 * import {
 *   createGitHubSignatureMiddleware,
 *   createGitHubParserMiddleware,
 *   createGitHubMentionMiddleware,
 *   type MentionVariables,
 * } from './middlewares/index.js';
 *
 * app.post('/webhook',
 *   createGitHubSignatureMiddleware(),
 *   createGitHubParserMiddleware(),
 *   createGitHubMentionMiddleware(),
 *   async (c) => {
 *     if (c.get('skipProcessing')) {
 *       return c.json({ ok: true });
 *     }
 *     const ctx = c.get('webhookContext')!;
 *     const task = c.get('task')!;
 *     // ... handle message
 *   }
 * );
 * ```
 */

// Mention middleware
export {
  createGitHubMentionMiddleware,
  extractTask,
  hasBotMention,
} from './mention.js';
// Parser middleware
export { createGitHubParserMiddleware } from './parser.js';
// Signature middleware
export {
  createGitHubSignatureMiddleware,
  verifySignature,
} from './signature.js';
// Types
export * from './types.js';
