/**
 * Scheduler Types
 *
 * Types for the agentic scheduling system with energy budget.
 * This enables @duyetbot to decide WHEN to work based on priority and available resources.
 */
/**
 * Task types that the scheduler can handle
 */
export type TaskType = 'notification' | 'research' | 'maintenance' | 'proactive' | 'critical';
/**
 * Source of a scheduled task
 */
export type TaskSource = 'cron' | 'event' | 'self' | 'user';
/**
 * A task in the scheduler queue
 */
export interface ScheduledTask {
  id: string;
  type: TaskType;
  priority: number;
  scheduledFor: number;
  createdAt: number;
  energyCost: EnergyCost;
  payload: unknown;
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
  tokens: number;
  computeMs: number;
}
/**
 * Default energy costs by task type
 */
export declare const DEFAULT_ENERGY_COSTS: Record<TaskType, EnergyCost>;
/**
 * Priority weights for different task types
 * Higher weight = task is more valuable relative to its cost
 */
export declare const DEFAULT_PRIORITY_WEIGHTS: Record<TaskType, number>;
/**
 * Hybrid energy budget combining tokens, compute, and priority
 */
export interface EnergyBudget {
  tokens: {
    current: number;
    maxPerHour: number;
    usedThisHour: number;
  };
  compute: {
    currentMs: number;
    maxMsPerHour: number;
    usedThisHour: number;
  };
  priorityWeights: Record<TaskType, number>;
  lastRegenAt: number;
  hourStartedAt: number;
}
/**
 * Activity patterns learned over time
 */
export interface ActivityPatterns {
  peakHours: number[];
  quietHours: number[];
  avgResponseTimeMs: number;
  activeDays: number[];
}
/**
 * Complete scheduler state persisted in DO
 */
export interface SchedulerState {
  taskQueue: ScheduledTask[];
  energy: EnergyBudget;
  activityPatterns: ActivityPatterns;
  executionHistory: Array<{
    taskId: string;
    taskType: TaskType;
    executedAt: number;
    success: boolean;
    actualTokens?: number;
    actualComputeMs?: number;
  }>;
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
  maxTokensPerHour: number;
  maxComputeMsPerHour: number;
  minEnergyThreshold: number;
  criticalPriorityThreshold: number;
  tokenRegenPerHour: number;
  computeRegenPerHour: number;
  maxQueueSize: number;
  maxTaskAge: number;
}
/**
 * Default scheduler configuration
 */
export declare const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig;
/**
 * Default activity patterns (can be learned over time)
 */
export declare const DEFAULT_ACTIVITY_PATTERNS: ActivityPatterns;
/**
 * Create initial energy budget
 */
export declare function createInitialEnergyBudget(config?: SchedulerConfig): EnergyBudget;
/**
 * Create initial scheduler state
 */
export declare function createInitialSchedulerState(): SchedulerState;
//# sourceMappingURL=types.d.ts.map
