/**
 * API Key Management
 *
 * Utilities for creating, validating, and rotating API keys.
 * Uses SHA-256 hashing for secure key storage.
 */

import type { APIKeyRecord, KeyValidationResult, RotationOptions } from './types.js';

/**
 * Generate a secure random API key
 *
 * Format: sk_{version}_{random}_{checksum}
 * - version: Key version number
 * - random: 32 cryptographically random bytes (hex encoded)
 * - checksum: CRC-32 checksum for validation
 *
 * @returns API key string
 */
export function generateAPIKey(version = 1): string {
  // Generate 32 random bytes (256 bits)
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);

  // Convert to hex string
  const randomHex = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Generate checksum (simple CRC-32-like)
  const checksum = generateChecksum(randomHex);

  // Format: sk_{version}_{random}_{checksum}
  return `sk_${version}_${randomHex}_${checksum}`;
}

/**
 * Generate simple checksum for API key validation
 *
 * @param data - Data to checksum
 * @returns Hex checksum string
 */
function generateChecksum(data: string): string {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum = (sum + data.charCodeAt(i)) >>> 0; // Keep as 32-bit unsigned
  }
  return sum.toString(16).padStart(8, '0');
}

/**
 * Validate API key format and checksum
 *
 * @param apiKey - API key to validate
 * @returns true if format is valid
 */
export function validateAPIKeyFormat(apiKey: string): boolean {
  // Format: sk_{version}_{random}_{checksum}
  const match = apiKey.match(/^sk_(\d+)_([a-f0-9]+)_([a-f0-9]+)$/);
  if (!match) {
    return false;
  }

  const randomHex = match[2] ?? '';
  const checksum = match[3] ?? '';

  // Verify checksum
  const expectedChecksum = generateChecksum(randomHex);
  return checksum === expectedChecksum;
}

/**
 * Parse API key components
 *
 * @param apiKey - API key to parse
 * @returns Parsed components or undefined if invalid
 */
export function parseAPIKey(apiKey: string): { version: number; randomHex: string } | undefined {
  if (!validateAPIKeyFormat(apiKey)) {
    return undefined;
  }

  const match = apiKey.match(/^sk_(\d+)_([a-f0-9]+)_([a-f0-9]+)$/);
  if (!match) {
    return undefined;
  }

  const version = Number.parseInt(match[1] ?? '1', 10);
  const randomHex = match[2] ?? '';

  return { version, randomHex };
}

/**
 * Generate key ID from API key
 *
 * The key ID is a truncated SHA-256 hash used for lookups.
 * It cannot be used to derive the original key.
 *
 * @param apiKey - API key
 * @returns Key ID (hex string)
 */
export async function generateKeyId(apiKey: string): Promise<string> {
  const parsed = parseAPIKey(apiKey);
  if (!parsed) {
    throw new Error('Invalid API key format');
  }

  // Hash the random portion only (version-independent)
  const encoder = new TextEncoder();
  const data = encoder.encode(parsed.randomHex);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);

  // Return first 16 bytes as key ID (32 hex chars)
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray.slice(0, 16))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate secure hash of API key for storage
 *
 * Uses SHA-256 with key ID as salt.
 *
 * @param apiKey - API key to hash
 * @returns SHA-256 hash (hex string)
 */
export async function hashAPIKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);

  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Create API key record for database storage
 *
 * @param name - Key name/description
 * @param createdBy - Key creator
 * @param options - Creation options
 * @returns API key and record
 */
export async function createAPIKeyRecord(
  name: string,
  createdBy: string,
  options: {
    /** Key version */
    version?: number;
    /** Expiration time (0 = no expiration) */
    expiresAt?: number;
    /** ID of key this replaces (for rotation) */
    replacesId?: string;
  } = {}
): Promise<{ apiKey: string; record: Omit<APIKeyRecord, 'id'> }> {
  const version = options.version ?? 1;
  const expiresAt = options.expiresAt ?? 0;
  const now = Date.now();

  // Generate the actual API key
  const apiKey = generateAPIKey(version);

  // Generate key ID and hash
  const keyId = await generateKeyId(apiKey);
  const keyHash = await hashAPIKey(apiKey);

  // Create record (without ID - database will assign)
  const record: Omit<APIKeyRecord, 'id'> = {
    keyId,
    keyHash,
    name,
    createdBy,
    createdAt: now,
    expiresAt,
    isActive: true,
    lastUsedAt: 0,
    usageCount: 0,
    version,
    replacesId: options.replacesId,
  };

  return { apiKey, record };
}

/**
 * Validate API key against record
 *
 * @param apiKey - API key to validate
 * @param record - Database record
 * @returns Validation result
 */
export async function validateAPIKey(
  apiKey: string,
  record: APIKeyRecord
): Promise<KeyValidationResult> {
  // Check format
  if (!validateAPIKeyFormat(apiKey)) {
    return { valid: false, error: 'KEY_FORMAT_INVALID' };
  }

  // Check if active
  if (!record.isActive) {
    return { valid: false, error: 'KEY_REVOKED' };
  }

  // Check expiration
  if (record.expiresAt > 0 && Date.now() > record.expiresAt) {
    return { valid: false, error: 'KEY_EXPIRED' };
  }

  // Verify hash
  const keyHash = await hashAPIKey(apiKey);
  if (keyHash !== record.keyHash) {
    return { valid: false, error: 'KEY_NOT_FOUND' };
  }

  return { valid: true, record };
}

/**
 * Check if API key is ready for rotation
 *
 * Keys should be rotated every 90 days by default.
 *
 * @param record - API key record
 * @param maxAge - Maximum age in milliseconds (default: 90 days)
 * @returns true if key should be rotated
 */
export function shouldRotateKey(record: APIKeyRecord, maxAge = 90 * 24 * 60 * 60 * 1000): boolean {
  const now = Date.now();
  const keyAge = now - record.createdAt;
  return keyAge > maxAge;
}

/**
 * Rotate API key
 *
 * Creates a new key and marks the old one for expiration.
 *
 * @param oldRecord - Old API key record
 * @param options - Rotation options
 * @returns New API key and record
 */
export async function rotateAPIKey(
  oldRecord: APIKeyRecord,
  options: Partial<RotationOptions> = {}
): Promise<{ apiKey: string; record: Omit<APIKeyRecord, 'id'>; oldRecordId: string }> {
  const now = Date.now();

  // Resolve options with defaults
  const resolvedOptions: Required<RotationOptions> = {
    gracePeriodMs: options.gracePeriodMs ?? 7 * 24 * 60 * 60 * 1000, // 7 days
    autoRevoke: options.autoRevoke ?? true,
    onRotation: options.onRotation ?? (() => {}),
  };

  // Create new key with incremented version
  const { apiKey, record: newRecord } = await createAPIKeyRecord(
    oldRecord.name,
    oldRecord.createdBy,
    {
      version: oldRecord.version + 1,
      expiresAt: oldRecord.expiresAt === 0 ? 0 : now + (oldRecord.expiresAt - oldRecord.createdAt),
      replacesId: oldRecord.id,
    }
  );

  // Call rotation callback if provided
  if (resolvedOptions.onRotation) {
    await resolvedOptions.onRotation(oldRecord.keyId, newRecord.keyId);
  }

  return {
    apiKey,
    record: newRecord,
    oldRecordId: oldRecord.id,
  };
}
