/**
 * Common validation schemas
 *
 * Reusable Zod schemas for common validation patterns across the codebase.
 */

import { z } from 'zod';

/**
 * Non-empty string schema
 * Validates that a string is not empty after trimming
 */
export const nonEmptyString = z
  .string()
  .min(1, 'Value is required')
  .transform((val: string) => val.trim())
  .refine((val: string) => val.length > 0, 'Value cannot be empty or whitespace only');

/**
 * UUID schema
 * Validates standard UUID v4 format
 */
export const uuidSchema = z.string().uuid('Invalid UUID format');

/**
 * URL schema
 * Validates URL format with optional requirement
 */
export const urlSchema = z.string().url('Invalid URL format');

/**
 * Optional URL schema that handles empty strings as undefined
 * Useful for optional environment variables that might be empty strings
 */
export const optionalUrlSchema = z
  .string()
  .url()
  .optional()
  .or(z.literal(''))
  .transform((val: string | undefined) => (val === '' ? undefined : val));

/**
 * Email schema
 * Validates email address format
 */
export const emailSchema = z.string().min(1, 'Email is required').email('Invalid email address');

/**
 * Repository identifier schema
 * Validates "owner/name" format for GitHub repositories
 */
export const repoIdentifierSchema = z
  .string()
  .regex(/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9._-]+$/, 'Repository must be in "owner/name" format');

/**
 * File path schema
 * Validates non-empty file paths
 */
export const filePathSchema = z.string().min(1, 'File path is required');

/**
 * Encoding type schema for file operations
 */
export const encodingSchema = z.enum(['utf-8', 'ascii', 'utf-16le', 'ucs2', 'base64', 'latin1']);

/**
 * Positive integer schema
 * Validates a positive integer (> 0)
 */
export const positiveIntSchema = z.number().int().positive('Value must be a positive integer');

/**
 * Non-negative integer schema
 * Validates an integer >= 0
 */
export const nonNegativeIntSchema = z.number().int().nonnegative('Value must be non-negative');

/**
 * Port number schema
 * Validates port numbers (1-65535)
 */
export const portSchema = z
  .number()
  .int()
  .min(1, 'Port must be between 1 and 65535')
  .max(65535, 'Port must be between 1 and 65535');

/**
 * Boolean string schema
 * Parses common boolean string representations
 */
export const booleanStringSchema = z
  .string()
  .toLowerCase()
  .transform((val: string) => val === 'true' || val === '1' || val === 'yes');

/**
 * Enum values schema
 * Validates array of enum values for configuration
 */
export const enumValuesSchema = <T extends readonly [string, ...string[]]>(values: T) =>
  z.array(z.enum(values));

/**
 * Pagination schema
 * Common pagination parameters
 */
export const paginationSchema = z.object({
  page: positiveIntSchema.optional().default(1),
  limit: positiveIntSchema.optional().default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
});

/**
 * Timestamp schema
 * Validates Unix timestamp (seconds since epoch)
 */
export const timestampSchema = z
  .number()
  .int()
  .nonnegative()
  .refine((val) => val <= 2147483647, 'Timestamp out of valid range');

/**
 * Date range schema
 * Validates start and end dates
 */
export const dateRangeSchema = z
  .object({
    start: timestampSchema.optional(),
    end: timestampSchema.optional(),
  })
  .refine(
    (val) => !val.start || !val.end || val.start <= val.end,
    'Start date must be before end date'
  );

/**
 * Tag schema
 * Validates tag strings (alphanumeric, hyphens, underscores)
 */
export const tagSchema = z
  .string()
  .regex(/^[a-zA-Z0-9_-]+$/, 'Tags must be alphanumeric with hyphens or underscores');

/**
 * SemVer schema
 * Basic semantic version validation
 */
export const semverSchema = z
  .string()
  .regex(/^v?\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?(\+[a-zA-Z0-9.]+)?$/, 'Invalid semantic version format');

/**
 * Hex color schema
 * Validates hex color codes (#RRGGBB or #RGB)
 */
export const hexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$/, 'Invalid hex color format');

/**
 * MIME type schema
 * Validates MIME type strings
 */
export const mimeTypeSchema = z
  .string()
  .regex(
    /^[a-zA-Z0-9][a-zA-Z0-9!#$&\-^_]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-^_]*$/,
    'Invalid MIME type format'
  );

/**
 * Environment name schema
 * Validates environment names (dev, staging, prod, etc.)
 */
export const environmentSchema = z.enum([
  'development',
  'dev',
  'staging',
  'stage',
  'production',
  'prod',
  'test',
  'testing',
]);

/**
 * Log level schema
 * Validates standard log levels
 */
export const logLevelSchema = z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']);

/**
 * ISO 8601 date string schema
 * Validates ISO 8601 date format
 */
export const isoDateStringSchema = z.string().datetime('Invalid ISO 8601 date format');

/**
 * Generic ID schema
 * Validates common ID formats (UUID or alphanumeric)
 */
export const idSchema = z
  .string()
  .min(1, 'ID is required')
  .regex(/^[a-zA-Z0-9_-]+$/, 'ID must be alphanumeric with hyphens or underscores');

/**
 * Coordinate schema
 * Validates latitude/longitude coordinates
 */
export const coordinateSchema = z
  .number()
  .min(-180)
  .max(180)
  .refine((val: number) => Math.abs(val) <= 90, 'Invalid coordinate range');

/**
 * Geo location schema
 */
export const geoLocationSchema = z.object({
  latitude: coordinateSchema,
  longitude: coordinateSchema,
});

// Type exports
export type NonEmptyString = z.infer<typeof nonEmptyString>;
export type Uuid = z.infer<typeof uuidSchema>;
export type Url = z.infer<typeof urlSchema>;
export type Email = z.infer<typeof emailSchema>;
export type RepoIdentifier = z.infer<typeof repoIdentifierSchema>;
export type FilePath = z.infer<typeof filePathSchema>;
export type Encoding = z.infer<typeof encodingSchema>;
export type PositiveInt = z.infer<typeof positiveIntSchema>;
export type Pagination = z.infer<typeof paginationSchema>;
export type Timestamp = z.infer<typeof timestampSchema>;
export type DateRange = z.infer<typeof dateRangeSchema>;
export type Tag = z.infer<typeof tagSchema>;
export type Semver = z.infer<typeof semverSchema>;
export type HexColor = z.infer<typeof hexColorSchema>;
export type MimeType = z.infer<typeof mimeTypeSchema>;
export type Environment = z.infer<typeof environmentSchema>;
export type LogLevel = z.infer<typeof logLevelSchema>;
export type IsoDateString = z.infer<typeof isoDateStringSchema>;
export type Id = z.infer<typeof idSchema>;
export type Coordinate = z.infer<typeof coordinateSchema>;
export type GeoLocation = z.infer<typeof geoLocationSchema>;
