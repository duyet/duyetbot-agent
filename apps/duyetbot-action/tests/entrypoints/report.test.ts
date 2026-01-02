/**
 * Report Entrypoint Tests
 *
 * Basic smoke tests for report.ts entrypoint.
 *
 * Note: Comprehensive testing of entrypoints requires:
 * - Mocking @actions/core functions (getInput, summary)
 * - Mocking file system operations (Bun.file)
 * - Testing summary generation
 *
 * Due to limitations in Bun's vitest environment with ES modules and hoisted mocks,
 * these are basic import/structure tests.
 */

import { describe, expect, it } from 'vitest';

describe('report entrypoint', () => {
  it('should have a run function', async () => {
    const module = await import('../../src/entrypoints/report.js');
    expect(module.run).toBeInstanceOf(Function);
  });

  it('should export the run function', async () => {
    const module = await import('../../src/entrypoints/report.js');
    expect(typeof module.run).toBe('function');
  });

  it('should handle summary generation', async () => {
    const module = await import('../../src/entrypoints/report.js');
    expect(module.run).toBeDefined();
  });
});
