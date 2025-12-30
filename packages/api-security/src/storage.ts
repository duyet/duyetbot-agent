/**
 * D1 Storage for API Keys
 *
 * Database schema and CRUD operations for API key management.
 */

import type { D1Database } from '@cloudflare/workers-types';
import { createAPIKeyRecord, rotateAPIKey, validateAPIKey } from './api-keys.js';
import type { APIKeyRecord, KeyValidationResult, RotationOptions } from './types.js';

/**
 * D1 schema for API key storage
 */
export const API_KEYS_SCHEMA = `
-- API keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  key_id TEXT NOT NULL UNIQUE,
  key_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  last_used_at INTEGER NOT NULL DEFAULT 0,
  usage_count INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  replaces_id TEXT,
  FOREIGN KEY (replaces_id) REFERENCES api_keys(id) ON DELETE SET NULL
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_api_keys_key_id ON api_keys(key_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_api_keys_created_by ON api_keys(created_by);
CREATE INDEX IF NOT EXISTS idx_api_keys_replaces ON api_keys(replaces_id);

-- Audit log for key operations
CREATE TABLE IF NOT EXISTS api_key_audit_log (
  id TEXT PRIMARY KEY,
  key_id TEXT NOT NULL,
  action TEXT NOT NULL, -- created, rotated, revoked, expired, used
  performed_by TEXT,
  performed_at INTEGER NOT NULL,
  metadata TEXT, -- JSON metadata
  FOREIGN KEY (key_id) REFERENCES api_keys(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_audit_log_key_id ON api_key_audit_log(key_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON api_key_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_performed_at ON api_key_audit_log(performed_at);
`;

/**
 * Initialize API keys storage
 *
 * Creates tables if they don't exist.
 *
 * @param db - D1 database binding
 */
export async function initializeAPIKeysStorage(db: D1Database): Promise<void> {
  await db.batch([db.prepare(API_KEYS_SCHEMA)]);
}

/**
 * Create API key in database
 *
 * @param db - D1 database binding
 * @param name - Key name/description
 * @param createdBy - Key creator
 * @param options - Creation options
 * @returns Created API key (plaintext) and record
 */
