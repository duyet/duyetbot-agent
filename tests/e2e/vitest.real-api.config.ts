import { defineConfig } from 'vitest/config';

// Base configuration extends the existing vitest.config.ts
const baseConfig = await import('./vitest.config.ts');

export default defineConfig({
  ...baseConfig.default,
  test: {
    ...baseConfig.default.test,
    // Override for real API tests
    testTimeout: 120000, // 2 minutes for real API calls
    hookTimeout: 120000,
    // Only run real API tests when environment is configured
    include: ['src/**/*.real-api.test.ts'],
    // Additional setup for real API testing
    setupFiles: ['./src/helpers/setup.ts', './src/helpers/real-api-setup.ts'],
    // Environment variables for real API testing
    env: {
      NODE_ENV: 'test',
      AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,
      AI_GATEWAY_NAME: process.env.AI_GATEWAY_NAME || 'duyetbot',
      MODEL: process.env.MODEL || 'x-ai/grok-4.1-fast',
      ROUTER_DEBUG: process.env.ROUTER_DEBUG || 'false',
    },
    // Add test name pattern to distinguish from regular E2E tests
    testNamePattern: '\\[real-api\\]',
  },
});
