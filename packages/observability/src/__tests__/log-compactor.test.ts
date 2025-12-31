/**
 * Unit tests for log compaction utilities
 *
 * Test Categories:
 * 1. compactStateUpdate function
 * 2. compactDebugContext function
 * 3. compactLog function
 * 4. createCompactMiddleware factory
 */

import { describe, expect, it } from 'vitest';
import {
  compactDebugContext,
  compactLog,
  compactStateUpdate,
  createCompactMiddleware,
} from '../log-compactor';

describe('compactStateUpdate', () => {
  it('compacts state update with message array payload', () => {
    const log = {
      displayMessage: 'State updated',
      type: 'state:update',
      payload: {
        messages: [{ id: '1' }, { id: '2' }, { id: '3' }],
      },
      timestamp: 1765739728961,
    };

    const result = compactStateUpdate(log);

    expect(result).toBe('[state] msgs:3 | t:1765739728961');
  });

  it('handles missing payload gracefully', () => {
    const log = {
      displayMessage: 'State updated',
      type: 'state:update',
      timestamp: 1765739728961,
    };

    const result = compactStateUpdate(log);

    expect(result).toBe('[state] msgs:? | t:1765739728961');
  });

  it('abbreviates timestamp when abbreviate option is true', () => {
    const log = {
      displayMessage: 'State updated',
      payload: { messages: [] },
      timestamp: 1765739728961,
    };

    const result = compactStateUpdate(log, { abbreviate: true });

    expect(result).toBe('[state] msgs:0 | t:728961');
  });

  it('uses abbreviated timestamp field when present', () => {
    const log = {
      displayMessage: 'State updated',
      payload: { messages: [{ id: '1' }] },
      t: 1765739728961,
    };

    const result = compactStateUpdate(log, { abbreviate: true });

    expect(result).toBe('[state] msgs:1 | t:728961');
  });
});

describe('compactDebugContext', () => {
  it('returns original context when messages array is small', () => {
    const context = {
      messages: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ],
    };

    const result = compactDebugContext(context);

    expect(result).toBe(context);
  });

  it('compacts large messages array to first and last', () => {
    const messages = [
      { role: 'user', content: 'First message' },
      { role: 'assistant', content: 'Response 1' },
      { role: 'user', content: 'Message 2' },
      { role: 'assistant', content: 'Response 2' },
      { role: 'user', content: 'Last message' },
    ];

    const context = {
      messages,
      otherField: 'preserved',
    };

    const result = compactDebugContext(context);

    expect(result.messages).toHaveLength(2);
    expect(result.messages[0].role).toBe('user');
    expect(result.messages[1].role).toBe('user');
    expect(result.messageCount).toBe(5);
    expect(result.otherField).toBe('preserved');
  });

  it('hides refs when hideRefs option is true', () => {
    const messages = [
      { role: 'user', id: 'msg-1', content: 'First' },
      { role: 'assistant', id: 'msg-2', content: 'Response 1' },
      { role: 'user', id: 'msg-3', content: 'Message 2' },
      { role: 'assistant', id: 'msg-4', content: 'Response 2' },
      { role: 'user', id: 'msg-5', content: 'Last' },
    ];

    const context = { messages };

    const result = compactDebugContext(context, { hideRefs: true });

    expect(result.messages[0]).not.toHaveProperty('id');
    expect(result.messages[1]).not.toHaveProperty('id');
  });

  it('includes refs when hideRefs option is false', () => {
    const messages = [
      { role: 'user', id: 'msg-1', content: 'First' },
      { role: 'assistant', id: 'msg-2', content: 'Last' },
    ];

    const context = { messages };

    const result = compactDebugContext(context, { hideRefs: false });

    expect(result.messages[0]).toHaveProperty('id', 'msg-1');
    expect(result.messages[1]).toHaveProperty('id', 'msg-2');
  });

  it('handles context without messages field', () => {
    const context = {
      otherField: 'value',
      nested: { key: 'value' },
    };

    const result = compactDebugContext(context);

    expect(result).toBe(context);
  });
});

