/**
 * Smoke tests for E2E testing infrastructure
 *
 * These tests verify that the testing setup is working correctly
 * before running more complex E2E tests.
 */

import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

describe('E2E Smoke Test', () => {
  it('has access to environment bindings', () => {
    expect(env).toBeDefined();
  });

  it('has TelegramAgent Durable Object binding', () => {
    expect(env.TelegramAgent).toBeDefined();
  });

  it('has environment variables from wrangler.toml', () => {
    // These come from [vars] in wrangler.toml
    expect(env.ENVIRONMENT).toBe('production');
    expect(env.MODEL).toBe('x-ai/grok-4.1-fast');
    expect(env.AI_GATEWAY_NAME).toBe('duyetbot');
    expect(env.AI_GATEWAY_PROVIDER).toBe('openrouter');
    expect(env.TELEGRAM_ADMIN).toBe('duyet');
  });

  it('can create a Durable Object ID', () => {
    const sessionId = 'telegram:12345:12345';
    const id = env.TelegramAgent.idFromName(sessionId);
    expect(id).toBeDefined();
  });

  it('can get a Durable Object stub', () => {
    const sessionId = 'telegram:12345:12345';
    const id = env.TelegramAgent.idFromName(sessionId);
    const stub = env.TelegramAgent.get(id);
    expect(stub).toBeDefined();
  });
});
