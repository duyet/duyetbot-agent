/**
 * Configuration Module
 *
 * Configuration types and utilities for the chat-agent package.
 */

export {
  EFFORT_CONFIGS,
  type EffortConfig,
  type EffortEstimate,
  EffortEstimateSchema,
  type EffortLevel,
  EffortLevel as EffortLevelSchema,
  estimateEffortLevel,
  getEffortConfig,
  getEffortConfigFromEstimate,
} from './effort-config.js';
