/**
 * Energy Budget System
 *
 * Implements a hybrid energy budget that combines:
 * - Token-based costs (LLM API usage)
 * - Compute-based costs (runtime/wall-clock time)
 * - Priority weighting (value adjustment)
 *
 * The scheduler uses this to decide if the bot has enough "energy" to execute a task.
 * Energy regenerates over time (10% per hour) like a biological organism.
 */
import type { EnergyBudget, EnergyCost, ScheduledTask } from './types.js';
/**
 * Configuration constants for energy calculations
 */
export declare const ENERGY_CONSTANTS: {
  readonly TOKEN_WEIGHT: 1;
  readonly COMPUTE_WEIGHT: 0.001;
  readonly REGEN_PER_HOUR: 0.1;
  readonly MIN_REGEN_INTERVAL_MS: 60000;
};
/**
 * Calculate the effective energy cost of a task
 *
 * Combines token cost, compute cost, and applies priority weighting.
 * Higher priority weights make tasks "cheaper" relative to their cost.
 *
 * Formula: (tokens * TOKEN_WEIGHT + computeMs * COMPUTE_WEIGHT) / priorityWeight
 *
 * @param task - The task to calculate cost for
 * @param priorityWeights - Optional priority weights override; uses task.type if not provided
 * @returns Energy cost (0-1 normalized scale where 1.0 = full budget hour)
 *
 * @example
 * ```typescript
 * const task = {
 *   energyCost: { tokens: 5000, computeMs: 15000 },
 *   type: 'maintenance',
 *   priority: 50
 * };
 * const cost = calculateEffectiveEnergyCost(task, DEFAULT_PRIORITY_WEIGHTS);
 * // cost ≈ 0.05 (5% of hourly budget)
 * ```
 */
export declare function calculateEffectiveEnergyCost(
  task: ScheduledTask,
  priorityWeights: Record<string, number>
): number;
/**
 * Regenerate energy budget over time
 *
 * Updates token and compute budgets based on elapsed time since last regeneration.
 * Regeneration follows the formula: new = min(max, current + (max * REGEN_PER_HOUR * hoursElapsed))
 *
 * Also resets hourly usage counters if a new hour has started.
 *
 * @param budget - The energy budget to update (mutated in place)
 * @param now - Current timestamp in ms
 * @returns Updated budget (same object)
 *
 * @example
 * ```typescript
 * const budget = createInitialEnergyBudget();
 * // Wait 1 hour...
 * const updated = regenerateEnergy(budget, Date.now());
 * // budget.tokens.current is now at max
 * ```
 */
export declare function regenerateEnergy(budget: EnergyBudget, now: number): EnergyBudget;
/**
 * Check if the budget can afford a task
 *
 * Considers both current budget levels and whether the effective cost is within limits.
 * Also applies a minimum threshold to prevent executing when energy is critically low.
 *
 * @param budget - The energy budget to check
 * @param task - The task to afford
 * @param minThresholdPercent - Minimum energy % required (default: 20%)
 * @returns true if the task can be executed
 *
 * @example
 * ```typescript
 * const canRun = canAffordTask(budget, task, 30);
 * if (!canRun) {
 *   console.log('Not enough energy - need to rest');
 * }
 * ```
 */
export declare function canAffordTask(
  budget: EnergyBudget,
  task: ScheduledTask,
  minThresholdPercent?: number
): boolean;
/**
 * Deduct energy after task execution
 *
 * Reduces both token and compute budgets based on actual or estimated costs.
 * Updates hourly usage counters for analytics.
 *
 * @param budget - The energy budget to update (mutated in place)
 * @param task - The task that was executed
 * @param actualCost - Optional actual cost (overrides task.energyCost)
 * @returns Updated budget
 *
 * @example
 * ```typescript
 * await executeTask(task);
 * const actualCost = { tokens: 4800, computeMs: 14500 };
 * deductEnergy(budget, task, actualCost);
 * ```
 */
export declare function deductEnergy(
  budget: EnergyBudget,
  task: ScheduledTask,
  actualCost?: EnergyCost
): EnergyBudget;
/**
 * Get current energy as a percentage
 *
 * Calculates energy as the minimum of token and compute percentages
 * (bottleneck determines overall energy level).
 *
 * @param budget - The energy budget to check
 * @returns Energy percentage (0-100)
 *
 * @example
 * ```typescript
 * const percent = getEnergyPercentage(budget);
 * if (percent < 20) {
 *   console.log('Low energy - enter quiet period');
 * }
 * ```
 */
export declare function getEnergyPercentage(budget: EnergyBudget): number;
/**
 * Get detailed energy breakdown
 *
 * Returns both token and compute energy levels separately for detailed analysis.
 *
 * @param budget - The energy budget to analyze
 * @returns Object with token and compute percentages
 *
 * @example
 * ```typescript
 * const breakdown = getEnergyBreakdown(budget);
 * console.log(`Tokens: ${breakdown.tokenPercent}%, Compute: ${breakdown.computePercent}%`);
 * ```
 */
export declare function getEnergyBreakdown(budget: EnergyBudget): {
  tokenPercent: number;
  computePercent: number;
  bottleneck: 'token' | 'compute';
};
//# sourceMappingURL=energy.d.ts.map
