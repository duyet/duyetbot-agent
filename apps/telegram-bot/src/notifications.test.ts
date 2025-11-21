/**
 * Notification System Tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationManager, createGitHubNotification } from './notifications.js';

// Mock Telegraf
const mockSendMessage = vi.fn().mockResolvedValue({});
const mockBot = {
  telegram: {
    sendMessage: mockSendMessage,
  },
} as any;

describe('NotificationManager', () => {
  let manager: NotificationManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new NotificationManager(mockBot);
  });

  describe('subscribe', () => {
    it('should add subscription', () => {
      manager.subscribe(123, 456, ['pr_merged', 'ci_failed']);

      const sub = manager.getSubscription(123);
      expect(sub).toBeDefined();
      expect(sub?.userId).toBe(123);
      expect(sub?.chatId).toBe(456);
      expect(sub?.notifications).toContain('pr_merged');
    });

    it('should include repository filter', () => {
      manager.subscribe(123, 456, ['pr_merged'], ['owner/repo']);

      const sub = manager.getSubscription(123);
      expect(sub?.repositories).toContain('owner/repo');
    });
  });

  describe('unsubscribe', () => {
    it('should remove subscription', () => {
      manager.subscribe(123, 456, ['pr_merged']);
      manager.unsubscribe(123);

      expect(manager.getSubscription(123)).toBeUndefined();
    });
  });

  describe('updateSubscription', () => {
    it('should update existing subscription', () => {
      manager.subscribe(123, 456, ['pr_merged']);
      manager.updateSubscription(123, { enabled: false });

      const sub = manager.getSubscription(123);
      expect(sub?.enabled).toBe(false);
    });
  });

  describe('notify', () => {
    it('should send notification to subscribed user', async () => {
      manager.subscribe(123, 456, ['pr_merged']);

      const result = await manager.notify(123, {
        type: 'pr_merged',
        title: 'PR Merged',
        body: 'Test PR',
        url: 'https://github.com/test',
      });

      expect(result).toBe(true);
      expect(mockSendMessage).toHaveBeenCalledWith(
        456,
        expect.stringContaining('PR Merged'),
        expect.any(Object)
      );
    });

    it('should not send if not subscribed to type', async () => {
      manager.subscribe(123, 456, ['ci_failed']);

      const result = await manager.notify(123, {
        type: 'pr_merged',
        title: 'PR Merged',
        body: 'Test',
      });

      expect(result).toBe(false);
      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it('should not send if disabled', async () => {
      manager.subscribe(123, 456, ['pr_merged']);
      manager.updateSubscription(123, { enabled: false });

      const result = await manager.notify(123, {
        type: 'pr_merged',
        title: 'Test',
        body: 'Test',
      });

      expect(result).toBe(false);
    });

    it('should filter by repository', async () => {
      manager.subscribe(123, 456, ['pr_merged'], ['owner/repo1']);

      const result = await manager.notify(123, {
        type: 'pr_merged',
        title: 'Test',
        body: 'Test',
        repository: 'owner/repo2',
      });

      expect(result).toBe(false);
    });
  });

  describe('broadcast', () => {
    it('should send to all subscribed users', async () => {
      manager.subscribe(111, 111, ['pr_merged']);
      manager.subscribe(222, 222, ['pr_merged']);
      manager.subscribe(333, 333, ['ci_failed']); // Not subscribed

      const sent = await manager.broadcast({
        type: 'pr_merged',
        title: 'Test',
        body: 'Test',
      });

      expect(sent).toBe(2);
      expect(mockSendMessage).toHaveBeenCalledTimes(2);
    });

    it('should apply filter function', async () => {
      manager.subscribe(111, 111, ['pr_merged']);
      manager.subscribe(222, 222, ['pr_merged']);

      const sent = await manager.broadcast(
        { type: 'pr_merged', title: 'Test', body: 'Test' },
        (sub) => sub.userId === 111
      );

      expect(sent).toBe(1);
    });
  });

  describe('getAllSubscriptions', () => {
    it('should return all subscriptions', () => {
      manager.subscribe(111, 111, ['pr_merged']);
      manager.subscribe(222, 222, ['ci_failed']);

      const subs = manager.getAllSubscriptions();
      expect(subs).toHaveLength(2);
    });
  });
});

describe('createGitHubNotification', () => {
  describe('pull_request events', () => {
    it('should create pr_merged notification', () => {
      const notification = createGitHubNotification('pull_request', {
        action: 'closed',
        pull_request: {
          number: 123,
          title: 'Test PR',
          merged: true,
          html_url: 'https://github.com/test/pr/123',
        },
        repository: {
          full_name: 'owner/repo',
        },
      });

      expect(notification).not.toBeNull();
      expect(notification?.type).toBe('pr_merged');
      expect(notification?.title).toBe('PR Merged');
    });

    it('should create pr_review_requested notification', () => {
      const notification = createGitHubNotification('pull_request', {
        action: 'review_requested',
        pull_request: {
          number: 123,
          title: 'Test PR',
          html_url: 'https://github.com/test/pr/123',
        },
        repository: {
          full_name: 'owner/repo',
        },
      });

      expect(notification?.type).toBe('pr_review_requested');
    });

    it('should return null for unhandled action', () => {
      const notification = createGitHubNotification('pull_request', {
        action: 'opened',
        pull_request: {},
        repository: {},
      });

      expect(notification).toBeNull();
    });
  });

  describe('issues events', () => {
    it('should create issue_assigned notification', () => {
      const notification = createGitHubNotification('issues', {
        action: 'assigned',
        issue: {
          number: 456,
          title: 'Test Issue',
          html_url: 'https://github.com/test/issues/456',
        },
        repository: {
          full_name: 'owner/repo',
        },
      });

      expect(notification?.type).toBe('issue_assigned');
    });
  });

  describe('check_run events', () => {
    it('should create ci_passed notification', () => {
      const notification = createGitHubNotification('check_run', {
        check_run: {
          name: 'tests',
          status: 'completed',
          conclusion: 'success',
          html_url: 'https://github.com/test/runs/1',
        },
        repository: {
          full_name: 'owner/repo',
        },
      });

      expect(notification?.type).toBe('ci_passed');
    });

    it('should create ci_failed notification', () => {
      const notification = createGitHubNotification('check_run', {
        check_run: {
          name: 'tests',
          status: 'completed',
          conclusion: 'failure',
          html_url: 'https://github.com/test/runs/1',
        },
        repository: {
          full_name: 'owner/repo',
        },
      });

      expect(notification?.type).toBe('ci_failed');
    });
  });

  describe('deployment_status events', () => {
    it('should create deployment_completed notification', () => {
      const notification = createGitHubNotification('deployment_status', {
        deployment_status: {
          state: 'success',
          environment: 'production',
          target_url: 'https://example.com',
        },
        repository: {
          full_name: 'owner/repo',
        },
      });

      expect(notification?.type).toBe('deployment_completed');
    });
  });
});
