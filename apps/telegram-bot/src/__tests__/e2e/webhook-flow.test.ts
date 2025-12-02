/**
 * Webhook Flow E2E Tests
 *
 * Tests the main webhook flow through the test worker,
 * including message handling, command processing, and DO queueing.
 */

import { SELF } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createUpdate, resetFixtureCounters } from './helpers/fixtures';
import { resetMocks, setupMocks } from './helpers/mocks';

describe('Webhook Flow E2E', () => {
  beforeEach(() => {
    setupMocks();
    resetFixtureCounters();
  });

  afterEach(() => {
    resetMocks();
  });

  it('accepts valid message and returns OK', async () => {
    const update = createUpdate({ text: 'Hello bot', user: 'admin' });

    const response = await SELF.fetch('http://localhost/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    });

    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result).toHaveProperty('ok', true);
    expect(result).toHaveProperty('queued', true);
  });

  it('responds to /start command with welcome', async () => {
    const update = createUpdate({ text: '/start', user: 'admin' });

    const response = await SELF.fetch('http://localhost/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    });

    expect(response.status).toBe(200);
    const result = (await response.json()) as {
      ok: boolean;
      command: string;
      response: string;
    };
    expect(result.ok).toBe(true);
    expect(result.command).toBe('/start');
    expect(result.response).toContain('Welcome');
    expect(result.response).toContain('DuyetBot');
  });

  it('responds to /help command with help text', async () => {
    const update = createUpdate({ text: '/help', user: 'admin' });

    const response = await SELF.fetch('http://localhost/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    });

    expect(response.status).toBe(200);
    const result = (await response.json()) as {
      ok: boolean;
      command: string;
      response: string;
    };
    expect(result.ok).toBe(true);
    expect(result.command).toBe('/help');
    expect(result.response).toContain('Available commands');
    expect(result.response).toContain('/start');
    expect(result.response).toContain('/help');
    expect(result.response).toContain('/clear');
  });

  it('responds to /clear command with confirmation', async () => {
    const update = createUpdate({ text: '/clear', user: 'admin' });

    const response = await SELF.fetch('http://localhost/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    });

    expect(response.status).toBe(200);
    const result = (await response.json()) as {
      ok: boolean;
      command: string;
      response: string;
    };
    expect(result.ok).toBe(true);
    expect(result.command).toBe('/clear');
    expect(result.response).toContain('cleared');
  });

  it('queues message to Durable Object', async () => {
    const update = createUpdate({
      text: 'Test message for queue',
      user: 'admin',
    });

    // Send message through webhook
    const response = await SELF.fetch('http://localhost/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    });

    expect(response.status).toBe(200);
    const result = (await response.json()) as {
      ok: boolean;
      queued: boolean;
      queueLength: number;
      batchId: string;
    };

    // Verify the webhook response indicates successful queueing
    expect(result.ok).toBe(true);
    expect(result.queued).toBe(true);
    // queueLength should be at least 1 (may be higher with isolated storage)
    expect(result.queueLength).toBeGreaterThanOrEqual(1);
    // batchId should be present
    expect(result.batchId).toBeDefined();
    expect(result.batchId).toMatch(/^batch-\d+$/);
  });
});
