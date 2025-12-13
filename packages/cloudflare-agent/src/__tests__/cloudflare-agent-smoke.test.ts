import { mock } from 'bun:test';

mock.module('cloudflare:email', () => {
  return {};
});

import { describe, expect, it } from 'bun:test';
import { createCloudflareChatAgent } from '../cloudflare-agent.js';

describe('CloudflareChatAgent Smoke Test', () => {
  it('should export createCloudflareChatAgent', () => {
    expect(createCloudflareChatAgent).toBeDefined();
    expect(typeof createCloudflareChatAgent).toBe('function');
  });
});
