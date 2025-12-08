/**
 * Analytics Cost Config Storage
 * Provides TypeScript interface to analytics_cost_config table
 * Manages model pricing configuration for cost calculation
 */

import { BaseStorage } from './base.js';

/**
 * Cost config type
 */
export interface CostConfig {
  id: number;
  model: string;
  provider: string;
  inputCostPer1k: number;
  outputCostPer1k: number;
  cachedCostPer1k: number;
  reasoningCostPer1k: number;
  effectiveFrom: number;
  effectiveTo?: number;
  notes?: string;
  createdAt: number;
  createdBy?: string;
}

/**
 * Input for creating cost config
 */
export interface CreateCostConfigInput {
  model: string;
  provider: string;
  inputCostPer1k: number;
  outputCostPer1k: number;
  cachedCostPer1k?: number;
  reasoningCostPer1k?: number;
  notes?: string;
  createdBy?: string;
}

/**
 * Token usage breakdown for cost calculation
 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
  reasoningTokens?: number;
}

/**
 * CostConfigStorage handles D1 operations for pricing configuration.
 * Provides authoritative source for token costs by model and provider.
 */
export class CostConfigStorage extends BaseStorage {
  /**
   * Get current pricing for all models
   * @returns Array of active pricing configs
   */
  async getCurrentPricing(): Promise<CostConfig[]> {
    return this.all<CostConfig>(
      'SELECT * FROM analytics_cost_config WHERE effective_to IS NULL ORDER BY model, provider'
    );
  }

  /**
   * Get pricing for a specific model
   * @param model Model identifier
   * @param provider Provider name
   * @returns Pricing config if found, null otherwise
   */
  async getPricingForModel(model: string, provider: string): Promise<CostConfig | null> {
    const result = await this.first<CostConfig>(
      'SELECT * FROM analytics_cost_config WHERE model = ? AND provider = ? AND effective_to IS NULL LIMIT 1',
      [model, provider]
    );

    return result || null;
  }

  /**
   * Get historical pricing for a model at a specific time
   * @param model Model identifier
   * @param provider Provider name
   * @param timestamp Time to look up pricing for
   * @returns Pricing config if found, null otherwise
   */
  async getPricingForModelAtTime(
    model: string,
    provider: string,
    timestamp: number
  ): Promise<CostConfig | null> {
    const result = await this.first<CostConfig>(
      `SELECT * FROM analytics_cost_config
      WHERE model = ? AND provider = ?
        AND effective_from <= ?
        AND (effective_to IS NULL OR effective_to > ?)
      ORDER BY effective_from DESC
      LIMIT 1`,
      [model, provider, timestamp, timestamp]
    );

    return result || null;
  }

  /**
   * Add new pricing configuration
   * @param input Pricing configuration input
   * @returns Created pricing config
   */
  async addPricing(input: CreateCostConfigInput): Promise<CostConfig> {
    // Check if there's an existing active config
    const existing = await this.getPricingForModel(input.model, input.provider);

    // If there is, deactivate it
    if (existing) {
      await this.run('UPDATE analytics_cost_config SET effective_to = ? WHERE id = ?', [
        Date.now(),
        existing.id,
      ]);
    }

    const now = Date.now();
    const result = await this.first<CostConfig>(
      `INSERT INTO analytics_cost_config (
        model, provider,
        input_cost_per_1k, output_cost_per_1k, cached_cost_per_1k, reasoning_cost_per_1k,
        effective_from, notes, created_at, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *`,
      [
        input.model,
        input.provider,
        input.inputCostPer1k,
        input.outputCostPer1k,
        input.cachedCostPer1k ?? 0,
        input.reasoningCostPer1k ?? 0,
        now,
        input.notes ?? null,
        now,
        input.createdBy ?? null,
      ]
    );

    if (!result) {
      throw new Error(`Failed to create cost config for ${input.model}`);
    }

    return result;
  }

