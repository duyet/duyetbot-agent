import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/index.ts',
        'vitest.config.ts',
        'wrangler.config.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
    setupFiles: [],
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@agent': path.resolve(__dirname, './src/agent'),
      '@tools': path.resolve(__dirname, './src/tools'),
      '@providers': path.resolve(__dirname, './src/providers'),
      '@agents': path.resolve(__dirname, './src/agents'),
      '@scheduler': path.resolve(__dirname, './src/scheduler'),
      '@config': path.resolve(__dirname, './src/config'),
      '@storage': path.resolve(__dirname, './src/storage'),
      '@ui': path.resolve(__dirname, './src/ui'),
    },
  },
});
