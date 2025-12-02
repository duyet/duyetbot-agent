import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from '../../packages/config-vitest/vitest.config';

export default mergeConfig(
  baseConfig,
  defineConfig({
    plugins: [react()],
    resolve: {
      alias: {
        'fumadocs-ui/provider': resolve(__dirname, 'src/__mocks__/fumadocs-provider.tsx'),
        'fumadocs-ui/components/card': resolve(__dirname, 'src/__mocks__/fumadocs-card.tsx'),
        'next/link': resolve(__dirname, 'src/__mocks__/next-link.tsx'),
        'next/navigation': resolve(__dirname, 'src/__mocks__/next-navigation.tsx'),
      },
    },
    test: {
      environment: 'jsdom',
      include: ['**/?(*.)+(spec|test).[jt]s?(x)', '**/__tests__/**/*.[jt]s?(x)'],
      setupFiles: ['./src/test-setup.tsx'],
    },
  })
);