describe('compactLog', () => {
  it('compacts state update events', () => {
    const log = {
      displayMessage: 'State updated',
      type: 'state:update',
      payload: { messages: [] },
      timestamp: 1765739728961,
    };

    const result = compactLog(log);

    expect(result).toBe('[state] msgs:0 | t:1765739728961');
  });

  it('compacts large messages arrays', () => {
    const largeArray = Array.from({ length: 15 }, (_, i) => ({ id: i }));
    const log = {
      type: 'chat',
      messages: largeArray,
      timestamp: 1765739728961,
    };

    const result = compactLog(log);

    // compactLog returns an object for non-state updates
    expect(result).toMatchObject({
      messages: '<15 items>',
    });
  });

  it('abbreviates field names when abbreviate option is true', () => {
    const largeArray = Array.from({ length: 15 }, (_, i) => ({ id: i }));
    const log = {
      type: 'chat',
      messages: largeArray,
      timestamp: 1765739728961,
    };

    const result = compactLog(log, { abbreviate: true });

    // Should have abbreviated field name
    expect(result).toHaveProperty('msgs');
  });

  it('truncates IDs to 8 characters', () => {
    const log = {
      type: 'event',
      traceId: 'abc123def456789',
      requestId: 'req-987654321xyz',
      timestamp: 1765739728961,
    };

    const result = compactLog(log);

    expect(result).toMatchObject({
      traceId: 'abc123de...',
      requestId: 'req-9876...',
    });
  });

  it('compresses large objects', () => {
    const largeObject = {
      key1: 'value1',
      key2: 'value2',
      key3: 'value3',
      key4: 'value4',
      key5: 'value5',
      key6: 'value6',
    };

    const log = {
      type: 'data',
      largeObject,
      timestamp: 1765739728961,
    };

    const result = compactLog(log);

    expect(result).toMatchObject({
      largeObject: '<object with 6 keys>',
    });
  });

  it('passes through simple logs unchanged', () => {
    const log = {
      type: 'simple',
      message: 'Hello world',
      timestamp: 1765739728961,
    };

    const result = compactLog(log);

    expect(result).toMatchObject({
      type: 'simple',
      message: 'Hello world',
    });
  });
});

describe('createCompactMiddleware', () => {
  it('returns a middleware function', () => {
    const middleware = createCompactMiddleware();

    expect(typeof middleware).toBe('function');
  });

  it('middleware compacts logs with default options', () => {
    const middleware = createCompactMiddleware();
    const log = {
      displayMessage: 'State updated',
      payload: { messages: [] },
      timestamp: 1765739728961,
    };

    const result = middleware(log);

    expect(result).toBe('[state] msgs:0 | t:1765739728961');
  });

  it('middleware uses custom options', () => {
    const middleware = createCompactMiddleware({ abbreviate: true });
    const log = {
      displayMessage: 'State updated',
      payload: { messages: [] },
      timestamp: 1765739728961,
    };

    const result = middleware(log);

    expect(result).toBe('[state] msgs:0 | t:728961');
  });

  it('middleware passes options through to compactLog', () => {
    const middleware = createCompactMiddleware({ abbreviate: true });
    const log = {
      displayMessage: 'State updated',
      payload: { messages: [] },
      timestamp: 1765739728961,
    };

    const result = middleware(log);

    expect(result).toBe('[state] msgs:0 | t:728961');
  });

  it('compactDebugContext handles hideRefs option', () => {
    const messages = [
      { role: 'user', id: 'msg-1', content: 'First' },
      { role: 'assistant', id: 'msg-2', content: 'Response' },
      { role: 'user', id: 'msg-3', content: 'Next' },
      { role: 'assistant', id: 'msg-4', content: 'Last' },
      { role: 'user', id: 'msg-5', content: 'End' },
    ];

    const context = { messages };
    const result = compactDebugContext(context, { hideRefs: true });

    // Should compact to first and last only, without IDs
    expect(Array.isArray(result.messages)).toBe(true);
    expect(result.messages[0]).not.toHaveProperty('id');
    expect(result.messages.length).toBeLessThan(messages.length);
  });
});
