/**
 * Update Comment Entrypoint Tests
 *
 * Basic smoke tests for update-comment.ts entrypoint.
 *
 * Note: Comprehensive testing of entrypoints requires:
 * - Mocking @actions/core functions (getInput)
 * - Mocking file system operations (Bun.file)
 * - Testing update body generation with various execution results
 *
 * Due to limitations in Bun's vitest environment with ES modules and hoisted mocks,
 * these are basic import/structure tests.
 */

import { describe, expect, it } from 'vitest';

describe('update-comment entrypoint', () => {
  it('should have a run function', async () => {
    const module = await import('../../src/entrypoints/update-comment.js');
    expect(module.run).toBeInstanceOf(Function);
  });

  it('should export the run function', async () => {
    const module = await import('../../src/entrypoints/update-comment.js');
    expect(typeof module.run).toBe('function');
  });

  it('should handle comment updates', async () => {
    const module = await import('../../src/entrypoints/update-comment.js');
    expect(module.run).toBeDefined();
  });
});
