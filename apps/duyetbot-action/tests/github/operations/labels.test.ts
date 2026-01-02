/**
 * Label Operations Tests
 *
 * Tests for issue/PR label operations
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addLabels,
  hasLabel,
  listLabels,
  removeLabel,
  setLabels,
} from '../../../src/github/operations/labels.js';

// Mock Octokit
const mockOctokit = {
  rest: {
    issues: {
      addLabels: vi.fn(),
      removeLabel: vi.fn(),
      setLabels: vi.fn(),
      listLabelsOnIssue: vi.fn(),
    },
  },
} as any;

describe('labels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('addLabels', () => {
    it('should add labels successfully', async () => {
      mockOctokit.rest.issues.addLabels.mockResolvedValue({
        data: [
          { name: 'bug', color: 'd73a4a' },
          { name: 'enhancement', color: 'a2eeef' },
        ],
      });

      await addLabels(mockOctokit, 'owner', 'repo', 1, ['bug', 'enhancement']);

      expect(mockOctokit.rest.issues.addLabels).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        issue_number: 1,
        labels: ['bug', 'enhancement'],
      });
    });

    it('should handle single label', async () => {
      mockOctokit.rest.issues.addLabels.mockResolvedValue({
        data: [{ name: 'bug', color: 'd73a4a' }],
      });

      await addLabels(mockOctokit, 'owner', 'repo', 1, ['bug']);

      expect(mockOctokit.rest.issues.addLabels).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        issue_number: 1,
        labels: ['bug'],
      });
    });

    it('should handle API errors', async () => {
      mockOctokit.rest.issues.addLabels.mockRejectedValue(new Error('Label not found'));

      await expect(addLabels(mockOctokit, 'owner', 'repo', 1, ['nonexistent'])).rejects.toThrow(
        'Label not found'
      );
    });
  });

  describe('removeLabel', () => {
    it('should remove label successfully', async () => {
      mockOctokit.rest.issues.removeLabel.mockResolvedValue({});

      await removeLabel(mockOctokit, 'owner', 'repo', 1, 'bug');

      expect(mockOctokit.rest.issues.removeLabel).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        issue_number: 1,
        name: 'bug',
      });
    });

    it('should handle API errors', async () => {
      mockOctokit.rest.issues.removeLabel.mockRejectedValue(new Error('Label not found'));

      await expect(removeLabel(mockOctokit, 'owner', 'repo', 1, 'nonexistent')).rejects.toThrow(
        'Label not found'
      );
    });
  });

  describe('setLabels', () => {
    it('should replace all labels successfully', async () => {
      mockOctokit.rest.issues.setLabels.mockResolvedValue({
        data: [
          { name: 'bug', color: 'd73a4a' },
          { name: 'priority:high', color: 'ff0000' },
        ],
      });

      await setLabels(mockOctokit, 'owner', 'repo', 1, ['bug', 'priority:high']);

      expect(mockOctokit.rest.issues.setLabels).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        issue_number: 1,
        labels: ['bug', 'priority:high'],
      });
    });

    it('should clear all labels with empty array', async () => {
      mockOctokit.rest.issues.setLabels.mockResolvedValue({
        data: [],
      });

      await setLabels(mockOctokit, 'owner', 'repo', 1, []);

      expect(mockOctokit.rest.issues.setLabels).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        issue_number: 1,
        labels: [],
      });
    });

    it('should handle API errors', async () => {
      mockOctokit.rest.issues.setLabels.mockRejectedValue(new Error('Issue not found'));

      await expect(setLabels(mockOctokit, 'owner', 'repo', 999, ['bug'])).rejects.toThrow(
        'Issue not found'
      );
    });
  });

  describe('listLabels', () => {
    it('should list labels successfully', async () => {
      mockOctokit.rest.issues.listLabelsOnIssue.mockResolvedValue({
        data: [
          {
            name: 'bug',
            color: 'd73a4a',
            description: 'Something is broken',
          },
          {
            name: 'enhancement',
            color: 'a2eeef',
            description: 'New feature',
          },
          {
            name: 'documentation',
            color: '0075ca',
            description: null,
          },
        ],
      });

      const result = await listLabels(mockOctokit, 'owner', 'repo', 1);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        name: 'bug',
        color: 'd73a4a',
        description: 'Something is broken',
      });
      expect(result[2].description).toBe('');
    });

    it('should handle empty label list', async () => {
      mockOctokit.rest.issues.listLabelsOnIssue.mockResolvedValue({
        data: [],
      });

      const result = await listLabels(mockOctokit, 'owner', 'repo', 1);

      expect(result).toEqual([]);
    });

    it('should handle pagination', async () => {
      mockOctokit.rest.issues.listLabelsOnIssue.mockResolvedValue({
        data: [{ name: 'bug', color: 'd73a4a', description: 'Bug' }],
      });

      const result = await listLabels(mockOctokit, 'owner', 'repo', 1);

      expect(result).toHaveLength(1);
    });
  });

  describe('hasLabel', () => {
    it('should return true when label exists (case-insensitive)', async () => {
      mockOctokit.rest.issues.listLabelsOnIssue.mockResolvedValue({
        data: [
          { name: 'Bug', color: 'd73a4a', description: 'Bug' },
          { name: 'enhancement', color: 'a2eeef', description: 'Enhancement' },
        ],
      });

      const result1 = await hasLabel(mockOctokit, 'owner', 'repo', 1, 'bug');
      const result2 = await hasLabel(mockOctokit, 'owner', 'repo', 1, 'BUG');
      const result3 = await hasLabel(mockOctokit, 'owner', 'repo', 1, 'enhancement');

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(result3).toBe(true);
    });

    it('should return false when label does not exist', async () => {
      mockOctokit.rest.issues.listLabelsOnIssue.mockResolvedValue({
        data: [{ name: 'bug', color: 'd73a4a', description: 'Bug' }],
      });

      const result = await hasLabel(mockOctokit, 'owner', 'repo', 1, 'enhancement');

      expect(result).toBe(false);
    });

    it('should return false for empty label list', async () => {
      mockOctokit.rest.issues.listLabelsOnIssue.mockResolvedValue({
        data: [],
      });

      const result = await hasLabel(mockOctokit, 'owner', 'repo', 1, 'bug');

      expect(result).toBe(false);
    });

    it('should handle API errors', async () => {
      mockOctokit.rest.issues.listLabelsOnIssue.mockRejectedValue(new Error('Issue not found'));

      await expect(hasLabel(mockOctokit, 'owner', 'repo', 999, 'bug')).rejects.toThrow(
        'Issue not found'
      );
    });
  });
});
