import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: {
      // Mock cloudflare-specific imports for tests
      'cloudflare:sockets': './src/__mocks__/cloudflare-sockets.ts',
    },
  },
});
