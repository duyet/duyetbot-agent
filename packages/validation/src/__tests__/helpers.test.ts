/**
 * Tests for validation helper utilities
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  flattenZodErrors,
  formatZodError,
  formatZodErrorToObject,
  getFirstZodError,
  isZodError,
  parseEnvBoolean,
  parseEnvJson,
  parseEnvNumber,
  validateOrThrow,
  validatePartial,
  validateWithData,
} from '../helpers.js';

describe('isZodError', () => {
  it('should identify ZodError correctly', () => {
    const schema = z.string();
    const result = schema.safeParse(123);
    if (!result.success) {
      expect(isZodError(result.error)).toBe(true);
    }
  });

  it('should return false for non-ZodError', () => {
    expect(isZodError(new Error('test'))).toBe(false);
    expect(isZodError('string')).toBe(false);
    expect(isZodError(null)).toBe(false);
  });
});

describe('formatZodError', () => {
  it('should format simple errors', () => {
    const schema = z.object({
      name: z.string().min(3),
      age: z.number().positive(),
    });
    const result = schema.safeParse({ name: 'ab', age: -1 });
    if (!result.success) {
      const formatted = formatZodError(result.error);
      expect(formatted).toContain('name');
      expect(formatted).toContain('age');
    }
  });

  it('should handle nested paths', () => {
    const schema = z.object({
      user: z.object({
        email: z.string().email(),
      }),
    });
    const result = schema.safeParse({ user: { email: 'invalid' } });
    if (!result.success) {
      const formatted = formatZodError(result.error);
      expect(formatted).toContain('user.email');
    }
  });
});

describe('formatZodErrorToObject', () => {
  it('should convert errors to object', () => {
    const schema = z.object({
      name: z.string().min(3),
      age: z.number().positive(),
    });
    const result = schema.safeParse({ name: 'ab', age: -1 });
    if (!result.success) {
      const obj = formatZodErrorToObject(result.error);
      expect(obj).toHaveProperty('name');
      expect(obj).toHaveProperty('age');
      expect(typeof obj.name).toBe('string');
      expect(typeof obj.age).toBe('string');
    }
  });
});

describe('flattenZodErrors', () => {
  it('should flatten errors to array', () => {
    const schema = z.object({
      name: z.string().min(3),
      age: z.number().positive(),
    });
    const result = schema.safeParse({ name: 'ab', age: -1 });
    if (!result.success) {
      const flattened = flattenZodErrors(result.error);
      expect(Array.isArray(flattened)).toBe(true);
      expect(flattened.length).toBeGreaterThan(0);
    }
  });
});

describe('validateOrThrow', () => {
  it('should return data for valid input', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });
    const data = validateOrThrow(schema, { name: 'John', age: 30 });
    expect(data).toEqual({ name: 'John', age: 30 });
  });

  it('should throw for invalid input', () => {
    const schema = z.object({
      name: z.string().min(3),
    });
    expect(() => validateOrThrow(schema, { name: 'ab' })).toThrow();
  });
});

describe('validateWithData', () => {
  it('should return success for valid input', () => {
    const schema = z.object({
      name: z.string().min(3),
    });
    const result = validateWithData(schema, { name: 'John' });
    if (result.success) {
      expect(result.data).toEqual({ name: 'John' });
    } else {
      throw new Error('Expected success');
    }
  });

  it('should return errors for invalid input', () => {
    const schema = z.object({
      name: z.string().min(3),
    });
    const result = validateWithData(schema, { name: 'ab' });
    if (result.success) {
      throw new Error('Expected failure');
    } else {
      expect(result.errors).toHaveProperty('name');
    }
  });
});

describe('getFirstZodError', () => {
  it('should return first error message', () => {
    const schema = z.object({
      name: z.string().min(3),
      age: z.number().positive(),
    });
    const result = schema.safeParse({ name: 'ab', age: -1 });
    if (!result.success) {
      const firstError = getFirstZodError(result.error);
      expect(typeof firstError).toBe('string');
      expect(firstError?.length).toBeGreaterThan(0);
    }
  });

  it('should return undefined for empty errors', () => {
    const error = new z.ZodError([]);
    expect(getFirstZodError(error)).toBeUndefined();
  });
});

describe('parseEnvBoolean', () => {
  it('should parse true values', () => {
    expect(parseEnvBoolean('true')).toBe(true);
    expect(parseEnvBoolean('1')).toBe(true);
    expect(parseEnvBoolean('yes')).toBe(true);
    expect(parseEnvBoolean('on')).toBe(true);
  });

  it('should parse false values', () => {
    expect(parseEnvBoolean('false')).toBe(false);
    expect(parseEnvBoolean('0')).toBe(false);
    expect(parseEnvBoolean('no')).toBe(false);
  });

  it('should return default for undefined', () => {
    expect(parseEnvBoolean(undefined, true)).toBe(true);
    expect(parseEnvBoolean(undefined, false)).toBe(false);
  });
});

describe('parseEnvNumber', () => {
  it('should parse valid numbers', () => {
    expect(parseEnvNumber('123')).toBe(123);
    expect(parseEnvNumber('0')).toBe(0);
    expect(parseEnvNumber('-1')).toBe(-1);
  });

  it('should return undefined for invalid values', () => {
    expect(parseEnvNumber('abc')).toBeUndefined();
    expect(parseEnvNumber('')).toBeUndefined();
    expect(parseEnvNumber(undefined)).toBeUndefined();
  });
});

describe('parseEnvJson', () => {
  it('should parse valid JSON', () => {
    expect(parseEnvJson('{"key":"value"}')).toEqual({ key: 'value' });
    expect(parseEnvJson('[1,2,3]')).toEqual([1, 2, 3]);
    expect(parseEnvJson('"string"')).toBe('string');
  });

  it('should return undefined for invalid JSON', () => {
    expect(parseEnvJson('not json')).toBeUndefined();
    expect(parseEnvJson('')).toBeUndefined();
    expect(parseEnvJson(undefined)).toBeUndefined();
  });
});

describe('validatePartial', () => {
  it('should allow partial updates', () => {
    const schema = z.object({
      name: z.string().min(3),
      age: z.number().positive(),
      email: z.string().email(),
    });
    const partial = validatePartial(schema, { name: 'John' });
    expect(partial).toHaveProperty('name', 'John');
    expect(partial).not.toHaveProperty('age');
  });
});
