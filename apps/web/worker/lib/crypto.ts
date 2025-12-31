/**
 * Password hashing utilities for Hono Worker
 * Copied from lib/auth/crypto.ts to avoid Next.js dependencies
 */

const PBKDF2_ITERATIONS = 100_000;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;

function bufferToBase64(buffer: Uint8Array): string {
	const bytes = Array.from(buffer);
	const binary = bytes.map((b) => String.fromCharCode(b)).join("");
	return btoa(binary);
}

function base64ToBuffer(base64: string): Uint8Array {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

/**
 * Create HMAC-SHA256 signature for OAuth state verification
 */
export async function signState(
	state: string,
	secret: string,
): Promise<string> {
	const encoder = new TextEncoder();
	const keyData = encoder.encode(secret);
	const messageData = encoder.encode(state);

	const key = await crypto.subtle.importKey(
		"raw",
		keyData,
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);

	const signature = await crypto.subtle.sign("HMAC", key, messageData);

	const signatureBase64 = bufferToBase64(new Uint8Array(signature));
	return `${state}.${signatureBase64}`;
}

/**
 * Verify HMAC-SHA256 signature for OAuth state
 */
export async function verifyState(
	signedState: string,
	secret: string,
): Promise<string | null> {
	try {
		const [state, signatureBase64] = signedState.split(".");
		if (!state || !signatureBase64) {
			return null;
		}

		const expectedSignature = await signState(state, secret);
		const expectedSigPart = expectedSignature.split(".")[1];

		if (signatureBase64 !== expectedSigPart) {
			return null;
		}

		return state;
	} catch {
		return null;
	}
}

export async function hashPassword(password: string): Promise<string> {
	const encoder = new TextEncoder();
	const passwordBuffer = encoder.encode(password);
	const salt = new Uint8Array(SALT_LENGTH);

	crypto.getRandomValues(salt);

	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		passwordBuffer,
		{ name: "PBKDF2" },
		false,
		["deriveBits"],
	);

	const derivedBits = await crypto.subtle.deriveBits(
		{
			name: "PBKDF2",
			salt,
			iterations: PBKDF2_ITERATIONS,
			hash: "SHA-256",
		},
		keyMaterial,
		KEY_LENGTH * 8,
	);

	const derivedKey = new Uint8Array(derivedBits);

	return `${bufferToBase64(salt)}$${bufferToBase64(derivedKey)}`;
}

export async function verifyPassword(
	password: string,
	storedHash: string,
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

		const keyMaterial = await crypto.subtle.importKey(
			"raw",
			passwordBuffer,
			{ name: "PBKDF2" },
			false,
			["deriveBits"],
		);

		const derivedBits = await crypto.subtle.deriveBits(
			{
				name: "PBKDF2",
				salt: salt as BufferSource,
				iterations: PBKDF2_ITERATIONS,
				hash: "SHA-256",
			},
			keyMaterial,
			KEY_LENGTH * 8,
		);

		const derivedKey = new Uint8Array(derivedBits);

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
