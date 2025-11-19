import { getLogger, loggerMiddleware } from '@/api/middleware/logger';
import { getRequestId, requestIdMiddleware } from '@/api/middleware/request-id';
import { PerformanceTimer, getTimer, measure, timingMiddleware } from '@/api/middleware/timing';
import type { Env } from '@/api/types';
import type { R2Bucket, VectorizeIndex } from '@cloudflare/workers-types';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Create mock environment
const createMockEnv = (): Env => ({
  DB: {} as D1Database,
  KV: {} as KVNamespace,
  VECTORIZE: {} as VectorizeIndex,
  R2: {} as R2Bucket,
  JWT_SECRET: 'test-secret',
  ANTHROPIC_API_KEY: 'test-key',
  OPENAI_API_KEY: 'test-key',
  OPENROUTER_API_KEY: 'test-key',
  GITHUB_CLIENT_ID: 'test-id',
  GITHUB_CLIENT_SECRET: 'test-secret',
  GITHUB_REDIRECT_URI: 'http://localhost/callback',
  GITHUB_WEBHOOK_SECRET: 'test-secret',
  GOOGLE_CLIENT_ID: 'test-id',
  GOOGLE_CLIENT_SECRET: 'test-secret',
  GOOGLE_REDIRECT_URI: 'http://localhost/callback',
  FRONTEND_URL: 'http://localhost:3000',
  API_URL: 'http://localhost:8787',
  WEB_URL: 'http://localhost:3000',
  ENVIRONMENT: 'test',
});

describe('Request ID Middleware', () => {
  let app: Hono<{ Bindings: Env }>;
  let env: Env;

  beforeEach(() => {
    app = new Hono<{ Bindings: Env }>();
    env = createMockEnv();
    app.use('*', requestIdMiddleware);
  });

  it('should generate a unique request ID', async () => {
    app.get('/test', (c) => {
      const requestId = getRequestId(c as any);
      return c.json({ requestId });
    });

    const res = await app.request('/test', { method: 'GET' }, env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.requestId).toBeTruthy();
    expect(typeof body.requestId).toBe('string');
  });

  it('should add X-Request-ID header to response', async () => {
    app.get('/test', (c) => c.json({ ok: true }));

    const res = await app.request('/test', { method: 'GET' }, env);

    expect(res.headers.get('X-Request-ID')).toBeTruthy();
  });

  it('should use existing X-Request-ID from request', async () => {
    const existingId = 'my-custom-id';

    app.get('/test', (c) => {
      const requestId = getRequestId(c as any);
      return c.json({ requestId });
    });

    const res = await app.request(
      '/test',
      {
        method: 'GET',
        headers: {
          'X-Request-ID': existingId,
        },
      },
      env
    );

    const body = (await res.json()) as any;
    expect(body.requestId).toBe(existingId);
    expect(res.headers.get('X-Request-ID')).toBe(existingId);
  });

  it('should use CF-Ray header if no X-Request-ID', async () => {
    const cfRay = 'cloudflare-ray-123';

    app.get('/test', (c) => {
      const requestId = getRequestId(c as any);
      return c.json({ requestId });
    });

    const res = await app.request(
      '/test',
      {
        method: 'GET',
        headers: {
          'CF-Ray': cfRay,
        },
      },
      env
    );

    const body = (await res.json()) as any;
    expect(body.requestId).toBe(cfRay);
  });

  it('should generate different IDs for different requests', async () => {
    app.get('/test', (c) => {
      const requestId = getRequestId(c as any);
      return c.json({ requestId });
    });

    const res1 = await app.request('/test', { method: 'GET' }, env);
    const res2 = await app.request('/test', { method: 'GET' }, env);

    const body1 = (await res1.json()) as any;
    const body2 = (await res2.json()) as any;

    expect(body1.requestId).not.toBe(body2.requestId);
  });
});

