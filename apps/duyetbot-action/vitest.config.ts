import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Resource optimization: limit parallel workers to reduce CPU/memory usage
    maxWorkers: Math.min(
      4,
      typeof navigator !== 'undefined'
        ? navigator.hardwareConcurrency || 4
        : require('os').cpus().length
    ),
    // Disable file isolation to reduce memory overhead (reuses VM context)
    isolate: false,
    // Pool options for better resource management
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false,
      },
    },
  },
});
