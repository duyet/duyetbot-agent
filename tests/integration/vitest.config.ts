import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@duyetbot/core': resolve(__dirname, '../../packages/core/src/index.ts'),
      '@duyetbot/tools': resolve(__dirname, '../../packages/tools/src/index.ts'),
      '@duyetbot/types': resolve(__dirname, '../../packages/types/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
