/**
 * Provider Factory
 *
 * Factory for creating and managing LLM provider instances
 */

import type { LLMProvider, ProviderConfig } from '@duyetbot/types';
import { parseProviderFormat } from '@duyetbot/types';

/**
 * Factory for creating and managing LLM providers
 */
export class ProviderFactory {
  private providers = new Map<string, LLMProvider>();

  /**
   * Register a provider
   */
  register(name: string, provider: LLMProvider): void {
    if (this.providers.has(name)) {
      throw new Error(`Provider "${name}" is already registered`);
    }

    this.providers.set(name, provider);
  }

  /**
   * Get a registered provider
   */
  get(name: string): LLMProvider {
    const provider = this.providers.get(name);

    if (!provider) {
      throw new Error(`Provider "${name}" is not registered`);
    }

    return provider;
  }

  /**
   * Check if a provider is registered
   */
  has(name: string): boolean {
    return this.providers.has(name);
  }

  /**
   * Create a provider from format string
   * Format: <provider>:<model_id>
   */
  createFromFormat(format: string, config: ProviderConfig): LLMProvider {
    const parsed = parseProviderFormat(format);
    const provider = this.get(parsed.provider);

    // Configure the provider with the model from the format string
    const configWithModel: ProviderConfig = {
      ...config,
      provider: parsed.provider,
      model: parsed.model,
    };

    provider.configure(configWithModel);

    return provider;
  }

  /**
   * List all registered providers
   */
  list(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Unregister a provider
   */
  unregister(name: string): void {
    this.providers.delete(name);
  }

  /**
   * Clear all registered providers
   */
  clear(): void {
    this.providers.clear();
  }
}

/**
 * Singleton instance of the provider factory
 */
export const providerFactory = new ProviderFactory();

/**
 * Configuration for custom provider endpoints
 */
export interface CustomProviderConfig {
  type: 'anthropic' | 'openai' | 'openrouter';
  apiKey: string;
  baseURL?: string;
  models?: {
    haiku?: string;
    sonnet?: string;
    opus?: string;
  };
}

/**
 * Create a provider configuration for Z.AI (Claude-compatible API)
 * Z.AI uses GLM models with Claude-compatible API
 */
export function createZAIConfig(apiKey: string): CustomProviderConfig {
  return {
    type: 'anthropic',
    apiKey,
    baseURL: 'https://api.z.ai/api/anthropic',
    models: {
      haiku: 'glm-4.5-air',
      sonnet: 'glm-4.6',
      opus: 'glm-4.6',
    },
  };
}

/**
 * Create provider config from custom provider configuration
 */
export function createProviderConfig(custom: CustomProviderConfig, model: string): ProviderConfig {
  const config: ProviderConfig = {
    provider: custom.type,
    model,
    apiKey: custom.apiKey,
  };

  if (custom.baseURL) {
    config.baseURL = custom.baseURL;
  }

  return config;
}

/**
 * Re-export types from @duyetbot/types
 */
export type {
  LLMMessage,
  LLMProvider,
  LLMResponse,
  ProviderConfig,
  QueryOptions,
} from '@duyetbot/types';
