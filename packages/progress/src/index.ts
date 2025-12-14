/**
 * @duyetbot/progress - Provider-agnostic progress tracking and debug footer rendering
 *
 * Core exports for progress tracking utilities and components.
 */

// Message utilities
export {
  createRotator,
  EXTENDED_MESSAGES,
  getRandomMessage,
  THINKING_MESSAGES,
  type ThinkingRotator,
  type ThinkingRotatorConfig,
} from './messages/thinking-messages.js';
export {
  escapeHtml,
  escapeMarkdownV2,
  escapePlain,
  getEscaper,
  smartEscapeMarkdownV2,
} from './renderer/escape.js';
// Renderer utilities
export {
  FooterRenderer,
  type FooterRendererConfig,
} from './renderer/footer-renderer.js';
export {
  ProgressRenderer,
  type ProgressRendererConfig,
} from './renderer/progress-renderer.js';
// Tracker utilities
export * from './tracker/index.js';
// Type definitions
export * from './types.js';
// Format utilities
export {
  formatCompactNumber,
  formatCost,
  formatDuration,
  formatToolArgs,
  formatToolArgsVerbose,
  formatToolResult,
  truncate,
} from './utils/format.js';
// Model utilities
export { shortenModelName } from './utils/model.js';
