/**
 * Error Handling E2E Tests
 *
 * Tests error scenarios including invalid JSON, missing fields,
 * and API error handling.
 */

import { SELF } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createUpdate, resetFixtureCounters } from './helpers/fixtures';
import { resetMocks, setupMocks } from './helpers/mocks';

describe('Error Handling E2E', () => {
  beforeEach(() => {
    setupMocks();
    resetFixtureCounters();
  });

  afterEach(() => {
    resetMocks();
  });

  it('handles invalid JSON gracefully', async () => {
    // Send invalid JSON to webhook
    const response = await SELF.fetch('http://localhost/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ invalid json }',
    });

    // Should return OK and skip processing gracefully
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('OK');
  });

  it('handles missing message field', async () => {
    // Send update without message field
    const update = {
      update_id: 12345,
      // message field is missing
    };

    const response = await SELF.fetch('http://localhost/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    });

    // Should return OK and skip processing gracefully
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('OK');
  });

  it('handles Telegram API errors gracefully', async () => {
    // Configure mocks to simulate Telegram API failure
    resetMocks();
    setupMocks({ telegramFail: true });

    // Send a valid message
    const update = createUpdate({ text: 'Test message' });

    const response = await SELF.fetch('http://localhost/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    });

    // Worker should still return OK (webhook acknowledgment)
    // even if downstream Telegram API calls would fail
    // The test worker queues messages to DO, not directly to Telegram
    expect(response.status).toBe(200);
    const result = (await response.json()) as { ok: boolean };
    expect(result.ok).toBe(true);
  });
});
