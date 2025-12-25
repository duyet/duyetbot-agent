/**
 * JWT Session Management
 * Uses HMAC-SHA256 for JWT signing (Workers compatible)
 */

export type UserType = "guest" | "regular";

export interface SessionPayload {
  id: string;
  email?: string;
  type: UserType;
  exp: number;
  iat: number;
}

export interface Session {
  user: {
    id: string;
    email?: string;
    type: UserType;
  };
  expires: string;
}

// biome-ignore lint/complexity/useLiteralKeys: Needed for dynamic access
const SESSION_SECRET = process.env.SESSION_SECRET || process.env.AUTH_SECRET;

if (!SESSION_SECRET) {
  throw new Error(
    "SESSION_SECRET or AUTH_SECRET environment variable is required"
  );
}

/**
 * Convert Uint8Array to Base64URL string (JWT compatible)
 */
function base64UrlEncode(buffer: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...buffer));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Convert Base64URL string to Uint8Array
 */
function base64UrlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Sign data with HMAC-SHA256
 */
async function sign(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);

  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(data)
  );

  return base64UrlEncode(new Uint8Array(signature));
}

/**
 * Verify HMAC-SHA256 signature
 */
async function verify(
  data: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);

  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const signatureBuffer = base64UrlDecode(signature);

  return await crypto.subtle.verify(
    "HMAC",
    key,
    signatureBuffer as BufferSource,
    encoder.encode(data)
  );
}

/**
 * Create a JWT token from session payload
 */
function encodeToken(payload: SessionPayload): string {
  const header = { alg: "HS256", typ: "JWT" };

  const encodedHeader = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify(header))
  );
  const encodedPayload = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify(payload))
  );

  return `${encodedHeader}.${encodedPayload}`;
}

/**
 * Decode JWT token to session payload
 */
function decodeToken(token: string): SessionPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    const payload = parts[1];
    const decoded = base64UrlDecode(payload);
    const json = new TextDecoder().decode(decoded);

    return JSON.parse(json) as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * Create a session token for a user
 */
export async function createSessionToken(
  userId: string,
  email: string | undefined,
  type: UserType,
  expiresIn: number = 30 * 24 * 60 * 60 * 1000 // 30 days
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = Math.floor((Date.now() + expiresIn) / 1000);

  const payload: SessionPayload = {
    id: userId,
    email,
    type,
    exp,
    iat: now,
  };

  const tokenData = encodeToken(payload);
  const signature = await sign(tokenData, SESSION_SECRET as string);

  return `${tokenData}.${signature}`;
}

/**
 * Verify a session token and return the payload
 */
export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    const [encodedHeader, encodedPayload, signature] = parts;
    const tokenData = `${encodedHeader}.${encodedPayload}`;

    // Verify signature
    const isValid = await verify(tokenData, signature, SESSION_SECRET as string);
    if (!isValid) {
      return null;
    }

    // Decode payload
    const payload = decodeToken(token);
    if (!payload) {
      return null;
    }

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Create a session object from a payload
 */
export function createSessionFromPayload(
  payload: SessionPayload
): Session {
  return {
    user: {
      id: payload.id,
      email: payload.email,
      type: payload.type,
    },
    expires: new Date(payload.exp * 1000).toISOString(),
  };
}

/**
 * Get max age for session cookie (30 days)
 */
export const SESSION_MAX_AGE = 30 * 24 * 60 * 60;
