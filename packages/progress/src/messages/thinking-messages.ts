/// <reference lib="ES2022" />
/// <reference lib="DOM" />

/**
 * Thinking messages module for progress tracking and display.
 * Provides rotating messages to indicate processing state.
 */

/**
 * Initial thinking messages
 */
export const THINKING_MESSAGES = [
  'Thinking...',
  'Processing...',
  'Pondering...',
  'Cogitating...',
  'Ruminating...',
  'Contemplating...',
  'Analyzing...',
  'Computing...',
  'Deliberating...',
  'Musing...',
  'Brainstorming...',
  'Synthesizing...',
  'Evaluating...',
  'Reasoning...',
  'Deducing...',
  'Flambéing...',
  'Marinating...',
  'Percolating...',
  'Simmering...',
  'Brewing...',
] as const;

/**
 * Extended thinking messages for longer operations
 */
export const EXTENDED_MESSAGES = [
  'Still thinking...',
  'Deep in thought...',
  'Almost there...',
  'Working on it...',
  'Bear with me...',
  'Complex task...',
  'Crunching numbers...',
  'Consulting the oracle...',
  'Channeling wisdom...',
  'Brewing ideas...',
  'Summoning insights...',
  'Weaving thoughts...',
  'Distilling knowledge...',
  'Forging connections...',
  'Unraveling mysteries...',
] as const;

/**
 * Get a random message from the appropriate message array
 * @param extended - Use extended messages for longer operations
 * @returns Random message string
 */
export function getRandomMessage(extended = false): string {
  const messages = extended ? EXTENDED_MESSAGES : THINKING_MESSAGES;
  const index = Math.floor(Math.random() * messages.length);
  return messages[index]!;
}

/**
 * Configuration for the thinking rotator
 */
export interface ThinkingRotatorConfig {
  /** Custom messages to rotate through */
  messages?: string[];
  /** Interval in milliseconds between message rotations */
  interval?: number;
  /** Whether to pick random different messages on each rotation */
  random?: boolean;
}

/**
 * Interface for managing rotating thinking messages
 */
export interface ThinkingRotator {
  /**
   * Get the current message without triggering rotation
   */
  getCurrentMessage(): string;

  /**
   * Start the rotation with a callback that gets called on each rotation
   * @param onMessage - Async callback called on each rotation with new message
   */
  start(onMessage: (msg: string) => Promise<void>): void;

  /**
   * Stop the rotation and clean up timers
   */
  stop(): void;

  /**
   * Wait for all pending callbacks to complete
   */
  waitForPending(): Promise<void>;
}

/**
 * Create a thinking message rotator
 * @param config - Configuration options
 * @returns Rotator instance
 */
export function createRotator(config?: ThinkingRotatorConfig): ThinkingRotator {
  const messages = config?.messages ?? Array.from(THINKING_MESSAGES);
  const interval = config?.interval ?? 2000;
  const random = config?.random ?? true;

  let currentIndex = 0;
  let currentMessage = messages[0];
  let timerId: ReturnType<typeof setTimeout> | null = null;
  let pendingCallback: Promise<void> | null = null;
  let isRunning = false;

  function getNextMessage(): string {
    if (random) {
      // Pick a random message, avoid repeating the same one
      let nextIndex = Math.floor(Math.random() * messages.length);
      // Ensure we don't pick the same message if there are multiple options
      if (messages.length > 1) {
        while (nextIndex === currentIndex) {
          nextIndex = Math.floor(Math.random() * messages.length);
        }
      }
      currentIndex = nextIndex;
    } else {
      // Sequential rotation
      currentIndex = (currentIndex + 1) % messages.length;
    }
    currentMessage = messages[currentIndex]!;
    return currentMessage;
  }

  function scheduleNext(onMessage: (msg: string) => Promise<void>): void {
    if (!isRunning) {
      return;
    }

    timerId = setTimeout(async () => {
      const nextMessage = getNextMessage();
      try {
        const promise = onMessage(nextMessage);
        pendingCallback = promise;
        await promise;
      } catch (error) {
        // Silently handle callback errors to prevent breaking rotation
        console.error('Error in thinking message callback:', error);
      } finally {
        pendingCallback = null;
        scheduleNext(onMessage);
      }
    }, interval);
  }

  return {
    getCurrentMessage(): string {
      return currentMessage!;
    },

    start(onMessage: (msg: string) => Promise<void>): void {
      if (isRunning) {
        return;
      }
      isRunning = true;
      scheduleNext(onMessage);
    },

    stop(): void {
      isRunning = false;
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
    },

    async waitForPending(): Promise<void> {
      if (pendingCallback !== null) {
        await pendingCallback;
      }
    },
  };
}
