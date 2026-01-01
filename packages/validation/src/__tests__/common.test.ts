/**
 * Tests for common validation schemas
 */

import { describe, expect, it } from 'vitest';
import {
  nonEmptyString,
  uuidSchema,
  urlSchema,
  emailSchema,
  repoIdentifierSchema,
  positiveIntSchema,
  paginationSchema,
  tagSchema,
  semverSchema,
  hexColorSchema,
  environmentSchema,
  logLevelSchema,
  idSchema,
} from '../common/index.js';

describe('nonEmptyString', () => {
  it('should accept valid non-empty strings', () => {
    expect(nonEmptyString.parse('hello')).toBe('hello');
    expect(nonEmptyString.parse('  hello  ')).toBe('hello'); // trimmed
  });

  it('should reject empty strings', () => {
    expect(() => nonEmptyString.parse('')).toThrow();
    expect(() => nonEmptyString.parse('   ')).toThrow(); // whitespace only
  });
});

describe('uuidSchema', () => {
  it('should accept valid UUIDs', () => {
    expect(uuidSchema.parse('550e8400-e29b-41d4-a716-446655440000')).toBe(
      '550e8400-e29b-41d4-a716-446655440000'
    );
  });

  it('should reject invalid UUIDs', () => {
    expect(() => uuidSchema.parse('not-a-uuid')).toThrow();
    expect(() => uuidSchema.parse('550e8400-e29b-41d4-a716')).toThrow();
  });
});

describe('urlSchema', () => {
  it('should accept valid URLs', () => {
    expect(urlSchema.parse('https://example.com')).toBe('https://example.com');
    expect(urlSchema.parse('http://localhost:3000')).toBe('http://localhost:3000');
  });

  it('should reject invalid URLs', () => {
    expect(() => urlSchema.parse('not-a-url')).toThrow();
    expect(() => urlSchema.parse('example.com')).toThrow(); // missing protocol
  });
});

describe('emailSchema', () => {
  it('should accept valid emails', () => {
    expect(emailSchema.parse('user@example.com')).toBe('user@example.com');
    expect(emailSchema.parse('test.user+tag@domain.co.uk')).toBe('test.user+tag@domain.co.uk');
  });

  it('should reject invalid emails', () => {
    expect(() => emailSchema.parse('not-an-email')).toThrow();
    expect(() => emailSchema.parse('@example.com')).toThrow();
  });
});

describe('repoIdentifierSchema', () => {
  it('should accept valid repo identifiers', () => {
    expect(repoIdentifierSchema.parse('owner/repo')).toBe('owner/repo');
    expect(repoIdentifierSchema.parse('duyet/duyetbot-agent')).toBe('duyet/duyetbot-agent');
    expect(repoIdentifierSchema.parse('user_name/repo.name')).toBe('user_name/repo.name');
  });

  it('should reject invalid identifiers', () => {
    expect(() => repoIdentifierSchema.parse('owner')).toThrow();
    expect(() => repoIdentifierSchema.parse('owner/repo/extra')).toThrow();
  });
});

describe('positiveIntSchema', () => {
  it('should accept positive integers', () => {
    expect(positiveIntSchema.parse(1)).toBe(1);
    expect(positiveIntSchema.parse(100)).toBe(100);
  });

  it('should reject non-positive values', () => {
    expect(() => positiveIntSchema.parse(0)).toThrow();
    expect(() => positiveIntSchema.parse(-1)).toThrow();
    expect(() => positiveIntSchema.parse(1.5)).toThrow(); // not integer
  });
});

describe('paginationSchema', () => {
  it('should accept valid pagination params', () => {
    const result = paginationSchema.parse({ page: 2, limit: 50 });
    expect(result.page).toBe(2);
    expect(result.limit).toBe(50);
  });

  it('should apply defaults', () => {
    const result = paginationSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.sortOrder).toBe('asc');
  });
});

describe('tagSchema', () => {
  it('should accept valid tags', () => {
    expect(tagSchema.parse('tag1')).toBe('tag1');
    expect(tagSchema.parse('my-tag')).toBe('my-tag');
    expect(tagSchema.parse('my_tag')).toBe('my_tag');
  });

  it('should reject invalid tags', () => {
    expect(() => tagSchema.parse('tag with spaces')).toThrow();
    expect(() => tagSchema.parse('tag.with.dots')).toThrow();
  });
});

describe('semverSchema', () => {
  it('should accept valid semver', () => {
    expect(semverSchema.parse('1.0.0')).toBe('1.0.0');
    expect(semverSchema.parse('v2.1.3')).toBe('v2.1.3');
    expect(semverSchema.parse('1.0.0-alpha')).toBe('1.0.0-alpha');
  });

  it('should reject invalid semver', () => {
    expect(() => semverSchema.parse('1.0')).toThrow();
    expect(() => semverSchema.parse('invalid')).toThrow();
  });
});

describe('hexColorSchema', () => {
  it('should accept valid hex colors', () => {
    expect(hexColorSchema.parse('#fff')).toBe('#fff');
    expect(hexColorSchema.parse('#FFFFFF')).toBe('#FFFFFF');
    expect(hexColorSchema.parse('#abc123')).toBe('#abc123');
  });

  it('should reject invalid colors', () => {
    expect(() => hexColorSchema.parse('fff')).toThrow(); // missing #
    expect(() => hexColorSchema.parse('#ggg')).toThrow(); // invalid hex
  });
});

describe('environmentSchema', () => {
  it('should accept valid environment names', () => {
    expect(environmentSchema.parse('development')).toBe('development');
    expect(environmentSchema.parse('dev')).toBe('dev');
    expect(environmentSchema.parse('production')).toBe('production');
    expect(environmentSchema.parse('prod')).toBe('prod');
  });

  it('should reject invalid environment names', () => {
    expect(() => environmentSchema.parse('invalid')).toThrow();
  });
});

describe('logLevelSchema', () => {
  it('should accept valid log levels', () => {
    expect(logLevelSchema.parse('debug')).toBe('debug');
    expect(logLevelSchema.parse('info')).toBe('info');
    expect(logLevelSchema.parse('error')).toBe('error');
  });

  it('should reject invalid log levels', () => {
    expect(() => logLevelSchema.parse('invalid')).toThrow();
  });
});

describe('idSchema', () => {
  it('should accept valid IDs', () => {
    expect(idSchema.parse('abc123')).toBe('abc123');
    expect(idSchema.parse('user-123_name')).toBe('user-123_name');
  });

  it('should reject invalid IDs', () => {
    expect(() => idSchema.parse('')).toThrow();
    expect(() => idSchema.parse('id with spaces')).toThrow();
    expect(() => idSchema.parse('id.with.dots')).toThrow();
  });
});
