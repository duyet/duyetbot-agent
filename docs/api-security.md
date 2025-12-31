---
title: API Security
description: API key rotation, signature verification, and rate limiting
---

# API Security Enhancements

## Overview

This document describes the API security enhancements implemented for the telegram-bot and github-bot applications. These enhancements provide:

1. **API Key Rotation Mechanism** - Automatic and manual API key rotation with grace periods
2. **Enhanced Webhook Signature Verification** - Timestamp validation to prevent replay attacks
3. **Per-API-Key Rate Limiting** - Durable rate limiting using D1 storage
4. **Request Throttling** - Concurrency limits and delays for expensive operations

## Architecture

The security features are implemented in a shared package `@duyetbot/api-security` that can be used across all applications.

```
packages/api-security/
├── src/
│   ├── types.ts           # Shared types
│   ├── api-keys.ts        # API key generation, validation, rotation
│   ├── signature.ts       # Enhanced webhook signature verification
│   ├── rate-limit.ts      # D1-based rate limiting
│   ├── throttle.ts        # In-memory request throttling
│   ├── storage.ts         # D1 storage operations
│   ├── middleware.ts      # Hono middleware wrappers
│   └── index.ts           # Public exports
└── package.json
```

## Features

### 1. API Key Management

#### API Key Format

API keys follow the format: `sk_{version}_{random}_{checksum}`

- `sk_` - Prefix for security identification
- `version` - Key version number (starts at 1)
- `random` - 32 cryptographically random bytes (64 hex chars)
- `checksum` - CRC-32 checksum for validation (8 hex chars)

Example: `sk_1_a1b2c3d4e5f6..._12345678`

#### Key Rotation

**Automatic Rotation**
- Keys older than 90 days should be rotated
- Old keys remain valid for a configurable grace period (default: 7 days)
- New keys increment the version number

**Manual Rotation**
```typescript
import { rotateAPIKeyInStorage } from '@duyetbot/api-security';

const { apiKey, record, oldRecord } = await rotateAPIKeyInStorage(
  db,
  oldKeyId,
  {
    gracePeriodMs: 7 * 24 * 60 * 60 * 1000, // 7 days
    autoRevoke: true,
    onRotation: async (oldKeyId, newKeyId) => {
      // Send notification
    }
  }
);
```

#### Storage Schema

```sql
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  key_id TEXT NOT NULL UNIQUE,
  key_hash TEXT NOT NULL,  -- SHA-256 hash
  name TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  last_used_at INTEGER NOT NULL DEFAULT 0,
  usage_count INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  replaces_id TEXT,
  FOREIGN KEY (replaces_id) REFERENCES api_keys(id)
);

CREATE TABLE api_key_audit_log (
  id TEXT PRIMARY KEY,
  key_id TEXT NOT NULL,
  action TEXT NOT NULL,  -- created, rotated, revoked, expired, used
  performed_by TEXT,
  performed_at INTEGER NOT NULL,
  metadata TEXT,  -- JSON
  FOREIGN KEY (key_id) REFERENCES api_keys(id)
);
```

### 2. Enhanced Webhook Signature Verification

#### GitHub Webhooks

The signature verification middleware now:

1. Extracts timestamp from `x-github-delivery` header
2. Validates HMAC-SHA256 signature
3. Checks timestamp age (default: 5 minutes)
4. Uses timing-safe comparison to prevent timing attacks

```typescript
import { verifySignatureWithTimestamp } from '@duyetbot/api-security';

const timestamp = extractTimestamp(headers); // From x-github-delivery
const isValid = await verifySignatureWithTimestamp(
  payload,
  signature,
  secret,
  timestamp,
  { maxAge: 5 * 60 * 1000 } // 5 minutes
);
```

#### Replay Attack Prevention

- Timestamps older than 5 minutes are rejected
- Clock skew tolerance: 30 seconds
- Future timestamps beyond skew are rejected

### 3. Per-API-Key Rate Limiting

Rate limiting is now enforced per API key using D1 storage:

**Default Configuration**
- Requests per minute: 60
- Burst limit: 10 requests
- Burst window: 10 seconds
- Throttle duration: 60 seconds

**Storage Schema**
```sql
CREATE TABLE api_rate_limits (
  key_id TEXT PRIMARY KEY,
  request_timestamps TEXT NOT NULL DEFAULT '[]',
  throttle_until INTEGER NOT NULL DEFAULT 0,
  burst_start INTEGER,
  burst_count INTEGER NOT NULL DEFAULT 0,
  last_updated INTEGER NOT NULL
);
```

**Usage**
```typescript
import { checkRateLimit } from '@duyetbot/api-security';

const result = await checkRateLimit(db, keyId, {
  requestsPerMinute: 60,
  maxBurst: 10,
});

if (!result.allowed) {
  return response(429, {
    error: 'Rate limit exceeded',
    reason: result.reason,
    retryAfter: result.retryAfter,
  });
}
```

### 4. Request Throttling

In-memory throttling for expensive operations:

**Default Configuration**
- Max concurrent operations: 3
- Delay between operations: 1000ms
- Window: 60 seconds

**Usage**
```typescript
import { executeThrottled } from '@duyetbot/api-security';

const result = await executeThrottled(
  'llm_call',  // operation type
  async () => {
    return await expensiveLLMCall();
  },
  {
    maxConcurrent: 3,
    perOperationDelay: 1000,
  }
);
```

