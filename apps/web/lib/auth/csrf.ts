/**
 * CSRF Protection for Next.js
 * Provides token-based CSRF protection using double submit cookie pattern
 */

import { cookies } from "next/headers";

const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";
const TOKEN_LENGTH = 32;

/**
 * Generate a cryptographically secure random token
 */
function generateToken(): string {
	const array = new Uint8Array(TOKEN_LENGTH);
	crypto.getRandomValues(array);
	return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

/**
 * Create a CSRF token and set it in a cookie
 * Returns the token to be included in forms/state
 */
export async function createCsrfToken(): Promise<string> {
	const token = generateToken();
	const cookieStore = await cookies();

	cookieStore.set({
		name: CSRF_COOKIE_NAME,
		value: token,
		httpOnly: false, // Client needs to read this to send in headers
		sameSite: "strict",
		secure: process.env.NODE_ENV === "production",
		path: "/",
		maxAge: 60 * 60, // 1 hour
	});

	return token;
}

/**
 * Verify CSRF token from request headers against cookie
 * @param token - Token from request header (x-csrf-token)
 * @returns true if valid, false otherwise
 */
export async function verifyCsrfToken(token: string): Promise<boolean> {
	try {
		const cookieStore = await cookies();
		const cookieToken = cookieStore.get(CSRF_COOKIE_NAME)?.value;

		if (!cookieToken || !token) {
			return false;
		}

		// Constant-time comparison to prevent timing attacks
		if (cookieToken.length !== token.length) {
			return false;
		}

		let result = 0;
		for (let i = 0; i < token.length; i++) {
			result |= cookieToken.charCodeAt(i) ^ token.charCodeAt(i);
		}

		return result === 0;
	} catch {
		return false;
	}
}

/**
 * Validate CSRF token from a Request object
 * Checks the x-csrf-token header
 */
export async function validateCsrfHeader(request: Request): Promise<boolean> {
	const token = request.headers.get(CSRF_HEADER_NAME);
	return verifyCsrfToken(token || "");
}

/**
 * Get CSRF token for client-side use
 * This should be called in server components to pass to client
 */
export async function getCsrfToken(): Promise<string> {
	const cookieStore = await cookies();
	let token = cookieStore.get(CSRF_COOKIE_NAME)?.value;

	// Create new token if none exists
	if (!token) {
		token = await createCsrfToken();
	}

	return token;
}

/**
 * Clear CSRF token cookie
 */
export async function clearCsrfToken(): Promise<void> {
	const cookieStore = await cookies();
	cookieStore.delete({
		name: CSRF_COOKIE_NAME,
		path: "/",
	});
}

export { CSRF_HEADER_NAME };
