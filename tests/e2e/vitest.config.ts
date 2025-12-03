import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 30000, // E2E tests need longer timeout
    hookTimeout: 30000,
    setupFiles: ['./src/helpers/setup.ts'],
  },
  resolve: {
    alias: [
      // Mock Cloudflare-specific modules
      {
        find: 'agents',
        replacement: resolve(__dirname, './src/__mocks__/agents.ts'),
      },
      // Memory MCP package
      {
        find: /^@duyetbot\/memory-mcp\/(.*)$/,
        replacement: resolve(__dirname, '../../apps/memory-mcp/src/$1.ts'),
      },
      {
        find: '@duyetbot/memory-mcp',
        replacement: resolve(__dirname, '../../apps/memory-mcp/src/index.ts'),
      },
      // Core package
      {
        find: /^@duyetbot\/core\/(.*)$/,
        replacement: resolve(__dirname, '../../packages/core/src/$1.ts'),
      },
      {
        find: '@duyetbot/core',
        replacement: resolve(__dirname, '../../packages/core/src/index.ts'),
      },
      // Tools package
      {
        find: /^@duyetbot\/tools\/(.*)$/,
        replacement: resolve(__dirname, '../../packages/tools/src/$1.ts'),
      },
      {
        find: '@duyetbot/tools',
        replacement: resolve(__dirname, '../../packages/tools/src/index.ts'),
      },
      // Types package
      {
        find: /^@duyetbot\/types\/(.*)$/,
        replacement: resolve(__dirname, '../../packages/types/src/$1.ts'),
      },
      {
        find: '@duyetbot/types',
        replacement: resolve(__dirname, '../../packages/types/src/index.ts'),
      },
      // CLI package
      {
        find: /^@duyetbot\/cli\/(.*)$/,
        replacement: resolve(__dirname, '../../packages/cli/src/$1.ts'),
      },
      {
        find: '@duyetbot/cli',
        replacement: resolve(__dirname, '../../packages/cli/src/index.ts'),
      },
    ],
  },
});