**Hono Middleware**
```typescript
import { createThrottleMiddleware } from '@duyetbot/api-security';

app.post('/api/generate',
  createThrottleMiddleware('llm_call', {
    maxConcurrent: 3,
    perOperationDelay: 1000,
  }),
  handler
);
```

## Migration Guide

### Step 1: Initialize D1 Storage

```bash
# Create D1 database
wrangler d1 create duyetbot-security

# Add to wrangler.toml
[[d1_databases]]
binding = "SECURITY_DB"
database_name = "duyetbot-security"
database_id = "<your-database-id>"

# Initialize tables
bun run scripts/init-security-db.ts
```

### Step 2: Create Initial API Key

```typescript
import { createAPIKey, initializeAPIKeysStorage } from '@duyetbot/api-security';

// Initialize storage
await initializeAPIKeysStorage(env.SECURITY_DB);

// Create API key
const { apiKey, record } = await createAPIKey(
  env.SECURITY_DB,
  'Production API Key',
  'admin',
  { version: 1 }
);

console.log('API Key:', apiKey);  // Store securely!
console.log('Key ID:', record.keyId);
```

### Step 3: Update Application Code

**GitHub Bot** - Already updated:
```typescript
// apps/github-bot/src/middlewares/signature.ts
import { verifySignatureWithTimestamp, extractTimestamp } from '@duyetbot/api-security';

// The middleware now uses enhanced signature verification
```

**Telegram Bot** - Add API key authentication:
```typescript
import {
  createAPIKeyAuthMiddleware,
  createRateLimitMiddleware,
  createThrottleMiddleware,
} from '@duyetbot/api-security';

// Add to your app
app.use('/api/*',
  createAPIKeyAuthMiddleware({
    headerName: 'x-api-key',
    required: true,
  }),
  createRateLimitMiddleware(() => ({
    requestsPerMinute: 60,
  }))
);
```

### Step 4: Configure Environment Variables

```bash
# wrangler.toml already has OBSERVABILITY_DB
# Reuse it for SECURITY_DB or create separate

[[d1_databases]]
binding = "SECURITY_DB"
database_name = "duyetbot-security"
database_id = "<your-database-id>"
```

## Best Practices

### API Key Management

1. **Store keys securely** - Never commit API keys to git
2. **Use descriptive names** - Help identify key purpose
3. **Rotate regularly** - Every 90 days for production keys
4. **Monitor usage** - Check audit logs for suspicious activity
5. **Revoke unused keys** - Clean up old or compromised keys

### Rate Limiting

1. **Set appropriate limits** - Based on your usage patterns
2. **Monitor throttling** - Track rate limit events
3. **Use priority queuing** - For important operations
4. **Provide clear feedback** - Include retry-after headers

### Webhook Security

1. **Always verify signatures** - Never skip signature verification
2. **Use short TTLs** - 5 minutes or less for timestamp validation
3. **Log failures** - Track failed verification attempts
4. **Monitor replay attacks** - Alert on repeated old timestamps

## Monitoring and Auditing

### Audit Log Events

The audit log tracks all API key operations:

- `created` - New API key created
- `rotated` - Key rotated to new version
- `revoked` - Key manually revoked
- `expired` - Key expired naturally
- `used` - Key used for authentication

### Viewing Audit Logs

```typescript
import { getAPIKeyAuditLog } from '@duyetbot/api-security';

const logs = await getAPIKeyAuditLog(db, keyId, 100);

logs.forEach(log => {
  console.log(`${log.action} by ${log.performedBy} at ${new Date(log.performedAt)}`);
});
```

### Checking Keys Needing Rotation

```typescript
import { checkKeysNeedingRotation } from '@duyetbot/api-security';

const keysToRotate = await checkKeysNeedingRotation(db, 90 * 24 * 60 * 60 * 1000);

keysToRotate.forEach(key => {
  console.log(`Key ${key.name} (${key.keyId}) needs rotation`);
  // Send notification or auto-rotate
});
```

## Security Checklist

- [ ] API keys are stored with SHA-256 hashing
- [ ] Webhook signatures are verified with timestamp validation
- [ ] Rate limiting is enabled per API key
- [ ] Expensive operations are throttled
- [ ] Audit logs are enabled and monitored
- [ ] API keys are rotated every 90 days
- [ ] Unused keys are revoked
- [ ] Rate limit events are monitored
- [ ] Failed signature verifications are logged
- [ ] Timestamp validation prevents replay attacks

## Troubleshooting

### API Key Validation Fails

**Symptom**: 401 errors with "KEY_NOT_FOUND" or "KEY_EXPIRED"

**Solutions**:
1. Check if key is active: `SELECT * FROM api_keys WHERE key_id = ?`
2. Verify expiration: `SELECT expires_at FROM api_keys WHERE key_id = ?`
3. Check usage count and last used timestamp
4. Review audit log for key events

### Rate Limiting Too Aggressive

**Symptom**: Legitimate requests are being throttled

**Solutions**:
1. Adjust `requestsPerMinute` for the API key
2. Increase `maxBurst` for bursty traffic
3. Check `throttle_until` timestamp in `api_rate_limits` table
4. Reset rate limit: `DELETE FROM api_rate_limits WHERE key_id = ?`

### Webhook Signature Verification Fails

**Symptom**: 401 errors on valid webhooks

**Solutions**:
1. Verify `GITHUB_WEBHOOK_SECRET` matches GitHub configuration
2. Check if timestamp is within acceptable range (5 minutes)
3. Verify clock skew tolerance (30 seconds default)
4. Check logs for specific verification failure reason

## References

- [GitHub Webhook Best Practices](https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-webhooks)
- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
