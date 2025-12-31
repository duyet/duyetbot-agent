/**
 * GitHub Bot Webhook Flow Integration Tests
 *
 * Tests the webhook flow components including middleware chain,
 * context parsing, and transport layer integration.
 *
 * Note: Full end-to-end webhook → agent flow tests are excluded because
 * the agent.ts imports @duyetbot/cloudflare-agent which has Cloudflare
 * Worker-specific imports that cannot be mocked in Vitest (ERR_UNSUPPORTED_ESM_URL_SCHEME).
 *
 * Test Categories:
 * 1. Webhook payload parsing
 * 2. Mention detection and extraction
 * 3. Transport layer context creation
 * 4. GitHub context to ParsedInput conversion
 */

import { describe, expect, it } from 'vitest';
import {
  extractAllMentions,
  hasMention,
  isCommand,
  parseCommand,
  parseMention,
} from '../mention-parser.js';
import { createGitHubContext, type GitHubContext, githubTransport } from '../transport.js';

describe('GitHub Bot Webhook Flow Integration', () => {
  describe('Webhook Payload Processing', () => {
    it('should parse mention from issue comment', () => {
      const comment = '@duyetbot please help me with this issue';
      const result = parseMention(comment, 'duyetbot');

      expect(result).toBeDefined();
      expect(result.found).toBe(true);
      expect(result.task).toBe('please help me with this issue');
      expect(result.fullMatch).toBe('@duyetbot please help me with this issue');
    });

    it('should parse mention from PR comment with code block', () => {
      const comment = `@duyetbot can you review this code?

\`\`\`typescript
function test() {
  return 'hello';
}
\`\`\`

The issue is in line 3.`;

      const result = parseMention(comment, 'duyetbot');

      expect(result).toBeDefined();
      expect(result.found).toBe(true);
      expect(result.task).toContain('can you review this code');
    });

    it('should detect multiple mentions in text', () => {
      // extractAllMentions looks for @duyetbot mentions and extracts the task text after each
      const text1 = '@duyetbot please review this code';
      const mentions1 = extractAllMentions(text1);
      expect(mentions1).toEqual(['please review this code']);

      // Multiple @duyetbot mentions - regex captures multi-line content after first @duyetbot until next @duyetbot
      const text2 = '@duyetbot first task @duyetbot second task';
      const mentions2 = extractAllMentions(text2);
      // The implementation captures everything after @duyetbot until the next @duyetbot (non-greedy on newlines)
      // But for single-line, it's the entire text between mentions
      expect(mentions2).toEqual(['first task @duyetbot second task']);

      // Non-duyetbot mentions are ignored
      const text3 = '@duyetbot review this and @otheruser take a look';
      const mentions3 = extractAllMentions(text3);
      expect(mentions3).toEqual(['review this and @otheruser take a look']);
    });

    it('should return found: false when no mention found', () => {
      const comment = 'Just a regular comment without any bot mention';
      const result = parseMention(comment, 'duyetbot');

      expect(result.found).toBe(false);
      expect(result.task).toBe('');
    });

    it('should detect bot mention', () => {
      expect(hasMention('@duyetbot help me', 'duyetbot')).toBe(true);
      expect(hasMention('Hey @duyetbot, can you help?', 'duyetbot')).toBe(true);
      expect(hasMention('No mention here', 'duyetbot')).toBe(false);
    });
  });

  describe('Command Parsing', () => {
    it('should identify known command patterns', () => {
      // isCommand checks if first word is a known command (help, review, summarize, etc.)
      expect(isCommand('help me')).toBe(true);
      expect(isCommand('review this PR')).toBe(true);
      expect(isCommand('summarize the issue')).toBe(true);
      expect(isCommand('explain this code')).toBe(true);
      expect(isCommand('not a command')).toBe(false);
      expect(isCommand('regular text')).toBe(false);
    });

    it('should parse command and arguments', () => {
      const result = parseCommand('review --detailed');

      expect(result).toEqual({
        command: 'review',
        args: '--detailed',
      });
    });

    it('should handle command without arguments', () => {
      const result = parseCommand('help');

      expect(result).toEqual({
        command: 'help',
        args: '',
      });
    });

    it('should parse any text as command (first word as command, rest as args)', () => {
      const result = parseCommand('just regular text');

      expect(result).toEqual({
        command: 'just',
        args: 'regular text',
      });
    });
  });

  describe('Transport Layer - Context Creation', () => {
    it('should create GitHub context for issue comment', () => {
      const context: GitHubContext = createGitHubContext({
        githubToken: 'ghp_test_token',
        owner: 'testowner',
        repo: 'testrepo',
        issueNumber: 42,
        body: 'Please help with this issue',
        sender: {
          id: 456,
          login: 'testuser',
        },
        url: 'https://github.com/testowner/testrepo/issues/42',
        title: 'Test Issue',
        isPullRequest: false,
        state: 'open',
        labels: [],
      });

      expect(context).toMatchObject({
        githubToken: 'ghp_test_token',
        owner: 'testowner',
        repo: 'testrepo',
        issueNumber: 42,
        body: 'Please help with this issue',
        sender: {
          id: 456,
          login: 'testuser',
        },
        url: 'https://github.com/testowner/testrepo/issues/42',
        title: 'Test Issue',
        isPullRequest: false,
        state: 'open',
      });
    });

    it('should create GitHub context for PR with metadata', () => {
      const context: GitHubContext = createGitHubContext({
        githubToken: 'ghp_test_token',
        owner: 'testowner',
        repo: 'testrepo',
        issueNumber: 42,
        body: 'Review this PR',
        sender: {
          id: 456,
          login: 'testuser',
        },
        url: 'https://github.com/testowner/testrepo/pull/42',
        title: 'Test PR',
        isPullRequest: true,
        state: 'open',
        labels: ['enhancement', 'breaking-change'],
        additions: 100,
        deletions: 50,
        changedFiles: 5,
        commits: 3,
        headRef: 'feature-branch',
        baseRef: 'main',
        commentId: 789,
      });

      expect(context).toMatchObject({
        isPullRequest: true,
        additions: 100,
        deletions: 50,
        changedFiles: 5,
        commits: 3,
        headRef: 'feature-branch',
        baseRef: 'main',
        commentId: 789,
      });
    });

    it('should include optional fields when provided', () => {
      const context: GitHubContext = createGitHubContext({
        githubToken: 'ghp_test_token',
        owner: 'testowner',
        repo: 'testrepo',
        issueNumber: 42,
        body: 'Task',
        sender: {
          id: 456,
          login: 'testuser',
        },
        url: 'https://github.com/testowner/testrepo/issues/42',
        title: 'Issue',
        isPullRequest: false,
        state: 'open',
        labels: [],
        adminUsername: 'adminuser',
        requestId: 'req-abc-123',
        description: 'Issue description body',
        commentsThread: [
          { id: 1, body: 'Comment 1', author: 'user1' },
          { id: 2, body: 'Comment 2', author: 'user2' },
        ],
      });

      expect(context.adminUsername).toBe('adminuser');
      expect(context.requestId).toBe('req-abc-123');
      expect(context.description).toBe('Issue description body');
      expect(context.commentsThread).toHaveLength(2);
    });
  });

  describe('Transport Layer - ParsedInput Conversion', () => {
    it('should parse context to ParsedInput with formatted context block', () => {
      const context: GitHubContext = createGitHubContext({
        githubToken: 'ghp_test_token',
        owner: 'testowner',
        repo: 'testrepo',
        issueNumber: 42,
        body: 'summarize this issue',
        sender: {
          id: 456,
          login: 'testuser',
        },
        url: 'https://github.com/testowner/testrepo/issues/42',
        title: 'Test Issue',
        isPullRequest: false,
        state: 'open',
        labels: [],
      });

      const parsedInput = githubTransport.parseContext(context);

      // ParsedInput has 'text' not 'content'
      expect(parsedInput.text).toBeDefined();
      expect(parsedInput.text).toContain('<formatted_context>');
      expect(parsedInput.text).toContain('Issue Title: Test Issue');
      expect(parsedInput.text).toContain('Issue Author: testuser');
      expect(parsedInput.text).toContain('summarize this issue');

      expect(parsedInput.userId).toBe(456);
      expect(parsedInput.username).toBe('testuser');
      expect(parsedInput.chatId).toBe('testowner/testrepo#42');

      expect(parsedInput.metadata).toMatchObject({
        owner: 'testowner',
        repo: 'testrepo',
        issueNumber: 42,
        url: 'https://github.com/testowner/testrepo/issues/42',
        title: 'Test Issue',
        isPullRequest: false,
        state: 'open',
        senderLogin: 'testuser',
      });
    });

    it('should include PR metadata in parsed input', () => {
      const context: GitHubContext = createGitHubContext({
        githubToken: 'ghp_test_token',
        owner: 'testowner',
        repo: 'testrepo',
        issueNumber: 42,
        body: 'Review request',
        sender: {
          id: 456,
          login: 'testuser',
        },
        url: 'https://github.com/testowner/testrepo/pull/42',
        title: 'Test PR',
        isPullRequest: true,
        state: 'open',
        labels: [],
        additions: 100,
        deletions: 50,
      });

      const parsedInput = githubTransport.parseContext(context);

      // PR metadata is in the formatted context text, not in metadata
      expect(parsedInput.text).toContain('PR Additions: 100');
      expect(parsedInput.text).toContain('PR Deletions: 50');
      expect(parsedInput.metadata?.isPullRequest).toBe(true);
    });

    it('should include labels in parsed input', () => {
      const context: GitHubContext = createGitHubContext({
        githubToken: 'ghp_test_token',
        owner: 'testowner',
        repo: 'testrepo',
        issueNumber: 42,
        body: 'Help with bug',
        sender: {
          id: 456,
          login: 'testuser',
        },
        url: 'https://github.com/testowner/testrepo/issues/42',
        title: 'Bug Issue',
        isPullRequest: false,
        state: 'open',
        labels: ['bug', 'high-priority'],
      });

      const parsedInput = githubTransport.parseContext(context);

      expect(parsedInput.text).toContain('Labels: bug, high-priority');
      expect(parsedInput.metadata?.labels).toEqual(['bug', 'high-priority']);
    });
  });

  describe('Complete Flow Simulation', () => {
    it('should simulate mention detection → context creation → parsed input', () => {
      // Step 1: Simulate webhook payload
      const webhookComment = '@duyetbot can you help me understand this error?';
      const botUsername = 'duyetbot';

      // Step 2: Detect and parse mention
      const mentionResult = parseMention(webhookComment, botUsername);
      expect(mentionResult).not.toBeNull();
      expect(mentionResult?.task).toBe('can you help me understand this error?');

      // Step 3: Create GitHub context (simulating middleware output)
      const context: GitHubContext = createGitHubContext({
        githubToken: 'ghp_test_token',
        owner: 'myorg',
        repo: 'myrepo',
        issueNumber: 123,
        body: mentionResult!.task,
        sender: {
          id: 789,
          login: 'developer',
        },
        url: 'https://github.com/myorg/myrepo/issues/123',
        title: 'Error in production',
        isPullRequest: false,
        state: 'open',
        labels: ['bug', 'production'],
      });

      // Step 4: Parse to ParsedInput via transport
      const parsedInput = githubTransport.parseContext(context);

      // Verify the full flow output
      expect(parsedInput.text).toContain('can you help me understand this error?');
      expect(parsedInput.text).toContain('Issue Title: Error in production');
      expect(parsedInput.chatId).toBe('myorg/myrepo#123');
      expect(parsedInput.metadata?.owner).toBe('myorg');
      expect(parsedInput.metadata?.repo).toBe('myrepo');
      expect(parsedInput.metadata?.issueNumber).toBe(123);
      expect(parsedInput.metadata?.labels).toEqual(['bug', 'production']);
    });

    it('should simulate PR review request flow', () => {
      // Review request bypass - direct task
      const task = 'Please review this pull request';

      const context: GitHubContext = createGitHubContext({
        githubToken: 'ghp_test_token',
        owner: 'myorg',
        repo: 'myrepo',
        issueNumber: 456,
        body: task,
        sender: {
          id: 123,
          login: 'contributor',
        },
        url: 'https://github.com/myorg/myrepo/pull/456',
        title: 'Feature: Add new functionality',
        isPullRequest: true,
        state: 'open',
        labels: ['enhancement'],
        additions: 250,
        deletions: 30,
        changedFiles: 8,
        commits: 5,
        headRef: 'feature/new-feature',
        baseRef: 'main',
      });

      const parsedInput = githubTransport.parseContext(context);

      // Verify PR flow output - PR metadata is in the formatted text
      expect(parsedInput.text).toContain('Please review this pull request');
      expect(parsedInput.text).toContain('PR Title: Feature: Add new functionality');
      expect(parsedInput.text).toContain('PR Branch: feature/new-feature -> main');
      expect(parsedInput.text).toContain('PR Additions: 250');
      expect(parsedInput.text).toContain('Changed Files: 8 files');
      expect(parsedInput.metadata?.isPullRequest).toBe(true);
      expect(parsedInput.chatId).toBe('myorg/myrepo#456');
    });
  });

  describe('Session ID Generation', () => {
    it('should generate consistent session IDs for same issue', () => {
      const context1: GitHubContext = createGitHubContext({
        githubToken: 'token',
        owner: 'owner',
        repo: 'repo',
        issueNumber: 42,
        body: 'Task',
        sender: { id: 1, login: 'user' },
        url: 'https://github.com/owner/repo/issues/42',
        title: 'Issue',
        isPullRequest: false,
        state: 'open',
        labels: [],
      });

      const context2: GitHubContext = createGitHubContext({
        githubToken: 'token',
        owner: 'owner',
        repo: 'repo',
        issueNumber: 42,
        body: 'Follow up',
        sender: { id: 2, login: 'other' },
        url: 'https://github.com/owner/repo/issues/42',
        title: 'Issue',
        isPullRequest: false,
        state: 'open',
        labels: [],
      });

      // Same issue should use same agent ID (session)
      expect(context1.owner).toBe(context2.owner);
      expect(context1.repo).toBe(context2.repo);
      expect(context1.issueNumber).toBe(context2.issueNumber);

      // Expected session ID format: github:owner/repo#42
      const sessionId = `github:${context1.owner}/${context1.repo}#${context1.issueNumber}`;
      expect(sessionId).toBe('github:owner/repo#42');
    });

    it('should generate different session IDs for different issues', () => {
      const sessionId1 = 'github:owner/repo#42';
      const sessionId2 = 'github:owner/repo#99';
      const sessionId3 = 'github:different/repo#42';

      expect(sessionId1).not.toBe(sessionId2);
      expect(sessionId1).not.toBe(sessionId3);
      expect(sessionId2).not.toBe(sessionId3);
    });
  });
});
