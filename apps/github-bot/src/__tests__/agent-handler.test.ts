/**
 * Agent Handler Tests
 */

import { describe, expect, it } from 'vitest';
import { buildSystemPrompt } from '../agent-handler.js';
import type { MentionContext } from '../types.js';

describe('buildSystemPrompt', () => {
  const baseContext: MentionContext = {
    task: 'review the changes',
    repository: {
      owner: { login: 'duyet' },
      name: 'duyetbot-agent',
      full_name: 'duyet/duyetbot-agent',
    },
    comment: {
      id: 1,
      body: '@duyetbot review the changes',
      user: { id: 1, login: 'duyet' },
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
    mentionedBy: { id: 1, login: 'duyet' },
  };

  it('should build prompt with repository context', () => {
    const prompt = buildSystemPrompt(baseContext);
    expect(prompt).toContain('duyet/duyetbot-agent');
    expect(prompt).toContain('@duyetbot');
  });

  it('should include task from mention', () => {
    const prompt = buildSystemPrompt(baseContext);
    expect(prompt).toContain('review the changes');
    expect(prompt).toContain('@duyet');
  });

  it('should include issue context when present', () => {
    const contextWithIssue: MentionContext = {
      ...baseContext,
      issue: {
        number: 123,
        title: 'Test issue',
        body: 'Issue description',
        state: 'open',
        user: { id: 1, login: 'duyet' },
        labels: [{ name: 'bug' }],
      },
    };

    const prompt = buildSystemPrompt(contextWithIssue);
    expect(prompt).toContain('Issue #123');
    expect(prompt).toContain('Test issue');
    expect(prompt).toContain('bug');
  });

  it('should include PR context when present', () => {
    const contextWithPR: MentionContext = {
      ...baseContext,
      pullRequest: {
        number: 456,
        title: 'Test PR',
        body: 'PR description',
        state: 'open',
        user: { id: 1, login: 'duyet' },
        head: { ref: 'feature', sha: 'abc123' },
        base: { ref: 'main', sha: 'def456' },
        changed_files: 5,
        additions: 100,
        deletions: 50,
      },
    };

    const prompt = buildSystemPrompt(contextWithPR);
    expect(prompt).toContain('Pull Request #456');
    expect(prompt).toContain('Test PR');
    expect(prompt).toContain('+100');
    expect(prompt).toContain('-50');
    expect(prompt).toContain('feature');
    expect(prompt).toContain('main');
  });

  it('should include guidelines', () => {
    const prompt = buildSystemPrompt(baseContext);
    expect(prompt).toContain('Guidelines');
    expect(prompt).toContain('GitHub-flavored Markdown');
  });
});
