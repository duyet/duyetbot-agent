import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'shared-agents',
    include: ['src/**/*.test.ts'],
  },
});
