import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    name: 'telegram-bot-e2e',
    include: ['src/__tests__/e2e/**/*.test.ts'],
    // Exclude the test worker from tests (it's a helper, not a test)
    exclude: ['src/__tests__/e2e/test-worker.ts'],
    testTimeout: 30000,
    poolOptions: {
      workers: {
        // Use test-specific config with minimal worker
        wrangler: { configPath: './wrangler.test.toml' },
        miniflare: {
          // Enable isolated storage for test isolation
          // Note: JSRPC DO storage access may show warnings but tests still pass
          // See: https://developers.cloudflare.com/workers/testing/vitest-integration/known-issues/#isolated-storage
          isolatedStorage: true,
        },
      },
    },
  },
});
