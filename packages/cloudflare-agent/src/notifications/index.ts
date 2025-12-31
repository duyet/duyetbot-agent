/**
 * Notifications module
 *
 * Utilities for sending admin alerts and system notifications.
 */

export {
  AdminNotifier,
  type AdminNotifierConfig,
  type BatchFailureDetails,
  DEFAULT_ADMIN_NOTIFIER_CONFIG,
  formatBatchFailureMessage,
  formatStuckBatchMessage,
  type StuckBatchDetails,
} from './admin-notifier.js';
