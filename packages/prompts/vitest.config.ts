import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'prompts',
    include: ['src/**/*.test.ts'],
  },
});
