/**
 * Web Crypto API password hashing utilities
 * Uses PBKDF2-HMAC-SHA256 for password hashing (Workers compatible)
 */

const PBKDF2_ITERATIONS = 100_000;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Generate a cryptographically secure random salt
 */
function _generateSalt(): string {
  const salt = new Uint8Array(SALT_LENGTH);
  crypto.getRandomValues(salt);
  return bufferToBase64(salt);
}

/**
 * Convert Uint8Array to Base64 string
 */
function bufferToBase64(buffer: Uint8Array): string {
  const bytes = Array.from(buffer);
  const binary = bytes.map((b) => String.fromCharCode(b)).join("");
  return btoa(binary);
}

/**
 * Convert Base64 string to Uint8Array
 */
function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Hash a password using PBKDF2-HMAC-SHA256
 * @param password - The plain text password to hash
 * @returns A string in the format "salt$hash" for storage
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  const salt = new Uint8Array(SALT_LENGTH);

  // Generate random salt
  crypto.getRandomValues(salt);

  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    passwordBuffer,
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  // Derive key using PBKDF2
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    KEY_LENGTH * 8
  );

  const derivedKey = new Uint8Array(derivedBits);

  // Return "salt$hash" format for storage
  return `${bufferToBase64(salt)}$${bufferToBase64(derivedKey)}`;
}

/**
 * Verify a password against a stored hash
 * @param password - The plain text password to verify
 * @param storedHash - The stored hash in "salt$hash" format
 * @returns true if password matches, false otherwise
 */
export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  try {
    const [saltBase64, hashBase64] = storedHash.split("$");
    if (!saltBase64 || !hashBase64) {
      return false;
    }

    const salt = base64ToBuffer(saltBase64);
    const storedHashBuffer = base64ToBuffer(hashBase64);
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);

    // Import password as key material
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      passwordBuffer,
      { name: "PBKDF2" },
      false,
      ["deriveBits"]
    );

    // Derive key using PBKDF2 with same parameters
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: salt as BufferSource,
        iterations: PBKDF2_ITERATIONS,
        hash: "SHA-256",
      },
      keyMaterial,
      KEY_LENGTH * 8
    );

    const derivedKey = new Uint8Array(derivedBits);

    // Constant-time comparison to prevent timing attacks
    if (derivedKey.length !== storedHashBuffer.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < derivedKey.length; i++) {
      result |= derivedKey[i] ^ storedHashBuffer[i];
    }

    return result === 0;
  } catch {
    return false;
  }
}
