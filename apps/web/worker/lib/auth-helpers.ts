/**
 * Shared auth helper functions for worker routes
 */

import { eq } from "drizzle-orm";
import { user } from "../../lib/db/schema";
import { getDb } from "./context";
import { hashPassword } from "./crypto";
import { createSessionToken } from "./jwt";
import {
	registerSession,
	type SessionMetadata,
	verifySession as verifyDbSession,
} from "./session-manager";
import { generateUUID } from "./utils";

export type Session = {
	user: {
		id: string;
		email?: string;
		type: "guest" | "regular";
	};
	expires: string;
};

/**
 * Get session from request (supports both Authorization header and Cookie)
 * - Tries Authorization: Bearer <token> first (new bearer token approach)
 * - Falls back to Cookie: session=<token> for backward compatibility
 * - Verifies both JWT signature and database registration (defense-in-depth)
 */
export async function getSessionFromRequest(c: any): Promise<Session | null> {
	// Try Authorization header first (bearer token)
	const authHeader = c.req.header("Authorization");
	if (authHeader?.startsWith("Bearer ")) {
		const token = authHeader.slice(7);
		return await verifySessionWithDatabase(token, c.env.SESSION_SECRET, c);
	}

	// Fallback to cookie (for backward compatibility)
	const cookieHeader = c.req.header("Cookie");
	if (cookieHeader) {
		const cookies = cookieHeader.split(";").map((c: string) => c.trim());
		const sessionCookie = cookies.find((c: string) => c.startsWith("session="));

		if (sessionCookie) {
			const token = sessionCookie.slice(8);
			return await verifySessionWithDatabase(token, c.env.SESSION_SECRET, c);
		}
	}

	return null;
}

function base64UrlDecode(str: string): Uint8Array {
	const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
	const padded = base64.padEnd(
		base64.length + ((4 - (base64.length % 4)) % 4),
		"=",
	);
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

/**
 * Set session cookie on response
 */
export function setSessionCookie(response: Response, token: string): Response {
	const newResponse = new Response(response.body, response);
	newResponse.headers.set(
		"Set-Cookie",
		`session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${30 * 24 * 60 * 60}`,
	);
	return newResponse;
}

/**
 * Clear session cookie on response
 */
export function clearSessionCookie(response: Response): Response {
	const newResponse = new Response(response.body, response);
	newResponse.headers.set(
		"Set-Cookie",
		"session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
	);
	return newResponse;
}

/**
 * Create a guest user and return session with token
 * This is used for anonymous chat access
 */
export async function createGuestSession(
	c: any,
): Promise<{ session: Session; token: string }> {
	const email = `guest-${Date.now()}`;
	const password = await hashPassword(generateUUID());

	const db = getDb(c);
	await db.insert(user).values({ email, password });

	const users = await db.select().from(user).where(eq(user.email, email));
	const guestUser = users[0];

	if (!guestUser) {
		throw new Error("Failed to create guest user");
	}

	const token = await createSessionToken(
		guestUser.id,
		guestUser.email,
		"guest",
		c.env.SESSION_SECRET,
	);

	const session: Session = {
		user: {
			id: guestUser.id,
			email: guestUser.email,
			type: "guest",
		},
		expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
	};

	return { session, token };
}

/**
 * Get session metadata from request (user agent, IP address)
 * Used for session security tracking
 */
export function getSessionMetadata(c: any): SessionMetadata {
	const userAgent = c.req.header("user-agent");
	const forwarded = c.req.header("x-forwarded-for");
	const ipAddress = forwarded
		? forwarded.split(",")[0]
		: c.req.header("cf-connecting-ip");

	return {
		userAgent,
		ipAddress,
	};
}

/**
 * Create a session token and register it in the database
 * This combines JWT creation with database session registration
 *
 * @param userId - User ID
 * @param email - User email (optional)
 * @param type - User type (guest or regular)
 * @param secret - Session secret
 * @param expiresAt - Session expiration time
 * @param c - Hono context (for database access)
 * @param metadata - Session metadata (user agent, IP)
 * @param replacedSessionId - Optional ID of session being replaced
 * @returns Session token
 */
export async function createAndRegisterSession(
	userId: string,
	email: string | undefined,
	type: "guest" | "regular",
	secret: string,
	expiresAt: Date,
	c: any,
	metadata?: SessionMetadata,
	replacedSessionId?: string,
): Promise<string> {
	// Create JWT token
	const token = await createSessionToken(userId, email, type, secret);

	// Register session in database
	const effectiveMetadata = metadata || getSessionMetadata(c);
	await registerSession(
		c,
		userId,
		token,
		expiresAt,
		effectiveMetadata,
		replacedSessionId,
	);

	return token;
}

/**
 * Verify a session token against both JWT signature and database
 * This provides defense-in-depth session verification
 *
 * @param token - Session token to verify
 * @param secret - Session secret
 * @param c - Hono context (for database access)
 * @returns Session info if valid, null if invalid
 */
export async function verifySessionWithDatabase(
	token: string,
	secret: string,
	c: any,
): Promise<Session | null> {
	try {
		// First verify JWT signature and expiration
		const parts = token.split(".");
		if (parts.length !== 3) {
			return null;
		}

		const [encodedHeader, encodedPayload, signature] = parts;
		const tokenData = `${encodedHeader}.${encodedPayload}`;

		// Verify signature
		const encoder = new TextEncoder();
		const keyData = encoder.encode(secret);

		const key = await crypto.subtle.importKey(
			"raw",
			keyData,
			{ name: "HMAC", hash: "SHA-256" },
			false,
			["verify"],
		);

		const signatureBuffer = base64UrlDecode(signature);

		const isValid = await crypto.subtle.verify(
			"HMAC",
			key,
			signatureBuffer as BufferSource,
			encoder.encode(tokenData),
		);

		if (!isValid) {
			return null;
		}

		// Decode payload
		const payload = JSON.parse(
			new TextDecoder().decode(base64UrlDecode(encodedPayload)),
		);

		// Check expiration
		const now = Math.floor(Date.now() / 1000);
		if (payload.exp < now) {
			return null;
		}

		// Verify session exists in database (defense-in-depth)
		const dbSession = await verifyDbSession(c, token);
		if (!dbSession) {
			return null;
		}

		// Session is valid (both JWT and database check passed)
		return {
			user: {
				id: payload.id,
				email: payload.email,
				type: payload.type,
			},
			expires: new Date(payload.exp * 1000).toISOString(),
		};
	} catch {
		return null;
	}
}
