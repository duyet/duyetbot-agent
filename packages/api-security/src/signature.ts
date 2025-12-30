/**
 * Webhook Signature Verification
 *
 * Enhanced signature verification with timestamp validation,
 * replay attack prevention, and timing-safe comparison.
 */

import type { SignatureVerificationOptions } from './types.js';

/**
 * Default signature verification options
 */
const DEFAULT_OPTIONS: Required<SignatureVerificationOptions> = {
  maxAge: 5 * 60 * 1000, // 5 minutes
  requireTimestamp: false,
  clockSkewTolerance: 30 * 1000, // 30 seconds
};

/**
 * Verify webhook signature with timestamp validation
 *
 * Uses HMAC-SHA256 with timing-safe comparison.
 * Optionally validates timestamp to prevent replay attacks.
 *
 * @param payload - Raw request body
 * @param signature - Signature from header (e.g., sha256=abc...)
 * @param secret - Webhook secret
 * @param timestamp - Timestamp from header (optional)
 * @param options - Verification options
 * @returns true if signature is valid
 */
export async function verifySignatureWithTimestamp(
  payload: string,
  signature: string,
  secret: string,
  timestamp?: number,
  options: SignatureVerificationOptions = {}
): Promise<boolean> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Verify signature
  const isValidSignature = await verifySignature(payload, signature, secret);
  if (!isValidSignature) {
    return false;
  }

  // Validate timestamp if required
  if (opts.requireTimestamp && timestamp === undefined) {
    return false;
  }

  // Check timestamp age if provided
  if (timestamp !== undefined) {
    const now = Date.now();
    const signatureAge = now - timestamp;

    // Check if signature is too old
    if (Math.abs(signatureAge) > opts.maxAge + opts.clockSkewTolerance) {
      return false;
    }

    // Check if signature is from the future (beyond clock skew)
    if (signatureAge < -opts.clockSkewTolerance) {
      return false;
    }
  }

  return true;
}

/**
 * Verify HMAC-SHA256 signature
 *
 * Uses timing-safe comparison to prevent timing attacks.
 *
 * @param payload - Raw request body
 * @param signature - Signature from header
 * @param secret - Webhook secret
 * @returns true if signature is valid
 */
async function verifySignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const payloadData = encoder.encode(payload);

    // Import key for HMAC
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    // Compute HMAC
    const signatureBytes = await crypto.subtle.sign('HMAC', key, payloadData);

    // Convert to hex string
    const digest = `sha256=${Array.from(new Uint8Array(signatureBytes))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`;

    // Use timing-safe comparison
    return timingSafeEqual(digest, signature);
  } catch {
    return false;
  }
}

/**
 * Timing-safe string comparison
 *
 * Prevents timing attacks by comparing all bytes
 * regardless of early mismatches.
 *
 * @param a - First string
 * @param b - Second string
 * @returns true if strings are equal
 */
export function timingSafeEqual(a: string, b: string): boolean {
  // Check length first (safe, no timing info leaked)
  if (a.length !== b.length) {
    return false;
  }

  // Convert to byte arrays
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);

  // XOR all bytes together
  let result = 0;
  for (let i = 0; i < aBytes.length; i++) {
    result |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }

  // If result is 0, strings are equal
  return result === 0;
}

/**
 * Extract timestamp from signature header
 *
 * GitHub webhooks include timestamp in delivery ID.
 * Telegram doesn't provide timestamp in signature.
 *
 * @param headers - Request headers
 * @returns timestamp or undefined
 */
export function extractTimestamp(headers: Headers): number | undefined {
  // GitHub provides timestamp in x-github-delivery
  const deliveryId = headers.get('x-github-delivery');
  if (deliveryId) {
    // Format: unix-timestamp-uuid
    const match = deliveryId.match(/^(\d+)-/);
    if (match?.[1]) {
      return Number.parseInt(match[1], 10) * 1000; // Convert to milliseconds
    }
  }

  // Custom timestamp header (can be used by any service)
  const customTimestamp = headers.get('x-webhook-timestamp');
  if (customTimestamp) {
    const parsed = Number.parseInt(customTimestamp, 10);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

/**
 * Generate signature for outgoing webhooks
 *
 * @param payload - Request body
 * @param secret - Webhook secret
 * @returns Signature string (e.g., sha256=abc...)
 */
export async function generateSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const payloadData = encoder.encode(payload);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBytes = await crypto.subtle.sign('HMAC', key, payloadData);

  return `sha256=${Array.from(new Uint8Array(signatureBytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')}`;
}

/**
 * Create signature middleware options
 *
 * @param customOptions - Custom options to override defaults
 * @returns Merged options
 */
export function createSignatureOptions(
  customOptions: SignatureVerificationOptions = {}
): Required<SignatureVerificationOptions> {
  return { ...DEFAULT_OPTIONS, ...customOptions };
}
