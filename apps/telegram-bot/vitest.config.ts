import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    // Exclude E2E tests - they require Workers runtime
    exclude: ['src/__tests__/e2e/**/*'],
    testTimeout: 10000,
  },
});
