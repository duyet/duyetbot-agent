/**
 * Scheduler Types
 *
 * Types for the agentic scheduling system with energy budget.
 * This enables @duyetbot to decide WHEN to work based on priority and available resources.
 */

/**
 * Task types that the scheduler can handle
 */
export type TaskType =
  | 'notification' // Low-cost alerts to user
  | 'research' // Web research, HN scanning
  | 'maintenance' // Self-maintenance tasks
  | 'proactive' // Proactive actions (PR reviews, etc.)
  | 'critical'; // High-priority tasks that bypass energy checks

/**
 * Source of a scheduled task
 */
export type TaskSource =
  | 'cron' // Scheduled via cron
  | 'event' // Triggered by external event (webhook)
  | 'self' // Self-scheduled by the bot
  | 'user'; // Explicitly requested by user

/**
 * A task in the scheduler queue
 */
export interface ScheduledTask {
  id: string;
  type: TaskType;
  priority: number; // 1-100, higher = more urgent
  scheduledFor: number; // Unix timestamp when task should run
  createdAt: number; // When task was created
  energyCost: EnergyCost; // Estimated resource consumption
  payload: unknown; // Task-specific data
  source: TaskSource;
  metadata?: {
    description?: string;
    retryCount?: number;
    maxRetries?: number;
    lastError?: string;
  };
}

/**
 * Energy cost breakdown for a task
 */
export interface EnergyCost {
  tokens: number; // Estimated LLM tokens
  computeMs: number; // Estimated compute time in ms
}

/**
 * Default energy costs by task type
 */
export const DEFAULT_ENERGY_COSTS: Record<TaskType, EnergyCost> = {
  notification: { tokens: 500, computeMs: 1000 },
  research: { tokens: 10000, computeMs: 30000 },
  maintenance: { tokens: 5000, computeMs: 15000 },
  proactive: { tokens: 15000, computeMs: 45000 },
  critical: { tokens: 2000, computeMs: 5000 },
} as const;

/**
 * Priority weights for different task types
 * Higher weight = task is more valuable relative to its cost
 */
export const DEFAULT_PRIORITY_WEIGHTS: Record<TaskType, number> = {
  notification: 0.5, // Cheap, low priority
  research: 1.5, // Valuable for @duyet's interests
  maintenance: 1.0, // Standard
  proactive: 1.2, // Important but not critical
  critical: 3.0, // Always prioritized
} as const;

/**
 * Hybrid energy budget combining tokens, compute, and priority
 */
export interface EnergyBudget {
  // Token-based (cost control)
  tokens: {
    current: number; // Remaining tokens this period
    maxPerHour: number; // e.g., 100,000 tokens/hour
    usedThisHour: number;
  };

  // Time-based (compute fairness)
  compute: {
    currentMs: number; // Remaining compute time
    maxMsPerHour: number; // e.g., 300,000ms (5 min) per hour
    usedThisHour: number;
  };

  // User-defined priority weights (can override defaults)
  priorityWeights: Record<TaskType, number>;

  // Regeneration tracking
  lastRegenAt: number;
  hourStartedAt: number;
}

/**
 * Activity patterns learned over time
 */
export interface ActivityPatterns {
  // Hours when user is typically active (0-23)
  peakHours: number[];
  // Hours good for background work (0-23)
  quietHours: number[];
  // Average response time expectations
  avgResponseTimeMs: number;
  // Day of week patterns (0=Sunday, 6=Saturday)
  activeDays: number[];
}

/**
 * Complete scheduler state persisted in DO
 */
export interface SchedulerState {
  // The priority queue
  taskQueue: ScheduledTask[];

  // Energy budget
  energy: EnergyBudget;

  // Activity patterns
  activityPatterns: ActivityPatterns;

  // Execution history for learning
  executionHistory: Array<{
    taskId: string;
    taskType: TaskType;
    executedAt: number;
    success: boolean;
    actualTokens?: number;
    actualComputeMs?: number;
  }>;

  // Timestamps
  createdAt: number;
  updatedAt: number;
}

/**
 * Result of task execution
 */
export interface TaskExecutionResult {
  taskId: string;
  success: boolean;
  actualTokens?: number;
  actualComputeMs?: number;
  error?: string;
  output?: unknown;
}

/**
 * Configuration for the scheduler
 */
export interface SchedulerConfig {
  // Energy limits
  maxTokensPerHour: number;
  maxComputeMsPerHour: number;

  // Thresholds
  minEnergyThreshold: number; // Don't execute if energy below this %
  criticalPriorityThreshold: number; // Tasks >= this always execute

  // Regeneration
  tokenRegenPerHour: number;
  computeRegenPerHour: number;

  // Queue limits
  maxQueueSize: number;
  maxTaskAge: number; // ms - tasks older than this are dropped
}

/**
 * Default scheduler configuration
 */
export const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  maxTokensPerHour: 100000,
  maxComputeMsPerHour: 300000, // 5 minutes
  minEnergyThreshold: 20, // 20%
  criticalPriorityThreshold: 90,
  tokenRegenPerHour: 100000,
  computeRegenPerHour: 300000,
  maxQueueSize: 100,
  maxTaskAge: 24 * 60 * 60 * 1000, // 24 hours
} as const;

/**
 * Default activity patterns (can be learned over time)
 */
export const DEFAULT_ACTIVITY_PATTERNS: ActivityPatterns = {
  peakHours: [9, 10, 11, 14, 15, 16, 17], // Typical work hours
  quietHours: [0, 1, 2, 3, 4, 5, 6, 22, 23], // Night hours
  avgResponseTimeMs: 5000,
  activeDays: [1, 2, 3, 4, 5], // Monday-Friday
} as const;

/**
 * Create initial energy budget
 */
export function createInitialEnergyBudget(
  config: SchedulerConfig = DEFAULT_SCHEDULER_CONFIG
): EnergyBudget {
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
export function createInitialSchedulerState(): SchedulerState {
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