export async function createAPIKey(
  db: D1Database,
  name: string,
  createdBy: string,
  options: {
    version?: number;
    expiresAt?: number;
    replacesId?: string;
  } = {}
): Promise<{ apiKey: string; record: APIKeyRecord }> {
  const { apiKey, record: baseRecord } = await createAPIKeyRecord(name, createdBy, options);

  // Generate ID
  const id = crypto.randomUUID();

  // Insert into database
  await db
    .prepare(
      `
      INSERT INTO api_keys (
        id, key_id, key_hash, name, created_by, created_at,
        expires_at, is_active, last_used_at, usage_count, version, replaces_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    )
    .bind(
      id,
      baseRecord.keyId,
      baseRecord.keyHash,
      baseRecord.name,
      baseRecord.createdBy,
      baseRecord.createdAt,
      baseRecord.expiresAt,
      baseRecord.isActive ? 1 : 0,
      baseRecord.lastUsedAt,
      baseRecord.usageCount,
      baseRecord.version,
      baseRecord.replacesId ?? null
    )
    .run();

  // Log audit event
  await logAuditEvent(db, baseRecord.keyId, 'created', createdBy, {
    name,
    version: baseRecord.version,
  });

  const record: APIKeyRecord = { ...baseRecord, id };
  return { apiKey, record };
}

/**
 * Validate API key and update usage stats
 *
 * @param db - D1 database binding
 * @param apiKey - API key to validate
 * @returns Validation result
 */
export async function validateAndUpdateAPIKey(
  db: D1Database,
  apiKey: string
): Promise<KeyValidationResult> {
  // Generate key ID from API key
  const encoder = new TextEncoder();
  const parsed = apiKey.match(/^sk_(\d+)_([a-f0-9]+)_([a-f0-9]+)$/);
  if (!parsed) {
    return { valid: false, error: 'KEY_FORMAT_INVALID' };
  }

  const randomHex = parsed[2];
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(randomHex));
  const keyId = Array.from(new Uint8Array(hashBuffer).slice(0, 16))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Fetch record from database
  const result = await db
    .prepare(
      `
      SELECT id, key_id, key_hash, name, created_by, created_at, expires_at,
             is_active, last_used_at, usage_count, version, replaces_id
      FROM api_keys
      WHERE key_id = ?
    `
    )
    .bind(keyId)
    .first<{
      id: string;
      key_id: string;
      key_hash: string;
      name: string;
      created_by: string;
      created_at: number;
      expires_at: number;
      is_active: number;
      last_used_at: number;
      usage_count: number;
      version: number;
      replaces_id: string | null;
    }>();

  if (!result) {
    return { valid: false, error: 'KEY_NOT_FOUND' };
  }

  const record: APIKeyRecord = {
    id: result.id,
    keyId: result.key_id,
    keyHash: result.key_hash,
    name: result.name,
    createdBy: result.created_by,
    createdAt: result.created_at,
    expiresAt: result.expires_at,
    isActive: result.is_active === 1,
    lastUsedAt: result.last_used_at,
    usageCount: result.usage_count,
    version: result.version,
    replacesId: result.replaces_id ?? undefined,
  };

  // Validate key
  const validation = await validateAPIKey(apiKey, record);
  if (!validation.valid) {
    return validation;
  }

  // Update usage stats
  const now = Date.now();
  await db
    .prepare(
      `
      UPDATE api_keys
      SET last_used_at = ?, usage_count = usage_count + 1
      WHERE id = ?
    `
    )
    .bind(now, record.id)
    .run();

  // Update record in memory
  record.lastUsedAt = now;
  record.usageCount++;

  // Log audit event
  await logAuditEvent(db, record.keyId, 'used', undefined, {
    userAgent: 'api_call',
  });

  return { valid: true, record };
}

/**
 * Rotate API key
 *
 * Creates a new key and marks the old one for expiration.
 *
 * @param db - D1 database binding
 * @param oldKeyId - ID of key to rotate
 * @param options - Rotation options
 * @returns New API key and record
 */
export async function rotateAPIKeyInStorage(
  db: D1Database,
  oldKeyId: string,
  options: Partial<RotationOptions> = {}
): Promise<{ apiKey: string; record: APIKeyRecord; oldRecord: APIKeyRecord }> {
  // Resolve options with defaults
  const resolvedOptions: Required<RotationOptions> = {
    gracePeriodMs: options.gracePeriodMs ?? 7 * 24 * 60 * 60 * 1000, // 7 days
    autoRevoke: options.autoRevoke ?? true,
    onRotation:
      options.onRotation ??
      (() => {
        // Default no-op callback
      }),
  };
  // Fetch old record
  const oldResult = await db.prepare('SELECT * FROM api_keys WHERE id = ?').bind(oldKeyId).first();

  if (!oldResult) {
    throw new Error('API key not found');
  }

  const oldRecord: APIKeyRecord = {
    id: oldResult.id as string,
    keyId: oldResult.key_id as string,
    keyHash: oldResult.key_hash as string,
    name: oldResult.name as string,
    createdBy: oldResult.created_by as string,
    createdAt: oldResult.created_at as number,
    expiresAt: oldResult.expires_at as number,
    isActive: oldResult.is_active === 1,
    lastUsedAt: oldResult.last_used_at as number,
    usageCount: oldResult.usage_count as number,
    version: oldResult.version as number,
    replacesId: (oldResult.replaces_id as string | null) ?? undefined,
  };

  // Rotate key
  const {
    apiKey,
    record: newBaseRecord,
    oldRecordId,
  } = await rotateAPIKey(oldRecord, resolvedOptions);

  // Create new key record
  const newId = crypto.randomUUID();
  await db
    .prepare(
      `
      INSERT INTO api_keys (
        id, key_id, key_hash, name, created_by, created_at,
        expires_at, is_active, last_used_at, usage_count, version, replaces_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    )
    .bind(
      newId,
      newBaseRecord.keyId,
      newBaseRecord.keyHash,
      newBaseRecord.name,
      newBaseRecord.createdBy,
      newBaseRecord.createdAt,
      newBaseRecord.expiresAt,
      newBaseRecord.isActive ? 1 : 0,
      newBaseRecord.lastUsedAt,
      newBaseRecord.usageCount,
      newBaseRecord.version,
      newBaseRecord.replacesId ?? null
    )
    .run();

  // Update old key to expire after grace period
  const expirationTime = Date.now() + resolvedOptions.gracePeriodMs;
  await db
    .prepare('UPDATE api_keys SET expires_at = ?, is_active = 0 WHERE id = ?')
    .bind(expirationTime, oldRecordId)
    .run();

  const newRecord: APIKeyRecord = { ...newBaseRecord, id: newId };

  // Log audit events
  await logAuditEvent(db, oldRecord.keyId, 'rotated', oldRecord.createdBy, {
    newKeyId: newRecord.keyId,
    gracePeriodMs: resolvedOptions.gracePeriodMs,
  });
  await logAuditEvent(db, newRecord.keyId, 'created', newRecord.createdBy, {
    name: newRecord.name,
    version: newRecord.version,
    rotation: true,
  });

  return { apiKey, record: newRecord, oldRecord };
}

/**
 * Revoke API key
 *
 * @param db - D1 database binding
 * @param keyId - ID of key to revoke
 * @param revokedBy - User performing the revocation
 */
export async function revokeAPIKey(
  db: D1Database,
  keyId: string,
  revokedBy: string
): Promise<void> {
  await db.prepare('UPDATE api_keys SET is_active = 0 WHERE id = ?').bind(keyId).run();

  // Log audit event
  await logAuditEvent(db, keyId, 'revoked', revokedBy);
}

/**
 * Get API key by ID
 *
 * @param db - D1 database binding
 * @param keyId - API key ID
 * @returns API key record or null
 */
export async function getAPIKey(db: D1Database, keyId: string): Promise<APIKeyRecord | null> {
  const result = await db
    .prepare(
      `
      SELECT id, key_id, key_hash, name, created_by, created_at, expires_at,
             is_active, last_used_at, usage_count, version, replaces_id
      FROM api_keys
      WHERE id = ?
    `
    )
    .bind(keyId)
    .first();

  if (!result) {
    return null;
  }

  return {
    id: result.id as string,
    keyId: result.key_id as string,
    keyHash: result.key_hash as string,
    name: result.name as string,
    createdBy: result.created_by as string,
    createdAt: result.created_at as number,
    expiresAt: result.expires_at as number,
    isActive: result.is_active === 1,
    lastUsedAt: result.last_used_at as number,
    usageCount: result.usage_count as number,
    version: result.version as number,
    replacesId: (result.replaces_id as string | null) ?? undefined,
  };
}

/**
 * List API keys with filters
 *
 * @param db - D1 database binding
 * @param options - Filter options
 * @returns List of API key records
 */
export async function listAPIKeys(
  db: D1Database,
  options: {
    createdBy?: string;
    activeOnly?: boolean;
    includeExpired?: boolean;
    limit?: number;
    offset?: number;
  } = {}
): Promise<APIKeyRecord[]> {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (options.createdBy) {
    conditions.push('created_by = ?');
    params.push(options.createdBy);
  }

  if (options.activeOnly) {
    conditions.push('is_active = 1');
  }

  if (!options.includeExpired) {
    conditions.push('(expires_at = 0 OR expires_at > ?)');
    params.push(Date.now());
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limitClause = options.limit ? `LIMIT ${options.limit}` : '';
  const offsetClause = options.offset ? `OFFSET ${options.offset}` : '';

  const query = `
    SELECT id, key_id, key_hash, name, created_by, created_at, expires_at,
           is_active, last_used_at, usage_count, version, replaces_id
    FROM api_keys
    ${whereClause}
    ORDER BY created_at DESC
    ${limitClause}
    ${offsetClause}
  `;

  const results = await db
    .prepare(query)
    .bind(...params)
    .all();

  return (results.results || []).map((row: any) => ({
    id: row.id,
    keyId: row.key_id,
    keyHash: row.key_hash,
    name: row.name,
    createdBy: row.created_by,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    isActive: row.is_active === 1,
    lastUsedAt: row.last_used_at,
    usageCount: row.usage_count,
    version: row.version,
    replacesId: row.replaces_id,
  }));
}

/**
 * Log audit event for API key operations
 *
 * @param db - D1 database binding
 * @param keyId - API key identifier
 * @param action - Action performed
 * @param performedBy - User who performed the action
 * @param metadata - Additional metadata
 */
async function logAuditEvent(
  db: D1Database,
  keyId: string,
  action: string,
  performedBy: string | undefined,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const id = crypto.randomUUID();
  const now = Date.now();

  await db
    .prepare(
      `
      INSERT INTO api_key_audit_log (id, key_id, action, performed_by, performed_at, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `
    )
    .bind(id, keyId, action, performedBy ?? null, now, JSON.stringify(metadata))
    .run();
}

/**
 * Get audit log for API key
 *
 * @param db - D1 database binding
 * @param keyId - API key ID
 * @param limit - Maximum number of entries
 * @returns Audit log entries
 */
export async function getAPIKeyAuditLog(
  db: D1Database,
  keyId: string,
  limit = 100
): Promise<
  Array<{
    id: string;
    keyId: string;
    action: string;
    performedBy: string | null;
    performedAt: number;
    metadata: unknown;
  }>
> {
  const results = await db
    .prepare(
      `
      SELECT id, key_id, action, performed_by, performed_at, metadata
      FROM api_key_audit_log
      WHERE key_id = ?
      ORDER BY performed_at DESC
      LIMIT ?
    `
    )
    .bind(keyId, limit)
    .all();

  return (results.results || []).map((row: any) => ({
    id: row.id,
    keyId: row.key_id,
    action: row.action,
    performedBy: row.performed_by,
    performedAt: row.performed_at,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
  }));
}

/**
 * Check for keys that need rotation
 *
 * @param db - D1 database binding
 * @param maxAge - Maximum age in milliseconds
 * @returns List of keys that need rotation
 */
export async function checkKeysNeedingRotation(
  db: D1Database,
  maxAge = 90 * 24 * 60 * 60 * 1000
): Promise<APIKeyRecord[]> {
  const cutoffTime = Date.now() - maxAge;

  const results = await db
    .prepare(
      `
      SELECT id, key_id, key_hash, name, created_by, created_at, expires_at,
             is_active, last_used_at, usage_count, version, replaces_id
      FROM api_keys
      WHERE created_at < ?
        AND is_active = 1
      ORDER BY created_at ASC
    `
    )
    .bind(cutoffTime)
    .all();

  return (results.results || []).map((row: any) => ({
    id: row.id,
    keyId: row.key_id,
    keyHash: row.key_hash,
    name: row.name,
    createdBy: row.created_by,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    isActive: row.is_active === 1,
    lastUsedAt: row.last_used_at,
    usageCount: row.usage_count,
    version: row.version,
    replacesId: row.replaces_id,
  }));
}