describe('Logger Middleware', () => {
  let app: Hono<{ Bindings: Env }>;
  let env: Env;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    app = new Hono<{ Bindings: Env }>();
    env = createMockEnv();
    app.use('*', requestIdMiddleware);
    app.use('*', loggerMiddleware);

    // Spy on console methods
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should log request and response', async () => {
    app.get('/test', (c) => c.json({ ok: true }));

    await app.request('/test', { method: 'GET' }, env);

    // Should log at least 2 times (request received + request completed)
    expect(consoleLogSpy).toHaveBeenCalled();
    expect(consoleLogSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('should log with structured format', async () => {
    app.get('/test', (c) => c.json({ ok: true }));

    await app.request('/test', { method: 'GET' }, env);

    const logCalls = consoleLogSpy.mock.calls;
    expect(logCalls.length).toBeGreaterThan(0);

    // First call should be JSON
    const logEntry = JSON.parse(logCalls[0][0]);
    expect(logEntry.timestamp).toBeTruthy();
    expect(logEntry.level).toBeTruthy();
    expect(logEntry.requestId).toBeTruthy();
    expect(logEntry.message).toBeTruthy();
    expect(logEntry.method).toBe('GET');
    expect(logEntry.path).toBe('/test');
  });

  it('should include duration in response log', async () => {
    app.get('/test', async (c) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return c.json({ ok: true });
    });

    await app.request('/test', { method: 'GET' }, env);

    const logCalls = consoleLogSpy.mock.calls;
    const responseLog = JSON.parse(logCalls[logCalls.length - 1][0]);

    expect(responseLog.message).toBe('Request completed');
    expect(responseLog.duration).toBeGreaterThanOrEqual(0);
    expect(responseLog.statusCode).toBe(200);
  });

  it('should log errors with error level', async () => {
    app.get('/test', () => {
      throw new Error('Test error');
    });

    app.onError((err, c) => {
      const logger = getLogger(c as any);
      logger.error('Handler error', err);
      return c.json({ error: err.message }, 500);
    });

    await app.request('/test', { method: 'GET' }, env);

    expect(consoleErrorSpy).toHaveBeenCalled();
    const errorLog = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
    expect(errorLog.level).toBe('error');
    expect(errorLog.error?.message).toBe('Test error');
  });

  it('should log with different levels', async () => {
    app.get('/test', (c) => {
      const logger = getLogger(c as any);
      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warning message');
      return c.json({ ok: true });
    });

    await app.request('/test', { method: 'GET' }, env);

    // Should have multiple log entries with different levels
    const logs = consoleLogSpy.mock.calls.map((call: any) => JSON.parse(call[0]));
    const levels = logs.map((log: any) => log.level);

    expect(levels).toContain('debug');
    expect(levels).toContain('info');
    expect(levels).toContain('warn');
  });

  it('should include metadata in logs', async () => {
    app.get('/test', (c) => {
      const logger = getLogger(c as any);
      logger.info('Test with metadata', { userId: '123', action: 'test' });
      return c.json({ ok: true });
    });

    await app.request('/test', { method: 'GET' }, env);

    const logs = consoleLogSpy.mock.calls.map((call: any) => JSON.parse(call[0]));
    const logWithMetadata = logs.find((log: any) => log.message === 'Test with metadata');

    expect(logWithMetadata).toBeTruthy();
    expect(logWithMetadata.metadata).toEqual({ userId: '123', action: 'test' });
  });
});

