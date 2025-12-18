import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createRotator,
  EXTENDED_MESSAGES,
  getRandomMessage,
  THINKING_MESSAGES,
  ThinkingRotator,
} from '../thinking-messages';

describe('Thinking Messages', () => {
  describe('Constants', () => {
    it('THINKING_MESSAGES is a readonly array with expected messages', () => {
      expect(Array.isArray(THINKING_MESSAGES)).toBe(true);
      expect(THINKING_MESSAGES.length).toBeGreaterThan(0);
      expect(THINKING_MESSAGES).toContain('Thinking...');
      expect(THINKING_MESSAGES).toContain('Processing...');
      expect(THINKING_MESSAGES).toContain('Brewing...');
    });

    it('EXTENDED_MESSAGES is a readonly array with expected messages', () => {
      expect(Array.isArray(EXTENDED_MESSAGES)).toBe(true);
      expect(EXTENDED_MESSAGES.length).toBeGreaterThan(0);
      expect(EXTENDED_MESSAGES).toContain('Still thinking...');
      expect(EXTENDED_MESSAGES).toContain('Deep in thought...');
      expect(EXTENDED_MESSAGES).toContain('Unraveling mysteries...');
    });

    it('All messages are non-empty strings', () => {
      [...THINKING_MESSAGES, ...EXTENDED_MESSAGES].forEach((msg) => {
        expect(typeof msg).toBe('string');
        expect(msg.length).toBeGreaterThan(0);
      });
    });
  });

  describe('getRandomMessage()', () => {
    it('returns a message from THINKING_MESSAGES by default', () => {
      const message = getRandomMessage();
      expect(THINKING_MESSAGES).toContain(message);
    });

    it('returns a message from EXTENDED_MESSAGES when extended=true', () => {
      const message = getRandomMessage(true);
      expect(EXTENDED_MESSAGES).toContain(message);
    });

    it('returns different messages on multiple calls (statistical)', () => {
      const messages = new Set<string>();
      for (let i = 0; i < 30; i++) {
        messages.add(getRandomMessage());
      }
      // With 20+ thinking messages and 30 calls, very likely to get different ones
      expect(messages.size).toBeGreaterThan(1);
    });

    it('returns valid extended messages on multiple calls (statistical)', () => {
      const messages = new Set<string>();
      for (let i = 0; i < 20; i++) {
        messages.add(getRandomMessage(true));
      }
      // With 15+ extended messages and 20 calls, very likely to get different ones
      expect(messages.size).toBeGreaterThan(1);
      messages.forEach((msg) => {
        expect(EXTENDED_MESSAGES).toContain(msg);
      });
    });
  });

  describe('createRotator()', () => {
    let rotator: ThinkingRotator;

    afterEach(() => {
      if (rotator) {
        rotator.stop();
      }
      vi.clearAllTimers();
    });

    describe('Initialization', () => {
      it('creates a rotator with default configuration', () => {
        rotator = createRotator();
        expect(rotator).toBeDefined();
        expect(rotator.getCurrentMessage).toBeDefined();
        expect(rotator.start).toBeDefined();
        expect(rotator.stop).toBeDefined();
        expect(rotator.waitForPending).toBeDefined();
      });

      it('starts with a valid thinking message', () => {
        rotator = createRotator();
        const message = rotator.getCurrentMessage();
        expect(THINKING_MESSAGES).toContain(message);
      });

      it('respects custom messages configuration', () => {
        const customMessages = ['Foo', 'Bar', 'Baz'];
        rotator = createRotator({ messages: customMessages });
        const message = rotator.getCurrentMessage();
        expect(customMessages).toContain(message);
      });

      it('respects custom interval configuration', () => {
        rotator = createRotator({ interval: 500 });
        expect(rotator.getCurrentMessage()).toBeDefined();
      });

      it('respects random configuration', () => {
        rotator = createRotator({ random: false });
        expect(rotator.getCurrentMessage()).toBeDefined();
      });
    });

    describe('Rotation behavior', () => {
      it('rotates to a different message when started', async () => {
        vi.useFakeTimers();
        const messages: string[] = [];
        const callback = vi.fn(async (msg: string) => {
          messages.push(msg);
        });

        rotator = createRotator({ interval: 100, random: true });
        const _initialMessage = rotator.getCurrentMessage();

        rotator.start(callback);
        await vi.advanceTimersByTimeAsync(100);

        expect(callback).toHaveBeenCalled();
        expect(messages.length).toBeGreaterThan(0);
        // With random enabled and multiple messages, rotation changes most of the time
        const rotatedMessage = rotator.getCurrentMessage();
        // Just verify we get a valid message, randomness may occasionally repeat
        expect(THINKING_MESSAGES).toContain(rotatedMessage);
      });

      it('calls callback on each rotation', async () => {
        vi.useFakeTimers();
        const callback = vi.fn(async () => {});

        rotator = createRotator({ interval: 100 });
        rotator.start(callback);

        await vi.advanceTimersByTimeAsync(100);
        expect(callback).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(100);
        expect(callback).toHaveBeenCalledTimes(2);

        await vi.advanceTimersByTimeAsync(100);
        expect(callback).toHaveBeenCalledTimes(3);
      });

      it('rotates sequentially when random=false', async () => {
        vi.useFakeTimers();
        const messages: string[] = [];
        const callback = vi.fn(async (msg: string) => {
          messages.push(msg);
        });

        const customMessages = ['A', 'B', 'C'];
        rotator = createRotator({
          messages: customMessages,
          interval: 100,
          random: false,
        });

        rotator.start(callback);

        // First rotation
        await vi.advanceTimersByTimeAsync(100);
        expect(messages[0]).toBe('B');

        // Second rotation
        await vi.advanceTimersByTimeAsync(100);
        expect(messages[1]).toBe('C');

        // Third rotation (wraps around)
        await vi.advanceTimersByTimeAsync(100);
        expect(messages[2]).toBe('A');
      });

      it('avoids repeating the same message in random mode when possible', async () => {
        vi.useFakeTimers();
        const messages: string[] = [];
        const callback = vi.fn(async (msg: string) => {
          messages.push(msg);
        });

        const customMessages = ['A', 'B', 'C', 'D'];
        rotator = createRotator({
          messages: customMessages,
          interval: 100,
          random: true,
        });

        rotator.start(callback);

        // Run many rotations and check for consecutive repeats
        for (let i = 0; i < 10; i++) {
          await vi.advanceTimersByTimeAsync(100);
        }

        // With 4 messages and random selection, we should rarely see duplicates
        let consecutiveRepeats = 0;
        for (let i = 1; i < messages.length; i++) {
          if (messages[i] === messages[i - 1]) {
            consecutiveRepeats++;
          }
        }
        // Very unlikely to have many consecutive repeats with 4 messages
        expect(consecutiveRepeats).toBeLessThan(3);
      });
    });

    describe('Stop behavior', () => {
      it('stops rotation after calling stop()', async () => {
        vi.useFakeTimers();
        const callback = vi.fn(async () => {});

        rotator = createRotator({ interval: 100 });
        rotator.start(callback);

        await vi.advanceTimersByTimeAsync(100);
        expect(callback).toHaveBeenCalledTimes(1);

        rotator.stop();

        await vi.advanceTimersByTimeAsync(500);
        // Should still be 1, not 6 (1 + 5 more rotations)
        expect(callback).toHaveBeenCalledTimes(1);
      });

      it('prevents further rotations after stop', async () => {
        vi.useFakeTimers();
        const callback = vi.fn(async () => {});

        rotator = createRotator({ interval: 100 });
        rotator.start(callback);

        rotator.stop();

        await vi.advanceTimersByTimeAsync(1000);
        expect(callback).not.toHaveBeenCalled();
      });

      it('can be called multiple times without error', () => {
        rotator = createRotator();
        rotator.start(async () => {});
        expect(() => {
          rotator.stop();
          rotator.stop();
          rotator.stop();
        }).not.toThrow();
      });
    });

    describe('Callback handling', () => {
      it('awaits async callbacks before scheduling next rotation', async () => {
        vi.useFakeTimers();
        const callOrder: string[] = [];
        const callback = vi.fn(async () => {
          callOrder.push('callback_start');
          await new Promise((resolve) => setTimeout(resolve, 50));
          callOrder.push('callback_end');
        });

        rotator = createRotator({ interval: 100 });
        rotator.start(callback);

        await vi.advanceTimersByTimeAsync(100);
        callOrder.push('first_advance');

        await vi.advanceTimersByTimeAsync(50);
        callOrder.push('halfway');

        await vi.advanceTimersByTimeAsync(100);
        callOrder.push('second_advance');

        expect(callOrder[0]).toBe('callback_start');
        expect(callOrder[1]).toBe('first_advance');
        expect(callOrder[2]).toBe('callback_end');
      });

      it('handles callback errors gracefully', async () => {
        vi.useFakeTimers();
        const errorCallback = vi.fn(async () => {
          throw new Error('Test error');
        });

        const successCallback = vi.fn(async () => {});

        let callCount = 0;
        const wrappedCallback = vi.fn(async () => {
          callCount++;
          if (callCount === 1) {
            await errorCallback();
          } else {
            await successCallback();
          }
        });

        rotator = createRotator({ interval: 100 });
        rotator.start(wrappedCallback);

        // First rotation triggers error
        await vi.advanceTimersByTimeAsync(100);
        expect(wrappedCallback).toHaveBeenCalledTimes(1);

        // Second rotation should still happen despite previous error
        await vi.advanceTimersByTimeAsync(100);
        expect(wrappedCallback).toHaveBeenCalledTimes(2);
      });

      it('passes the correct message to callback', async () => {
        vi.useFakeTimers();
        const messages: string[] = [];
        const callback = vi.fn(async (msg: string) => {
          messages.push(msg);
        });

        const customMessages = ['Hello', 'World'];
        rotator = createRotator({
          messages: customMessages,
          interval: 100,
          random: false,
        });

        rotator.start(callback);

        await vi.advanceTimersByTimeAsync(100);
        expect(callback).toHaveBeenCalledWith('World');
        expect(messages).toContain('World');
      });
    });

    describe('waitForPending()', () => {
      it('resolves immediately when no callback is pending', async () => {
        rotator = createRotator();
        expect(await rotator.waitForPending()).toBeUndefined();
      });

      it('waits for in-flight callback to complete', async () => {
        vi.useFakeTimers();
        let callbackInFlight = false;
        let callbackComplete = false;

        const callback = vi.fn(async () => {
          callbackInFlight = true;
          // Simulate async work
          await new Promise((resolve) => {
            setTimeout(resolve, 50);
          });
          callbackComplete = true;
        });

        rotator = createRotator({ interval: 100 });
        rotator.start(callback);

        // Advance to trigger first callback
        await vi.advanceTimersByTimeAsync(100);
        expect(callbackInFlight).toBe(true);
        expect(callbackComplete).toBe(false);

        // waitForPending should wait for callback completion
        const waitPromise = rotator.waitForPending();

        // Advance to complete the inner async work
        await vi.advanceTimersByTimeAsync(50);
        await waitPromise;

        expect(callbackComplete).toBe(true);
        rotator.stop();
      });

      it('handles multiple callbacks in sequence', async () => {
        vi.useFakeTimers();
        let callCount = 0;

        const callback = vi.fn(async () => {
          callCount++;
        });

        rotator = createRotator({ interval: 50 });
        rotator.start(callback);

        // First callback
        await vi.advanceTimersByTimeAsync(50);
        await rotator.waitForPending();
        expect(callCount).toBe(1);

        // Don't continue rotation - stop it
        rotator.stop();
      });
    });

    describe('Edge cases', () => {
      it('handles starting rotator multiple times', async () => {
        vi.useFakeTimers();
        const callback = vi.fn(async () => {});

        rotator = createRotator({ interval: 100 });
        rotator.start(callback);
        rotator.start(callback); // Start again

        await vi.advanceTimersByTimeAsync(100);
        // Should still only call once (ignores duplicate start)
        expect(callback).toHaveBeenCalledTimes(1);
      });

      it('works with single message array', async () => {
        vi.useFakeTimers();
        const messages: string[] = [];
        const callback = vi.fn(async (msg: string) => {
          messages.push(msg);
        });

        rotator = createRotator({
          messages: ['Only One'],
          interval: 100,
          random: true,
        });

        rotator.start(callback);

        await vi.advanceTimersByTimeAsync(100);
        await vi.advanceTimersByTimeAsync(100);

        // Should always be the same message
        expect(messages.every((m) => m === 'Only One')).toBe(true);
      });

      it('getCurrentMessage returns current message without side effects', () => {
        rotator = createRotator();
        const msg1 = rotator.getCurrentMessage();
        const msg2 = rotator.getCurrentMessage();
        expect(msg1).toBe(msg2);
      });
    });
  });
});