  /**
   * Calculate cost for token usage
   * @param tokens Token usage breakdown
   * @param model Model identifier
   * @param provider Provider name
   * @returns Estimated cost in USD
   */
  async calculateCost(tokens: TokenUsage, model: string, provider: string): Promise<number> {
    const config = await this.getPricingForModel(model, provider);
    if (!config) {
      throw new Error(`No pricing found for ${model} from ${provider}`);
    }

    let cost = 0;

    // Calculate input tokens cost
    cost += (tokens.inputTokens / 1000) * config.inputCostPer1k;

    // Calculate output tokens cost
    cost += (tokens.outputTokens / 1000) * config.outputCostPer1k;

    // Calculate cached tokens cost (if applicable)
    if (tokens.cachedTokens && tokens.cachedTokens > 0) {
      cost += (tokens.cachedTokens / 1000) * config.cachedCostPer1k;
    }

    // Calculate reasoning tokens cost (if applicable)
    if (tokens.reasoningTokens && tokens.reasoningTokens > 0) {
      cost += (tokens.reasoningTokens / 1000) * config.reasoningCostPer1k;
    }

    return cost;
  }

  /**
   * Calculate cost for token usage with historical pricing
   * @param tokens Token usage breakdown
   * @param model Model identifier
   * @param provider Provider name
   * @param timestamp Time to look up pricing for
   * @returns Estimated cost in USD
   */
  async calculateCostAtTime(
    tokens: TokenUsage,
    model: string,
    provider: string,
    timestamp: number
  ): Promise<number> {
    const config = await this.getPricingForModelAtTime(model, provider, timestamp);
    if (!config) {
      throw new Error(
        `No pricing found for ${model} from ${provider} at ${new Date(timestamp).toISOString()}`
      );
    }

    let cost = 0;

    // Calculate input tokens cost
    cost += (tokens.inputTokens / 1000) * config.inputCostPer1k;

    // Calculate output tokens cost
    cost += (tokens.outputTokens / 1000) * config.outputCostPer1k;

    // Calculate cached tokens cost (if applicable)
    if (tokens.cachedTokens && tokens.cachedTokens > 0) {
      cost += (tokens.cachedTokens / 1000) * config.cachedCostPer1k;
    }

    // Calculate reasoning tokens cost (if applicable)
    if (tokens.reasoningTokens && tokens.reasoningTokens > 0) {
      cost += (tokens.reasoningTokens / 1000) * config.reasoningCostPer1k;
    }

    return cost;
  }

  /**
   * Get all pricing for a provider
   * @param provider Provider name
   * @returns Array of pricing configs
   */
  async getPricingByProvider(provider: string): Promise<CostConfig[]> {
    return this.all<CostConfig>(
      'SELECT * FROM analytics_cost_config WHERE provider = ? AND effective_to IS NULL ORDER BY model',
      [provider]
    );
  }

  /**
   * Get all models from a provider
   * @param provider Provider name
   * @returns Array of model names
   */
  async getModelsByProvider(provider: string): Promise<string[]> {
    const results = await this.all<{ model: string }>(
      'SELECT DISTINCT model FROM analytics_cost_config WHERE provider = ? AND effective_to IS NULL ORDER BY model',
      [provider]
    );

    return results.map((row) => row.model);
  }

  /**
   * Get all providers
   * @returns Array of provider names
   */
  async getProviders(): Promise<string[]> {
    const results = await this.all<{ provider: string }>(
      'SELECT DISTINCT provider FROM analytics_cost_config WHERE effective_to IS NULL ORDER BY provider'
    );

    return results.map((row) => row.provider);
  }

  /**
   * Get pricing history for a model
   * @param model Model identifier
   * @param provider Provider name
   * @returns Array of pricing configs (including expired ones)
   */
  async getPricingHistory(model: string, provider: string): Promise<CostConfig[]> {
    return this.all<CostConfig>(
      'SELECT * FROM analytics_cost_config WHERE model = ? AND provider = ? ORDER BY effective_from DESC',
      [model, provider]
    );
  }

  /**
   * Deactivate a pricing configuration
   * @param id Config ID to deactivate
   */
  async deactivate(id: number): Promise<void> {
    await this.run(
      'UPDATE analytics_cost_config SET effective_to = ? WHERE id = ? AND effective_to IS NULL',
      [Date.now(), id]
    );
  }
}
