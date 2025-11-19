/**
 * Tests for GitHub Comment Parser
 */

import {
  extractCodeBlocks,
  extractIssueReferences,
  extractMentions,
  formatGitHubComment,
  parseIssueComment,
  parsePullRequestComment,
} from '@/github/parser';
import type {
  IssueCommentPayload,
  PullRequestReviewCommentPayload,
} from '@/github/webhook-handler';
import { describe, expect, it } from 'vitest';

describe('GitHub Parser', () => {
  describe('parseIssueComment', () => {
    it('should parse issue comment payload', () => {
      const payload: IssueCommentPayload = {
        action: 'created',
        issue: {
          number: 42,
          title: 'Bug in login feature',
          body: 'Users cannot log in with OAuth',
          html_url: 'https://github.com/user/repo/issues/42',
          user: { login: 'testuser' },
        },
        comment: {
          id: 123,
          body: '@duyetbot please investigate this issue',
          html_url: 'https://github.com/user/repo/issues/42#issuecomment-123',
          user: { login: 'testuser' },
        },
        sender: { login: 'testuser', html_url: 'https://github.com/testuser' },
        repository: {
          full_name: 'user/repo',
          html_url: 'https://github.com/user/repo',
        },
      };

      const parsed = parseIssueComment(payload);

      expect(parsed.repository).toBe('user/repo');
      expect(parsed.repositoryUrl).toBe('https://github.com/user/repo');
      expect(parsed.issueNumber).toBe(42);
      expect(parsed.prNumber).toBeUndefined();
      expect(parsed.command).toBe('please investigate this issue');
      expect(parsed.fullText).toBe('@duyetbot please investigate this issue');
      expect(parsed.author).toBe('testuser');
      expect(parsed.context.type).toBe('issue');
      expect(parsed.context.title).toBe('Bug in login feature');
      expect(parsed.context.body).toBe('Users cannot log in with OAuth');
    });

    it('should handle issue without body', () => {
      const payload: IssueCommentPayload = {
        action: 'created',
        issue: {
          number: 1,
          title: 'Test issue',
          body: null,
          html_url: 'https://github.com/user/repo/issues/1',
          user: { login: 'testuser' },
        },
        comment: {
          id: 123,
          body: '@duyetbot test',
          html_url: 'https://github.com/user/repo/issues/1#issuecomment-1',
          user: { login: 'user' },
        },
        sender: { login: 'testuser', html_url: 'https://github.com/testuser' },
        repository: {
          full_name: 'user/repo',
          html_url: 'https://github.com/user/repo',
        },
      };

      const parsed = parseIssueComment(payload);
      expect(parsed.context.body).toBeNull();
    });
  });

  describe('parsePullRequestComment', () => {
    it('should parse PR comment payload', () => {
      const payload: PullRequestReviewCommentPayload = {
        action: 'created',
        pull_request: {
          number: 123,
          title: 'Add new feature',
          body: 'This PR adds a new feature',
          html_url: 'https://github.com/user/repo/pull/123',
          user: { login: 'testuser' },
        },
        comment: {
          id: 123,
          body: '@duyetbot review this code',
          html_url: 'https://github.com/user/repo/pull/123#discussion_r456',
          user: {
            login: 'reviewer',
          },
        },
        sender: { login: 'testuser', html_url: 'https://github.com/testuser' },
        repository: {
          full_name: 'user/repo',
          html_url: 'https://github.com/user/repo',
        },
      };

      const parsed = parsePullRequestComment(payload);

      expect(parsed.repository).toBe('user/repo');
      expect(parsed.repositoryUrl).toBe('https://github.com/user/repo');
      expect(parsed.prNumber).toBe(123);
      expect(parsed.issueNumber).toBeUndefined();
      expect(parsed.command).toBe('review this code');
      expect(parsed.fullText).toBe('@duyetbot review this code');
      expect(parsed.author).toBe('reviewer');
      expect(parsed.context.type).toBe('pull_request');
      expect(parsed.context.title).toBe('Add new feature');
      expect(parsed.context.body).toBe('This PR adds a new feature');
    });
  });

  describe('formatGitHubComment', () => {
    it('should format basic comment', () => {
      const formatted = formatGitHubComment('Here is my response');

      expect(formatted).toContain('Here is my response');
      expect(formatted).toContain('_— [@duyetbot](https://github.com/apps/duyetbot)_');
    });

    it('should include metadata', () => {
      const metadata = {
        model: 'claude-3-5-sonnet-20241022',
        duration: 1234,
      };

      const formatted = formatGitHubComment('Response text', metadata);

      expect(formatted).toContain('Response text');
      expect(formatted).toContain('claude-3-5-sonnet-20241022');
      expect(formatted).toContain('1234');
    });

    it('should handle empty response', () => {
      const formatted = formatGitHubComment('');
      expect(formatted).toContain('_— [@duyetbot](https://github.com/apps/duyetbot)_');
    });

    it('should preserve markdown formatting', () => {
      const response = `
# Heading
- Item 1
- Item 2

**Bold text**
      `;

      const formatted = formatGitHubComment(response);
      expect(formatted).toContain('# Heading');
      expect(formatted).toContain('**Bold text**');
    });
  });

  describe('extractCodeBlocks', () => {
    it('should extract code blocks with language', () => {
      const text = `
Some text
\`\`\`javascript
const x = 1;
\`\`\`
More text
\`\`\`python
print("hello")
\`\`\`
      `;

      const blocks = extractCodeBlocks(text);

      expect(blocks).toHaveLength(2);
      expect(blocks[0]!.language).toBe('javascript');
      expect(blocks[0]!.code).toContain('const x = 1;');
      expect(blocks[1]!.language).toBe('python');
      expect(blocks[1]!.code).toContain('print("hello")');
    });

    it('should extract code blocks without language', () => {
      const text = `
\`\`\`
plain code
\`\`\`
      `;

      const blocks = extractCodeBlocks(text);

      expect(blocks).toHaveLength(1);
      expect(blocks[0]!.language).toBe('text');
      expect(blocks[0]!.code).toContain('plain code');
    });

    it('should handle no code blocks', () => {
      const text = 'Just plain text without code';
      const blocks = extractCodeBlocks(text);

      expect(blocks).toHaveLength(0);
    });

    it('should handle multiple code blocks of same language', () => {
      const text = `
\`\`\`js
code 1
\`\`\`

\`\`\`js
code 2
\`\`\`
      `;

      const blocks = extractCodeBlocks(text);

      expect(blocks).toHaveLength(2);
      expect(blocks[0]!.language).toBe('js');
      expect(blocks[1]!.language).toBe('js');
    });
  });

  describe('extractMentions', () => {
    it('should extract user mentions', () => {
      const text = 'Hey @user1 and @user2, can you review?';
      const mentions = extractMentions(text);

      expect(mentions).toHaveLength(2);
      expect(mentions).toContain('user1');
      expect(mentions).toContain('user2');
    });

    it('should exclude @duyetbot', () => {
      const text = '@duyetbot @user1 @duyetbot @user2';
      const mentions = extractMentions(text);

      expect(mentions).toHaveLength(2);
      expect(mentions).toContain('user1');
      expect(mentions).toContain('user2');
      expect(mentions).not.toContain('duyetbot');
    });

    it('should exclude @Duyetbot (case insensitive)', () => {
      const text = '@Duyetbot @DUYETBOT @user1';
      const mentions = extractMentions(text);

      expect(mentions).toHaveLength(1);
      expect(mentions).toContain('user1');
    });

    it('should handle no mentions', () => {
      const text = 'No mentions here';
      const mentions = extractMentions(text);

      expect(mentions).toHaveLength(0);
    });

    it('should handle duplicate mentions', () => {
      const text = '@user1 @user2 @user1 @user2';
      const mentions = extractMentions(text);

      // Should include duplicates as returned
      expect(mentions.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle mentions in code blocks', () => {
      const text = `
@user1 check this:
\`\`\`
@user2 in code
\`\`\`
      `;
      const mentions = extractMentions(text);

      expect(mentions).toContain('user1');
      expect(mentions).toContain('user2'); // Regex will catch it in code block too
    });
  });

  describe('extractIssueReferences', () => {
    it('should extract issue references', () => {
      const text = 'Fixes #42 and resolves user/repo#123';
      const refs = extractIssueReferences(text);

      expect(refs).toHaveLength(2);

      expect(refs[0]!.repository).toBeUndefined();
      expect(refs[0]!.issue).toBe(42);

      expect(refs[1]!.repository).toBe('user/repo');
      expect(refs[1]!.issue).toBe(123);
    });

    it('should extract number-only references', () => {
      // Current implementation doesn't handle full URLs, only #number patterns
      const text = 'See #456 in the repo';
      const refs = extractIssueReferences(text);

      expect(refs).toHaveLength(1);
      expect(refs[0]!.issue).toBe(456);
    });

    it('should handle mixed reference styles', () => {
      const text = `
Related to #10
Closes owner/repo#20
      `;
      const refs = extractIssueReferences(text);

      expect(refs).toHaveLength(2);
      expect(refs[0]!.issue).toBe(10);
      expect(refs[1]!.issue).toBe(20);
    });

    it('should handle no references', () => {
      const text = 'No issue references here';
      const refs = extractIssueReferences(text);

      expect(refs).toHaveLength(0);
    });

    it('should extract PR references (same as issues)', () => {
      const text = 'Related to PR #100 and user/repo#200';
      const refs = extractIssueReferences(text);

      expect(refs).toHaveLength(2);
      expect(refs[0]!.issue).toBe(100);
      expect(refs[1]!.issue).toBe(200);
    });
  });
});
