/**
 * Scheduler Types
 *
 * Types for the agentic scheduling system with energy budget.
 * This enables @duyetbot to decide WHEN to work based on priority and available resources.
 */
/**
 * Default energy costs by task type
 */
export const DEFAULT_ENERGY_COSTS = {
  notification: { tokens: 500, computeMs: 1000 },
  research: { tokens: 10000, computeMs: 30000 },
  maintenance: { tokens: 5000, computeMs: 15000 },
  proactive: { tokens: 15000, computeMs: 45000 },
  critical: { tokens: 2000, computeMs: 5000 },
};
/**
 * Priority weights for different task types
 * Higher weight = task is more valuable relative to its cost
 */
export const DEFAULT_PRIORITY_WEIGHTS = {
  notification: 0.5, // Cheap, low priority
  research: 1.5, // Valuable for @duyet's interests
  maintenance: 1.0, // Standard
  proactive: 1.2, // Important but not critical
  critical: 3.0, // Always prioritized
};
/**
 * Default scheduler configuration
 */
export const DEFAULT_SCHEDULER_CONFIG = {
  maxTokensPerHour: 100000,
  maxComputeMsPerHour: 300000, // 5 minutes
  minEnergyThreshold: 20, // 20%
  criticalPriorityThreshold: 90,
  tokenRegenPerHour: 100000,
  computeRegenPerHour: 300000,
  maxQueueSize: 100,
  maxTaskAge: 24 * 60 * 60 * 1000, // 24 hours
};
/**
 * Default activity patterns (can be learned over time)
 */
export const DEFAULT_ACTIVITY_PATTERNS = {
  peakHours: [9, 10, 11, 14, 15, 16, 17], // Typical work hours
  quietHours: [0, 1, 2, 3, 4, 5, 6, 22, 23], // Night hours
  avgResponseTimeMs: 5000,
  activeDays: [1, 2, 3, 4, 5], // Monday-Friday
};
/**
 * Create initial energy budget
 */
export function createInitialEnergyBudget(config = DEFAULT_SCHEDULER_CONFIG) {
  const now = Date.now();
  return {
    tokens: {
      current: config.maxTokensPerHour,
      maxPerHour: config.maxTokensPerHour,
      usedThisHour: 0,
    },
    compute: {
      currentMs: config.maxComputeMsPerHour,
      maxMsPerHour: config.maxComputeMsPerHour,
      usedThisHour: 0,
    },
    priorityWeights: { ...DEFAULT_PRIORITY_WEIGHTS },
    lastRegenAt: now,
    hourStartedAt: now,
  };
}
/**
 * Create initial scheduler state
 */
export function createInitialSchedulerState() {
  const now = Date.now();
  return {
    taskQueue: [],
    energy: createInitialEnergyBudget(),
    activityPatterns: { ...DEFAULT_ACTIVITY_PATTERNS },
    executionHistory: [],
    createdAt: now,
    updatedAt: now,
  };
}
