/**
 * Test provider configuration for E2E testing with real LLM APIs
 *
 * This module provides environment-aware provider configuration that:
 * - Uses real APIs when AI Gateway token is available
 * - Falls back to mock providers when running in CI without secrets
 * - Supports both local development and CI environments
 */

import { createOpenRouterProvider } from '@duyetbot/providers';

export interface TestProviderConfig {
  useRealAPI: boolean;
  apiKey?: string;
  gatewayName?: string;
  model: string;
  baseURL?: string;
  timeout: number;
}

/**
 * Detects if we should use real APIs based on environment
 */
export function shouldUseRealAPI(): boolean {
  return !!(process.env.AI_GATEWAY_API_KEY && process.env.AI_GATEWAY_NAME);
}

/**
 * Creates provider configuration for testing
 */
export function createTestProviderConfig(): TestProviderConfig {
  const useRealAPI = shouldUseRealAPI();

  if (useRealAPI) {
    return {
      useRealAPI: true,
      apiKey: process.env.AI_GATEWAY_API_KEY!,
      gatewayName: process.env.AI_GATEWAY_NAME || 'duyetbot',
      model: process.env.MODEL || 'x-ai/grok-4.1-fast',
      baseURL: process.env.AI_GATEWAY_BASE_URL,
      timeout: 60000, // 60 seconds for real API calls
    };
  }

  // Fallback configuration for mock/testing
  return {
    useRealAPI: false,
    model: 'mock-model',
    timeout: 5000, // Shorter timeout for mocks
  };
}

/**
 * Creates an OpenRouter provider instance for testing
 */
export function createTestProvider() {
  const config = createTestProviderConfig();

  if (!config.useRealAPI) {
    return null; // Use mock providers in test environment
  }

  // Mock environment for testing
  const mockEnv = {
    AI: {
      gateway: (gatewayId: string) => ({
        getUrl: async (provider: string) =>
          config.baseURL || `https://gateway.ai.cloudflare.com/v2/${gatewayId}/${provider}`,
      }),
    },
    AI_GATEWAY_NAME: config.gatewayName!,
    AI_GATEWAY_API_KEY: config.apiKey!,
    MODEL: config.model,
  };

  return createOpenRouterProvider(mockEnv, {
    defaultModel: config.model,
    requestTimeout: config.timeout,
  });
}

/**
 * Test environment metadata
 */
export const testEnvironment = {
  isCI: process.env.CI === 'true',
  nodeEnv: process.env.NODE_ENV,
  hasRealAPI: shouldUseRealAPI(),
  configuredModel: process.env.MODEL || 'x-ai/grok-4.1-fast',
  gatewayName: process.env.AI_GATEWAY_NAME || 'duyetbot',
};

/**
 * Web search configuration for testing
 */
export function createWebSearchConfig() {
  const config = createTestProviderConfig();

  return {
    enabled: config.useRealAPI,
    useNativeSearch: config.model.includes('xai') || config.model.includes('grok'),
    searchTimeout: Math.min(config.timeout, 30000), // Cap search timeout at 30s
    maxResults: 5,
  };
}

/**
 * Parse mode testing configuration
 */
export const parseModeTestConfig = {
  modes: ['HTML', 'MarkdownV2'] as const,
  testMessages: {
    simple: ['hi', 'hello', 'help'],
    formatted: [
      'This is *bold* and _italic_ text',
      'Here is some `code` and [a link](https://example.com)',
      'Check out this ```typescript\nconst x = 1;\n``` code block',
    ],
    complex: [
      '*Bold* with _italic_ and `code` all together',
      'List item 1\nList item 2\n*Bold sublist*\n- Normal item',
      '[Link with *bold* text](https://example.com)',
    ],
  },
  fallbackTest: 'This message contains special characters: * _ ` [ ] ( ) ~ ` > # + - = | { } . !',
};

/**
 * Performance thresholds for E2E tests
 */
export function getPerformanceThresholds() {
  const config = createTestProviderConfig();

  return {
    simpleMessage: {
      maxResponseTime: config.useRealAPI ? 10000 : 1000, // 10s real, 1s mock
      minResponseLength: 10,
      maxResponseLength: 4000,
    },
    webSearch: {
      maxResponseTime: config.useRealAPI ? 30000 : 5000, // 30s real, 5s mock
      requiresCitations: config.useRealAPI,
    },
    complexQuery: {
      maxResponseTime: config.useRealAPI ? 20000 : 3000, // 20s real, 3s mock
      minResponseLength: 50,
    },
  };
}
