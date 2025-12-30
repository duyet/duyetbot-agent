import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // Point to specific files to avoid cloudflare: protocol imports from main index
      '@duyetbot/cloudflare-agent/chat/tool-executor': resolve(
        __dirname,
        '../../packages/cloudflare-agent/src/chat/tool-executor.ts'
      ),
      '@duyetbot/core': resolve(__dirname, '../../packages/core/src/index.ts'),
      '@duyetbot/hono-middleware': resolve(
        __dirname,
        '../../packages/hono-middleware/src/index.ts'
      ),
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
