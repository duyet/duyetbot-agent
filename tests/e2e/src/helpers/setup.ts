// E2E test setup
import { beforeAll, afterAll } from 'vitest';

// Global setup for E2E tests
beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key';
});

afterAll(async () => {
  // Cleanup
});
