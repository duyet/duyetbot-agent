/**
 * Auto-labeling tests
 *
 * Tests for rule-based issue and PR labeling functionality.
 */

import { describe, expect, it } from 'vitest';
import { suggestLabels } from '../auto-label.js';

describe('suggestLabels', () => {
  describe('Bug detection', () => {
    it('should label bug issues', () => {
      const labels = suggestLabels('Fix login bug', 'The login is broken and users cannot sign in');
      expect(labels).toContain('bug');
    });

    it('should detect crash reports', () => {
      const labels = suggestLabels('App crashes on startup');
      expect(labels).toContain('bug');
    });

    it('should match fix: title pattern', () => {
      const labels = suggestLabels('fix: handle null pointer');
      expect(labels).toContain('bug');
    });

    it('should match bug: title pattern', () => {
      const labels = suggestLabels('bug: memory leak in worker');
      expect(labels).toContain('bug');
    });
  });

  describe('Enhancement detection', () => {
    it('should label feature requests', () => {
      const labels = suggestLabels('Add dark mode support');
      expect(labels).toContain('enhancement');
    });

    it('should detect improvements', () => {
      const labels = suggestLabels('Improve error messages');
      expect(labels).toContain('enhancement');
    });

    it('should match feat: title pattern', () => {
      const labels = suggestLabels('feat: implement OAuth flow');
      expect(labels).toContain('enhancement');
    });

    it('should match add: title pattern', () => {
      const labels = suggestLabels('Add user profile page');
      expect(labels).toContain('enhancement');
    });
  });

  describe('Documentation detection', () => {
    it('should label documentation issues', () => {
      const labels = suggestLabels('Update README with new examples');
      expect(labels).toContain('documentation');
    });

    it('should detect doc: pattern', () => {
      const labels = suggestLabels('docs: add API reference');
      expect(labels).toContain('documentation');
    });
  });

  describe('Question detection', () => {
    it('should label questions', () => {
      const labels = suggestLabels('How do I configure the bot?');
      expect(labels).toContain('question');
    });

    it('should detect confusion', () => {
      const labels = suggestLabels('Confused about auth flow');
      expect(labels).toContain('question');
    });
  });

  describe('Priority detection', () => {
    it('should label high priority issues', () => {
      const labels = suggestLabels('[URGENT] Database connection failing');
      expect(labels).toContain('priority: high');
    });

    it('should label critical issues', () => {
      const labels = suggestLabels('Critical security vulnerability');
      expect(labels).toContain('priority: high');
    });

    it('should label low priority issues', () => {
      const labels = suggestLabels('Minor typo in footer', 'Nice to have fix for later');
      expect(labels).toContain('priority: low');
    });
  });

  describe('Security detection', () => {
    it('should label security issues', () => {
      const labels = suggestLabels('XSS vulnerability in user input');
      expect(labels).toContain('security');
    });

    it('should detect authentication issues', () => {
      const labels = suggestLabels('SQL injection in search query');
      expect(labels).toContain('security');
    });
  });

  describe('Performance detection', () => {
    it('should label performance issues', () => {
      const labels = suggestLabels(
        'Slow page load times',
        'The dashboard takes 10 seconds to load'
      );
      expect(labels).toContain('performance');
    });

    it('should detect optimization requests', () => {
      const labels = suggestLabels('Optimize database queries');
      expect(labels).toContain('performance');
    });
  });

  describe('Tests detection', () => {
    it('should label test-related issues', () => {
      const labels = suggestLabels('Add unit tests for auth module');
      expect(labels).toContain('tests');
    });

    it('should detect coverage issues', () => {
      const labels = suggestLabels('Increase test coverage to 80%');
      expect(labels).toContain('tests');
    });
  });

  describe('TypeScript detection', () => {
    it('should label TypeScript issues', () => {
      const labels = suggestLabels('Fix generic type constraints');
      expect(labels).toContain('typescript');
    });

    it('should detect type definition issues', () => {
      const labels = suggestLabels('Missing type definition for API response');
      expect(labels).toContain('typescript');
    });
  });

  describe('Infrastructure detection', () => {
    it('should label CI/CD issues', () => {
      const labels = suggestLabels('Fix GitHub Actions workflow');
      expect(labels).toContain('infrastructure');
    });

    it('should detect deployment issues', () => {
      const labels = suggestLabels('Deploy fails on production');
      expect(labels).toContain('infrastructure');
    });
  });

  describe('Dependencies detection', () => {
    it('should label dependency issues', () => {
      const labels = suggestLabels('Upgrade React to version 19');
      expect(labels).toContain('dependencies');
    });
  });

  describe('Good first issue detection', () => {
    it('should label simple fix issues', () => {
      const labels = suggestLabels('Fix typo in header', 'The word "recieve" is misspelled');
      expect(labels).toContain('good first issue');
    });

    it('should detect beginner-friendly markers', () => {
      const labels = suggestLabels('Add missing semicolon', 'good first issue - simple fix');
      expect(labels).toContain('good first issue');
    });

    it('should label documentation as good first issue', () => {
      const labels = suggestLabels('Update documentation', 'Fix typo in README');
      expect(labels).toContain('good first issue');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty body', () => {
      const labels = suggestLabels('Something is broken');
      expect(labels.length).toBeGreaterThan(0);
    });

    it('should handle issues that match multiple patterns', () => {
      const labels = suggestLabels(
        'Fix: slow performance causes bug',
        'The app is slow and has errors'
      );
      expect(labels).toContain('bug');
      expect(labels).toContain('performance');
    });

    it('should handle issue with both bug and performance keywords', () => {
      const labels = suggestLabels(
        'Memory leak causes slow performance',
        'The app is slow and crashes'
      );
      expect(labels).toContain('bug');
      expect(labels).toContain('performance');
    });

    it('should only apply one priority label', () => {
      const labels = suggestLabels(
        'Critical and urgent issue',
        'This is both high priority and urgent'
      );
      const priorityLabels = labels.filter((l) => l.startsWith('priority:'));
      expect(priorityLabels.length).toBe(1);
    });

    it('should handle case insensitivity', () => {
      const labels1 = suggestLabels('BUG: broken feature');
      const labels2 = suggestLabels('bug: broken feature');
      const labels3 = suggestLabels('Bug: broken feature');
      expect(labels1).toEqual(labels2);
      expect(labels2).toEqual(labels3);
    });
  });
});
