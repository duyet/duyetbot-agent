/**
 * Test Context Helpers
 *
 * Utilities for setting up test environment and context.
 */

import type { Config } from '../../src/config.js';
import type { GitHubContext } from '../../src/github/context.js';
import { mockGitHubActionsEnv } from './mocks.js';
import { MockOctokit } from './octokit-mock.js';

/**
 * Test context interface
 */
export interface TestContext {
  githubContext: GitHubContext;
  config: Config;
  octokit: MockOctokit;
  env: Record<string, string>;
}

/**
 * Create a minimal test GitHub context
 */
export function createTestGitHubContext(overrides?: Partial<GitHubContext>): GitHubContext {
  const context: GitHubContext = {
    eventName: 'issue_comment',
    eventAction: 'created',
    actor: 'test-user',
    repository: {
      owner: 'test-owner',
      repo: 'test-repo',
      fullName: 'test-owner/test-repo',
    },
    entityNumber: 1,
    isPR: false,
    payload: {},
    inputs: {
      triggerPhrase: '@duyetbot',
      labelTrigger: 'duyetbot',
      prompt: '',
      settings: '',
      claudeArgs: '',
      baseBranch: 'main',
      branchPrefix: 'duyetbot/',
      allowedBots: '',
      allowedNonWriteUsers: '',
      useStickyComment: 'true',
      useCommitSigning: 'false',
      botId: '41898282',
      botName: 'duyetbot[bot]',
      githubToken: 'ghp_test',
    },
    runId: '123456',
  };

  return { ...context, ...overrides };
}

/**
 * Create a minimal test config
 */
export function createTestConfig(overrides?: Partial<Config>): Config {
  const config: Config = {
    apiKey: 'test-api-key',
    githubToken: 'ghp_test_token',
    model: 'xiaomi/mimo-v2-flash:free',
    maxIterations: 10,
    checkpointDir: '.agent/checkpoints',
    logDir: '.agent/logs',
    dryRun: false,
    taskSources: ['github-issues', 'file', 'memory'],
    repository: {
      owner: 'test-owner',
      name: 'test-repo',
    },
    continuous: {
      enabled: false,
      maxTasks: 100,
      delayBetweenTasks: 5000,
      closeIssuesAfterMerge: true,
      stopOnFirstFailure: false,
    },
    autoMerge: {
      enabled: true,
      requireChecks: ['ci', 'test'],
      waitForChecks: true,
      timeout: 600000,
      approveFirst: true,
      deleteBranch: true,
    },
  };

  return { ...config, ...overrides } as Config;
}

/**
 * Setup test environment variables
 */
export function setupTestEnv(env: Record<string, string>): void {
  Object.entries(env).forEach(([key, value]) => {
    process.env[key] = value;
  });
}

/**
 * Clear test environment variables
 */
export function clearTestEnv(): void {
  const keysToRemove = [
    'GITHUB_EVENT_NAME',
    'GITHUB_EVENT_ACTION',
    'GITHUB_REPOSITORY',
    'GITHUB_ACTOR',
    'GITHUB_RUN_ID',
    'GITHUB_REF',
    'GITHUB_SHA',
    'GITHUB_WORKSPACE',
    'GITHUB_API_URL',
    'DUYETBOT_API_KEY',
    'GITHUB_TOKEN',
    'DRY_RUN',
  ];

  keysToRemove.forEach((key) => {
    delete process.env[key];
  });
}

/**
 * Create a complete test context
 */
export function createTestContext(options?: {
  githubContextOverrides?: Partial<GitHubContext>;
  configOverrides?: Partial<Config>;
  env?: Record<string, string>;
}): TestContext {
  const env =
    options?.env ||
    mockGitHubActionsEnv({
      eventName: 'issue_comment',
      eventAction: 'created',
      owner: 'test-owner',
      repo: 'test-repo',
      actor: 'test-user',
      runId: '123456',
    });

  setupTestEnv(env);

  const githubContext = createTestGitHubContext(options?.githubContextOverrides);
  const config = createTestConfig(options?.configOverrides);
  const octokit = new MockOctokit();

  return {
    githubContext,
    config,
    octokit,
    env,
  };
}

/**
 * Cleanup test context
 */
export function cleanupTestContext(): void {
  clearTestEnv();
}

/**
 * Assert that a PR was created with expected properties
 */
export function assertPRCreated(
  octokit: MockOctokit,
  expected: {
    title: string;
    head: string;
    base: string;
  }
): void {
  const wasCalled = octokit.verifyCalled('pulls', 'create', 1);
  if (!wasCalled) {
    throw new Error('Expected PR to be created');
  }

  const args = octokit.getLastCallArgs('pulls', 'create');
  if (!args) {
    throw new Error('No PR creation args found');
  }

  if (expected.title && args.title !== expected.title) {
    throw new Error(`Expected PR title "${expected.title}", got "${args.title}"`);
  }

  if (expected.head && args.head !== expected.head) {
    throw new Error(`Expected PR head "${expected.head}", got "${args.head}"`);
  }

  if (expected.base && args.base !== expected.base) {
    throw new Error(`Expected PR base "${expected.base}", got "${args.base}"`);
  }
}

/**
 * Assert that a comment was created
 */
export function assertCommentCreated(octokit: MockOctokit, expectedBody?: string): void {
  const wasCalled = octokit.verifyCalled('issues', 'createComment', 1);
  if (!wasCalled) {
    throw new Error('Expected comment to be created');
  }

  if (expectedBody) {
    const args = octokit.getLastCallArgs('issues', 'createComment');
    if (!args || !args.body.includes(expectedBody)) {
      throw new Error(`Expected comment body to include "${expectedBody}"`);
    }
  }
}

/**
 * Assert that a comment was updated
 */
export function assertCommentUpdated(octokit: MockOctokit, times?: number): void {
  const wasCalled = octokit.verifyCalled('issues', 'updateComment', times);
  if (!wasCalled) {
    throw new Error(`Expected comment to be updated ${times || 'at least once'}`);
  }
}

/**
 * Assert that labels were added
 */
export function assertLabelsAdded(octokit: MockOctokit, expectedLabels: string[]): void {
  const wasCalled = octokit.verifyCalled('issues', 'addLabels', 1);
  if (!wasCalled) {
    throw new Error('Expected labels to be added');
  }

  const args = octokit.getLastCallArgs('issues', 'addLabels');
  if (!args) {
    throw new Error('No label addition args found');
  }

  const labels = args.labels || [];
  expectedLabels.forEach((label) => {
    if (!labels.includes(label)) {
      throw new Error(`Expected label "${label}" to be added`);
    }
  });
}

/**
 * Assert that a PR was merged
 */
export function assertPRMerged(octokit: MockOctokit, prNumber: number): void {
  const wasCalled = octokit.verifyCalled('pulls', 'merge', 1);
  if (!wasCalled) {
    throw new Error('Expected PR to be merged');
  }

  const args = octokit.getLastCallArgs('pulls', 'merge');
  if (!args || args.pull_number !== prNumber) {
    throw new Error(`Expected PR #${prNumber} to be merged`);
  }
}

/**
 * Assert that permission check was performed
 */
export function assertPermissionChecked(octokit: MockOctokit): void {
  const wasCalled = octokit.verifyCalled('repos', 'get', 1);
  if (!wasCalled) {
    throw new Error('Expected repository permissions to be checked');
  }
}

/**
 * Wait for async operations
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
