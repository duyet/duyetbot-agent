import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'chat-agent',
    include: ['src/**/*.test.ts'],
  },
});
