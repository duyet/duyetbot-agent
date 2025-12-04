import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createThinkingRotator,
  getDefaultThinkingMessages,
  getExtendedThinkingMessages,
  getRandomThinkingMessage,
} from '../format';

describe('createThinkingRotator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return initial message', () => {
    const rotator = createThinkingRotator({
      messages: ['First', 'Second', 'Third'],
      random: false,
    });
    expect(rotator.getCurrentMessage()).toBe('First');
  });

  it('should rotate messages on interval', async () => {
    const messages: string[] = [];
    const rotator = createThinkingRotator({
      messages: ['A', 'B', 'C'],
      interval: 1000,
      random: false,
    });

    rotator.start((msg) => {
      messages.push(msg);
    });

    // Advance time and flush promises for async callback
    await vi.advanceTimersByTime(1000);
    expect(messages).toEqual(['B']);

    await vi.advanceTimersByTime(1000);
    expect(messages).toEqual(['B', 'C']);

    await vi.advanceTimersByTime(1000);
    expect(messages).toEqual(['B', 'C', 'A']);

    rotator.stop();
  });

  it('should not start rotation for single message', async () => {
    const messages: string[] = [];
    const rotator = createThinkingRotator({
      messages: ['Only'],
      random: false,
      interval: 5000,
    });

    rotator.start((msg) => messages.push(msg));
    await vi.advanceTimersByTime(10000);

    expect(messages).toEqual([]);
  });

  it('should stop rotation', async () => {
    const messages: string[] = [];
    const rotator = createThinkingRotator({
      messages: ['A', 'B'],
      interval: 1000,
      random: false,
    } satisfies Parameters<typeof createThinkingRotator>[0]);

    rotator.start((msg) => messages.push(msg));
    await vi.advanceTimersByTime(1000);
    rotator.stop();
    await vi.advanceTimersByTime(5000);

    expect(messages).toEqual(['B']);
  });

  it('should use default messages when not provided', () => {
    const rotator = createThinkingRotator();
    const message = rotator.getCurrentMessage();
    expect(getDefaultThinkingMessages()).toContain(message);
  });

  it('should use default interval of 5000ms', async () => {
    const messages: string[] = [];
    const rotator = createThinkingRotator({
      messages: ['A', 'B'],
      random: false,
      interval: 5000,
    });

    rotator.start((msg) => messages.push(msg));

    await vi.advanceTimersByTime(4999);
    expect(messages).toEqual([]);

    await vi.advanceTimersByTime(1);
    expect(messages).toEqual(['B']);

    rotator.stop();
  });

  it('should handle multiple start calls without duplicating timers', async () => {
    const messages: string[] = [];
    const rotator = createThinkingRotator({
      messages: ['A', 'B'],
      interval: 1000,
      random: false,
    } satisfies Parameters<typeof createThinkingRotator>[0]);

    const callback = (msg: string) => messages.push(msg);
    rotator.start(callback);
    rotator.start(callback); // Should be ignored

    await vi.advanceTimersByTime(1000);
    expect(messages).toEqual(['B']); // Only one message, not two

    rotator.stop();
  });

  it('should handle stop when not started', () => {
    const rotator = createThinkingRotator({
      messages: ['A', 'B'],
    });

    // Should not throw
    expect(() => rotator.stop()).not.toThrow();
  });

  it('should return fallback message for empty array', () => {
    const rotator = createThinkingRotator({
      messages: [],
    });

    expect(rotator.getCurrentMessage()).toBe('Thinking...');
  });

  it('should support async callbacks', async () => {
    const messages: string[] = [];
    const rotator = createThinkingRotator({
      messages: ['A', 'B', 'C'],
      interval: 1000,
      random: false,
    });

    // Simulate an async callback like editing a Telegram message
    rotator.start(async (msg) => {
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 100));
      messages.push(msg);
    });

    // First rotation: advance interval timer (1000ms) then async callback timer (100ms)
    await vi.advanceTimersToNextTimerAsync(); // interval timer
    await vi.advanceTimersToNextTimerAsync(); // async callback timer
    expect(messages).toEqual(['B']);

    // Second rotation: advance interval timer (1000ms) then async callback timer (100ms)
    await vi.advanceTimersToNextTimerAsync(); // interval timer
    await vi.advanceTimersToNextTimerAsync(); // async callback timer
    expect(messages).toEqual(['B', 'C']);

    rotator.stop();
  });

  it('should handle callback errors gracefully', async () => {
    const messages: string[] = [];
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const rotator = createThinkingRotator({
      messages: ['A', 'B', 'C'],
      interval: 1000,
      random: false,
    });

    let callCount = 0;
    rotator.start(async (msg) => {
      callCount++;
      if (callCount === 1) {
        throw new Error('Simulated failure');
      }
      messages.push(msg);
    });

    // First rotation should fail but continue
    await vi.advanceTimersByTime(1000);
    expect(errorSpy).toHaveBeenCalledWith('[ROTATOR] Callback failed:', expect.any(Error));

    // Second rotation should succeed
    await vi.advanceTimersByTime(1000);
    expect(messages).toEqual(['C']);

    rotator.stop();
    errorSpy.mockRestore();
  });
});

describe('getDefaultThinkingMessages', () => {
  it('should return array of messages', () => {
    const messages = getDefaultThinkingMessages();
    expect(Array.isArray(messages)).toBe(true);
    expect(messages.length).toBeGreaterThan(0);
  });

  it('should return a copy (not reference)', () => {
    const a = getDefaultThinkingMessages();
    const b = getDefaultThinkingMessages();
    a.push('test');
    expect(b).not.toContain('test');
  });

  it('should include common thinking messages', () => {
    const messages = getDefaultThinkingMessages();
    expect(messages).toContain('Thinking...');
    expect(messages).toContain('Processing...');
  });
});

describe('getExtendedThinkingMessages', () => {
  it('should return array of messages', () => {
    const messages = getExtendedThinkingMessages();
    expect(Array.isArray(messages)).toBe(true);
    expect(messages.length).toBeGreaterThan(0);
  });

  it('should return a copy (not reference)', () => {
    const a = getExtendedThinkingMessages();
    const b = getExtendedThinkingMessages();
    a.push('test');
    expect(b).not.toContain('test');
  });

  it('should include extended thinking messages', () => {
    const messages = getExtendedThinkingMessages();
    expect(messages).toContain('Still thinking...');
    expect(messages).toContain('Almost there...');
  });
});

describe('getRandomThinkingMessage', () => {
  it('should return a string', () => {
    const msg = getRandomThinkingMessage();
    expect(typeof msg).toBe('string');
  });

  it('should return message from default set', () => {
    const msg = getRandomThinkingMessage();
    expect(getDefaultThinkingMessages()).toContain(msg);
  });

  it('should return extended message when requested', () => {
    const msg = getRandomThinkingMessage(true);
    expect(getExtendedThinkingMessages()).toContain(msg);
  });
});
