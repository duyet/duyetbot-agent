/**
 * Telegram Bot Callback Query Integration Tests
 *
 * Tests callback query handling (inline keyboard button clicks).
 */

import { SELF } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resetFixtureCounters } from '../e2e/helpers/fixtures';
import { resetMocks, setupMocks } from '../e2e/helpers/mocks';

interface CallbackQueryUpdate {
  update_id: number;
  callback_query: {
    id: string;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      username: string;
    };
    message: {
      message_id: number;
      from: {
        id: number;
        is_bot: boolean;
        first_name: string;
        username: string;
      };
      chat: {
        id: number;
        type: string;
      };
      date: number;
      text: string;
    };
    chat_instance: string;
    data: string;
  };
}

function createCallbackQuery(
  data: string,
  user = 'admin',
  messageId = 100
): CallbackQueryUpdate {
  const users = {
    admin: { id: 12345, is_bot: false, first_name: 'Duyet', username: 'duyet' },
    authorized: { id: 67890, is_bot: false, first_name: 'TestUser', username: 'testuser' },
    unauthorized: { id: 99999, is_bot: false, first_name: 'Stranger', username: 'stranger' },
  };

  const selectedUser = users[user as keyof typeof users];

  return {
    update_id: 2000,
    callback_query: {
      id: `callback_${messageId}`,
      from: selectedUser,
      message: {
        message_id: messageId,
        from: { ...selectedUser },
        chat: { id: 12345, type: 'private' },
        date: Math.floor(Date.now() / 1000),
        text: 'Original message with inline keyboard',
      },
      chat_instance: 'chat_instance_123',
      data,
    },
  };
}

describe('Telegram Bot - Callback Query Integration', () => {
  beforeEach(() => {
    setupMocks();
    resetFixtureCounters();
  });

  afterEach(() => {
    resetMocks();
  });

  describe('Callback Query Handling', () => {
    it('accepts valid callback query', async () => {
      const update = createCallbackQuery('button_clicked');

      const response = await SELF.fetch('http://localhost/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });

      expect(response.status).toBe(200);
    });

    it('handles callback query with complex data', async () => {
      const update = createCallbackQuery('action:param1:param2:value');

      const response = await SELF.fetch('http://localhost/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });

      expect(response.status).toBe(200);
    });

    it('handles JSON-encoded callback data', async () => {
      const data = JSON.stringify({ action: 'select', value: 'option1' });
      const update = createCallbackQuery(data);

      const response = await SELF.fetch('http://localhost/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });

      expect(response.status).toBe(200);
    });
  });

  describe('Callback Query Error Scenarios', () => {
    it('handles callback query from unauthorized user', async () => {
      const update = createCallbackQuery('button_click', 'unauthorized');

      const response = await SELF.fetch('http://localhost/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });

      // Should still return OK
      expect(response.status).toBe(200);
    });

    it('handles callback query with missing data field', async () => {
      const update = createCallbackQuery('test');
      delete (update.callback_query as any).data;

      const response = await SELF.fetch('http://localhost/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });

      expect(response.status).toBe(200);
    });

    it('handles callback query with empty data', async () => {
      const update = createCallbackQuery('');

      const response = await SELF.fetch('http://localhost/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });

      expect(response.status).toBe(200);
    });

    it('handles callback query from group chat', async () => {
      const update = createCallbackQuery('group_button');
      (update.callback_query.message as any).chat = {
        id: -100123456789,
        type: 'supergroup',
        title: 'Test Group',
      };

      const response = await SELF.fetch('http://localhost/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });

      expect(response.status).toBe(200);
    });
  });

  describe('Callback Query Dispatch', () => {
    it('dispatches callback to correct agent instance', async () => {
      const update = createCallbackQuery('test_action', 'admin');

      const response = await SELF.fetch('http://localhost/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });

      expect(response.status).toBe(200);
    });

    it('handles concurrent callback queries', async () => {
      const updates = [
        createCallbackQuery('action1', 'admin', 101),
        createCallbackQuery('action2', 'admin', 102),
        createCallbackQuery('action3', 'admin', 103),
      ];

      const responses = await Promise.all(
        updates.map((update) =>
          SELF.fetch('http://localhost/webhook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(update),
          })
        )
      );

      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });
    });
  });
});
