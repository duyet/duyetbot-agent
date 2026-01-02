/**
 * Vitest Setup File
 *
 * Global test setup for mocking @actions/core and other shared dependencies
 */

import { vi } from 'vitest';

// Create mock functions
const getInput = vi.fn((name: string) => '');
const setOutput = vi.fn(() => {});
const setFailed = vi.fn(() => {});
const exportVariable = vi.fn(() => {});
const saveState = vi.fn(() => {});
const getState = vi.fn(() => '');
const summary = {
  addRaw: vi.fn().mockReturnThis(),
  addTable: vi.fn().mockReturnThis(),
  write: vi.fn().mockResolvedValue(undefined),
};

// Mock @actions/core
vi.mock('@actions/core', () => ({
  getInput,
  setOutput,
  setFailed,
  exportVariable,
  saveState,
  getState,
  summary,
}));

// Mock environment variables for GitHub Actions
process.env.GITHUB_EVENT_NAME = 'issues';
process.env.GITHUB_EVENT_ACTION = 'labeled';
process.env.GITHUB_ACTOR = 'test-user';
process.env.GITHUB_REPOSITORY = 'test-owner/test-repo';
process.env.GITHUB_RUN_ID = 'test-run-id';
process.env.RUNNER_TEMP = '/tmp/runner';
process.env.GITHUB_EVENT_PATH = '/tmp/github-event.json';

// Mock event payload (using Node.js fs instead of Bun.write for vitest compatibility)
import { writeFileSync } from 'node:fs';

writeFileSync(
  '/tmp/github-event.json',
  JSON.stringify({
    action: 'labeled',
    issue: {
      number: 123,
      title: 'Test Issue',
      body: 'Test body',
      user: {
        login: 'test-user',
      },
      labels: [
        {
          name: 'duyetbot',
        },
      ],
    },
    repository: {
      name: 'test-repo',
      owner: {
        login: 'test-owner',
      },
    },
  })
);