describe('Timing Middleware', () => {
  let app: Hono<{ Bindings: Env }>;
  let env: Env;

  beforeEach(() => {
    app = new Hono<{ Bindings: Env }>();
    env = createMockEnv();
    app.use('*', timingMiddleware);
  });

  it('should add Server-Timing header', async () => {
    app.get('/test', (c) => c.json({ ok: true }));

    const res = await app.request('/test', { method: 'GET' }, env);

    expect(res.headers.get('Server-Timing')).toBeTruthy();
  });

  it('should add X-Response-Time header', async () => {
    app.get('/test', (c) => c.json({ ok: true }));

    const res = await app.request('/test', { method: 'GET' }, env);

    const responseTime = res.headers.get('X-Response-Time');
    expect(responseTime).toBeTruthy();
    expect(responseTime).toMatch(/^\d+ms$/);
  });

  it('should track total request time', async () => {
    app.get('/test', async (c) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return c.json({ ok: true });
    });

    const res = await app.request('/test', { method: 'GET' }, env);

    const serverTiming = res.headers.get('Server-Timing');
    expect(serverTiming).toContain('total');
    expect(serverTiming).toContain('dur=');
  });

  it('should allow custom timing measurements', async () => {
    app.get('/test', async (c) => {
      const timer = getTimer(c as any);

      timer.start('db-query', 'Database query');
      await new Promise((resolve) => setTimeout(resolve, 10));
      timer.end('db-query');

      return c.json({ ok: true });
    });

    const res = await app.request('/test', { method: 'GET' }, env);

    const serverTiming = res.headers.get('Server-Timing');
    expect(serverTiming).toContain('db-query');
    expect(serverTiming).toContain('desc="Database query"');
  });

  it('should support measure utility', async () => {
    app.get('/test', async (c) => {
      const result = await measure(c as any, 'async-op', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 'result';
      });

      return c.json({ result });
    });

    const res = await app.request('/test', { method: 'GET' }, env);

    const body = (await res.json()) as any;
    expect(body.result).toBe('result');

    const serverTiming = res.headers.get('Server-Timing');
    expect(serverTiming).toContain('async-op');
  });

  it('should track multiple operations', async () => {
    app.get('/test', async (c) => {
      const timer = getTimer(c as any);

      timer.start('op1');
      await new Promise((resolve) => setTimeout(resolve, 5));
      timer.end('op1');

      timer.start('op2');
      await new Promise((resolve) => setTimeout(resolve, 5));
      timer.end('op2');

      return c.json({ ok: true });
    });

    const res = await app.request('/test', { method: 'GET' }, env);

    const serverTiming = res.headers.get('Server-Timing');
    expect(serverTiming).toContain('op1');
    expect(serverTiming).toContain('op2');
    expect(serverTiming).toContain('total');
  });

  it('should get all timings', async () => {
    app.get('/test', async (c) => {
      const timer = getTimer(c as any);

      timer.start('test-op');
      await new Promise((resolve) => setTimeout(resolve, 10));
      timer.end('test-op');

      const timings = timer.getTimings();
      return c.json({ timings });
    });

    const res = await app.request('/test', { method: 'GET' }, env);
    const body = (await res.json()) as any;

    expect(body.timings).toBeInstanceOf(Array);
    expect(body.timings.length).toBeGreaterThan(0);
    expect(body.timings[0]).toHaveProperty('name');
    expect(body.timings[0]).toHaveProperty('duration');
  });
});

describe('PerformanceTimer', () => {
  it('should track timing entries', () => {
    const timer = new PerformanceTimer();

    timer.start('test');
    timer.end('test');

    const timings = timer.getTimings();
    expect(timings).toHaveLength(1);
    expect(timings[0]?.name).toBe('test');
    expect(timings[0]?.duration).toBeGreaterThanOrEqual(0);
  });

  it('should format as Server-Timing header', () => {
    const timer = new PerformanceTimer();

    timer.start('test1', 'First test');
    timer.end('test1');

    timer.start('test2');
    timer.end('test2');

    const header = timer.toServerTimingHeader();
    expect(header).toContain('test1;dur=');
    expect(header).toContain('desc="First test"');
    expect(header).toContain('test2;dur=');
  });

  it('should handle unfinished timers', () => {
    const timer = new PerformanceTimer();

    timer.start('finished');
    timer.end('finished');

    timer.start('unfinished');

    const timings = timer.getTimings();
    expect(timings).toHaveLength(1); // Only finished timer
    expect(timings[0]?.name).toBe('finished');
  });
});
