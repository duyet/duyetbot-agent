/**
 * Tests for error handler middleware
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../middleware/error-handler.js';

describe('errorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock console.error to avoid noise in test output
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('error responses', () => {
    it('should return 500 for generic errors', async () => {
      const app = new Hono();
      app.onError(errorHandler);
      app.get('/error', () => {
        throw new Error('Something went wrong');
      });

      const res = await app.request('/error');

      expect(res.status).toBe(500);
    });

    it('should return JSON response with error details', async () => {
      const app = new Hono();
      app.onError(errorHandler);
      app.get('/error', () => {
        throw new Error('Database connection failed');
      });

      const res = await app.request('/error');
      const data = await res.json();

      expect(data).toHaveProperty('error');
      expect(data).toHaveProperty('message');
      expect(data.message).toBe('Database connection failed');
    });

    it('should use "Internal Server Error" for 500 errors', async () => {
      const app = new Hono();
      app.onError(errorHandler);
      app.get('/error', () => {
        throw new Error('Test error');
      });

      const res = await app.request('/error');
      const data = await res.json();

      expect(data.error).toBe('Internal Server Error');
    });

    it('should include error message in response', async () => {
      const app = new Hono();
      app.onError(errorHandler);
      app.get('/error', () => {
        throw new Error('Custom error message');
      });

      const res = await app.request('/error');
      const data = await res.json();

      expect(data.message).toBe('Custom error message');
    });
  });

  describe('custom status codes', () => {
    it('should use error.status if available', async () => {
      const app = new Hono();
      app.onError(errorHandler);
      app.get('/not-found', () => {
        const error = new Error('Resource not found');
        (error as unknown as { status: number }).status = 404;
        throw error;
      });

      const res = await app.request('/not-found');

      expect(res.status).toBe(404);
    });

    it('should use error.name for non-500 errors', async () => {
      const app = new Hono();
      app.onError(errorHandler);
      app.get('/validation', () => {
        const error = new Error('Invalid input');
        (error as unknown as { status: number }).status = 400;
        error.name = 'ValidationError';
        throw error;
      });

      const res = await app.request('/validation');
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe('ValidationError');
      expect(data.message).toBe('Invalid input');
    });

    it('should handle 401 unauthorized errors', async () => {
      const app = new Hono();
      app.onError(errorHandler);
      app.get('/protected', () => {
        const error = new Error('Token expired');
        (error as unknown as { status: number }).status = 401;
        error.name = 'UnauthorizedError';
        throw error;
      });

      const res = await app.request('/protected');

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('UnauthorizedError');
    });

    it('should handle 403 forbidden errors', async () => {
      const app = new Hono();
      app.onError(errorHandler);
      app.get('/admin', () => {
        const error = new Error('Insufficient permissions');
        (error as unknown as { status: number }).status = 403;
        error.name = 'ForbiddenError';
        throw error;
      });

      const res = await app.request('/admin');

      expect(res.status).toBe(403);
    });
  });

  describe('error logging', () => {
    it('should log error message and stack', async () => {
      const app = new Hono();
      app.onError(errorHandler);
      app.get('/error', () => {
        throw new Error('Log this error');
      });

      await app.request('/error');

      expect(console.error).toHaveBeenCalledWith('Error:', 'Log this error', expect.any(String));
    });

    it('should log errors even when status is custom', async () => {
      const app = new Hono();
      app.onError(errorHandler);
      app.get('/error', () => {
        const error = new Error('Custom status error');
        (error as unknown as { status: number }).status = 422;
        throw error;
      });

      await app.request('/error');

      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('fallback error message', () => {
    it('should provide fallback message when error has no message', async () => {
      const app = new Hono();
      app.onError(errorHandler);
      app.get('/error', () => {
        const error = new Error();
        error.message = '';
        throw error;
      });

      const res = await app.request('/error');
      const data = await res.json();

      expect(data.message).toBe('An unexpected error occurred');
    });
  });

  describe('error name fallback', () => {
    it('should use "Error" as fallback when error.name is not set', async () => {
      const app = new Hono();
      app.onError(errorHandler);
      app.get('/error', () => {
        const error = new Error('Test');
        (error as unknown as { status: number }).status = 400;
        error.name = '';
        throw error;
      });

      const res = await app.request('/error');
      const data = await res.json();

      expect(data.error).toBe('Error');
    });
  });
});
