/**
 * Performance E2E Tests
 *
 * Tests basic performance assertions for webhook handling.
 * Verifies fast webhook acknowledgment and concurrent request handling.
 *
 * Note: Uses command-based messages to avoid DO storage operations
 * which can cause isolated storage frame tracking issues.
 * See: https://developers.cloudflare.com/workers/testing/vitest-integration/known-issues/#isolated-storage
 */

import { SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import { createUpdate, resetFixtureCounters } from './helpers/fixtures';

describe('Performance E2E', () => {
  beforeEach(() => {
    resetFixtureCounters();
  });

  it('acknowledges webhook within 100ms', async () => {
    // Use /help command which doesn't involve DO storage
    const update = createUpdate({ text: '/help' });

    const start = performance.now();

    const response = await SELF.fetch('http://localhost/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    });

    const duration = performance.now() - start;

    expect(response.status).toBe(200);
    expect(duration).toBeLessThan(100);

    // Verify response body
    const body = (await response.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it('handles 5 concurrent webhook requests', async () => {
    // Use command-based messages that don't involve DO storage
    // This avoids isolated storage frame tracking issues
    const commands = ['/start', '/help', '/start', '/help', '/start'];

    const requests = commands.map((cmd) =>
      SELF.fetch('http://localhost/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createUpdate({ text: cmd })),
      })
    );

    // Execute all requests concurrently
    const responses = await Promise.all(requests);

    // All should succeed
    for (const response of responses) {
      expect(response.status).toBe(200);

      const body = (await response.json()) as { ok: boolean };
      expect(body.ok).toBe(true);
    }
  });
});
