/**
 * Validation helper utilities
 *
 * Utility functions for working with Zod validation.
 */

import { z } from 'zod';

/**
 * Check if error is a Zod validation error
 */
export function isZodError(error: unknown): error is z.ZodError {
  return error instanceof z.ZodError;
}

/**
 * Format Zod errors for display
 * Returns a human-readable string of validation errors
 */
export function formatZodError(error: z.ZodError): string {
  return error.errors
    .map((e: z.ZodIssue) => {
      const path = e.path.length > 0 ? e.path.join('.') : 'value';
      return `${path}: ${e.message}`;
    })
    .join(', ');
}

/**
 * Format Zod errors as an object
 * Returns an object with error paths as keys and messages as values
 */
export function formatZodErrorToObject(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const e of error.errors) {
    const path = e.path.length > 0 ? e.path.join('.') : 'value';
    result[path] = e.message;
  }
  return result;
}

/**
 * Flatten Zod errors to a single array
 * Returns all error messages as a flat array
 */
export function flattenZodErrors(error: z.ZodError): string[] {
  return error.errors.map((e: z.ZodIssue) => {
    const path = e.path.length > 0 ? `${e.path.join('.')}: ` : '';
    return `${path}${e.message}`;
  });
}

/**
 * Validate data with a schema and throw formatted error if invalid
 */
export function validateOrThrow<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(formatZodError(result.error));
  }
  return result.data;
}

/**
 * Validate data with a schema and return result with errors
 */
export function validateWithData<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: Record<string, string> } {
  const result = schema.safeParse(data);
  if (!result.success) {
    return { success: false, errors: formatZodErrorToObject(result.error) };
  }
  return { success: true, data: result.data };
}

/**
 * Parse environment variable as boolean
 * Handles common boolean string representations
 */
export function parseEnvBoolean(value: string | undefined, defaultValue = false): boolean {
  if (!value) {
    return defaultValue;
  }
  return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
}

/**
 * Parse environment variable as number
 * Returns undefined if invalid
 */
export function parseEnvNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * Parse environment variable as JSON
 * Returns undefined if invalid
 */
export function parseEnvJson<T>(value: string | undefined): T | undefined {
  if (!value) {
    return undefined;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

/**
 * Create a required string validator for environment variables
 * Throws a helpful error if the variable is missing
 */
export function requiredEnvVar(name: string) {
  return z
    .string()
    .min(1, `${name} is required`)
    .transform((val: string) => val.trim())
    .refine((val: string) => val.length > 0, `${name} cannot be empty`);
}

/**
 * Sanitize error messages to prevent sensitive data leakage
 * Removes values that might contain secrets from error messages
 */
export function sanitizeZodError(error: z.ZodError, sensitiveKeys: string[] = []): string {
  const sensitivePatterns = [
    /password/i,
    /secret/i,
    /token/i,
    /api[_-]?key/i,
    /auth/i,
    /credential/i,
    ...sensitiveKeys.map((key) => new RegExp(key, 'gi')),
  ];

  return error.errors
    .map((e) => {
      const path = e.path.join('.');
      let message = e.message;

      // Replace sensitive values in error messages
      for (const pattern of sensitivePatterns) {
        if (pattern.test(path) || pattern.test(message)) {
          message = '[REDACTED]';
        }
      }

      return `${path}: ${message}`;
    })
    .join(', ');
}

/**
 * Get first error message from Zod error
 * Useful for displaying a single validation error
 */
export function getFirstZodError(error: z.ZodError): string | undefined {
  if (error.errors.length === 0) {
    return undefined;
  }
  const first = error.errors[0] as z.ZodIssue | undefined;
  if (!first) {
    return undefined;
  }
  const path = first.path.length > 0 ? `${first.path.join('.')}: ` : '';
  return `${path}${first.message}`;
}

/**
 * Validate partial data with a schema
 * Useful for updates where only some fields are provided
 */
export function validatePartial<T extends z.ZodObject<any>>(schema: T, data: unknown): z.infer<T> {
  return schema.partial().parse(data) as z.infer<T>;
}

/**
 * Create a schema that requires at least one field
 * Useful for validation where at least one option must be provided
 */
export function requireAtLeastOne<T extends Record<string, z.ZodTypeAny>>(schemas: T) {
  const keys = Object.keys(schemas) as Array<keyof T>;
  const baseSchema = z.object(schemas);

  return baseSchema.refine(
    (data) => keys.some((key) => data[key] !== undefined && data[key] !== null),
    {
      message: `At least one of ${keys.join(', ')} must be provided`,
    }
  );
}
