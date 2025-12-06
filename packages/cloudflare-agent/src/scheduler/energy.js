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
/**
 * Configuration constants for energy calculations
 */
export const ENERGY_CONSTANTS = {
  TOKEN_WEIGHT: 1.0, // 1 unit energy per token
  COMPUTE_WEIGHT: 0.001, // 1 unit energy per ms of compute (1ms = 0.001 units)
  REGEN_PER_HOUR: 0.1, // Regenerate 10% per hour (full in 10 hours)
  MIN_REGEN_INTERVAL_MS: 60000, // Don't regen more than every minute
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
export function calculateEffectiveEnergyCost(task, priorityWeights) {
  const { tokens, computeMs } = task.energyCost;
  const weight = priorityWeights[task.type] ?? 1.0;
  // Calculate raw cost in energy units
  const rawCost =
    tokens * ENERGY_CONSTANTS.TOKEN_WEIGHT + computeMs * ENERGY_CONSTANTS.COMPUTE_WEIGHT;
  // Apply priority weight (higher weight = lower cost)
  const effectiveCost = rawCost / weight;
  // Normalize to 0-1 scale (assuming max hour is ~100k tokens + 300k ms)
  // This is approximate; adjust based on actual usage patterns
  const normalizedCost = effectiveCost / 100000; // Rough normalization
  return Math.max(0, Math.min(1, normalizedCost)); // Clamp to 0-1
}
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
export function regenerateEnergy(budget, now) {
  const timeSinceLastRegen = now - budget.lastRegenAt;
  // Only regenerate if enough time has passed (avoid constant small updates)
  if (timeSinceLastRegen < ENERGY_CONSTANTS.MIN_REGEN_INTERVAL_MS) {
    return budget;
  }
  const hoursElapsed = timeSinceLastRegen / (60 * 60 * 1000);
  // Regenerate tokens
  const tokenRegen = budget.tokens.maxPerHour * ENERGY_CONSTANTS.REGEN_PER_HOUR * hoursElapsed;
  budget.tokens.current = Math.min(budget.tokens.maxPerHour, budget.tokens.current + tokenRegen);
  // Regenerate compute
  const computeRegen = budget.compute.maxMsPerHour * ENERGY_CONSTANTS.REGEN_PER_HOUR * hoursElapsed;
  budget.compute.currentMs = Math.min(
    budget.compute.maxMsPerHour,
    budget.compute.currentMs + computeRegen
  );
  // Reset hourly counters if a new hour has started
  if (now - budget.hourStartedAt > 60 * 60 * 1000) {
    budget.tokens.usedThisHour = 0;
    budget.compute.usedThisHour = 0;
    budget.hourStartedAt = now;
  }
  budget.lastRegenAt = now;
  return budget;
}
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
export function canAffordTask(budget, task, minThresholdPercent = 20) {
  // Check minimum energy threshold
  const energyPercent = getEnergyPercentage(budget);
  if (energyPercent < minThresholdPercent) {
    return false;
  }
  // Check if we have enough tokens
  if (task.energyCost.tokens > budget.tokens.current) {
    return false;
  }
  // Check if we have enough compute time
  if (task.energyCost.computeMs > budget.compute.currentMs) {
    return false;
  }
  // Check effective cost doesn't exceed remaining budget
  const effectiveCost = calculateEffectiveEnergyCost(task, budget.priorityWeights);
  const remainingBudgetPercent = energyPercent / 100;
  if (effectiveCost > remainingBudgetPercent) {
    return false;
  }
  return true;
}
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
export function deductEnergy(budget, task, actualCost) {
  const cost = actualCost ?? task.energyCost;
  // Deduct from current budget
  budget.tokens.current = Math.max(0, budget.tokens.current - cost.tokens);
  budget.compute.currentMs = Math.max(0, budget.compute.currentMs - cost.computeMs);
  // Update hourly usage
  budget.tokens.usedThisHour += cost.tokens;
  budget.compute.usedThisHour += cost.computeMs;
  return budget;
}
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
export function getEnergyPercentage(budget) {
  const tokenPercent = (budget.tokens.current / budget.tokens.maxPerHour) * 100;
  const computePercent = (budget.compute.currentMs / budget.compute.maxMsPerHour) * 100;
  // Return the bottleneck (whichever is lower)
  return Math.min(tokenPercent, computePercent);
}
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
export function getEnergyBreakdown(budget) {
  const tokenPercent = (budget.tokens.current / budget.tokens.maxPerHour) * 100;
  const computePercent = (budget.compute.currentMs / budget.compute.maxMsPerHour) * 100;
  return {
    tokenPercent,
    computePercent,
    bottleneck: tokenPercent <= computePercent ? 'token' : 'compute',
  };
}
