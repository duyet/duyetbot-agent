/**
 * Secure Session Management
 *
 * Provides session creation, verification, invalidation, and rotation
 * capabilities on top of the JWT-based authentication system.
 *
 * Features:
 * - Session registration in database for invalidation
 * - Session rotation on privilege escalation
 * - Session fixation prevention
 * - Idle timeout detection
 * - Concurrent session limits (optional)
 */

import { eq } from "drizzle-orm";
import { sessions } from "../../lib/db/schema";
import { logSessionEvent } from "./audit-logger";
import { getDb } from "./context";
import { generateUUID } from "./utils";

export type SessionMetadata = {
	userAgent?: string;
	ipAddress?: string;
};

export type SessionInfo = {
	sessionId: string;
	userId: string;
	expiresAt: Date;
	createdAt: Date;
	lastActivityAt: Date;
	isRotated: boolean;
	replacedSessionId?: string;
};

/**
 * Create a SHA-256 hash of the session token for database storage
 * We never store plaintext tokens in the database
 */
async function hashToken(token: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(token);
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const hashHex = hashArray
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
	return hashHex;
}

/**
 * Register a new session in the database
 *
 * @param userId - User ID who owns the session
 * @param token - JWT session token (will be hashed, never stored in plaintext)
 * @param expiresAt - When the session expires
 * @param metadata - Optional session metadata (user agent, IP address)
 * @param replacedSessionId - Optional ID of session being replaced (for rotation)
 * @returns Session ID
 */
export async function registerSession(
	c: any,
	userId: string,
	token: string,
	expiresAt: Date,
	metadata?: SessionMetadata,
	replacedSessionId?: string,
): Promise<string> {
	const db = getDb(c);
	const sessionId = generateUUID();
	const tokenHash = await hashToken(token);

	await db.insert(sessions).values({
		id: sessionId,
		userId,
		tokenHash,
		expiresAt,
		createdAt: new Date(),
		lastActivityAt: new Date(),
		userAgent: metadata?.userAgent,
		ipAddress: metadata?.ipAddress,
		isRotated: !!replacedSessionId, // Mark as rotated if replacing another session
		replacedSessionId,
	});

	// Log session creation for audit trail (non-blocking)
	try {
		await logSessionEvent(c, userId, "session_created", sessionId, metadata);
	} catch (error) {
		// Non-blocking: don't fail session creation if audit logging fails
		console.error("[session-manager] Failed to log session creation:", error);
	}

	return sessionId;
}

/**
 * Verify a session token against the database
 * Updates lastActivityAt on successful verification
 *
 * @param token - JWT session token to verify
 * @returns Session info if valid, null if invalid/not found
 */
export async function verifySession(
	c: any,
	token: string,
): Promise<SessionInfo | null> {
	const db = getDb(c);
	const tokenHash = await hashToken(token);

	// Find session by token hash
	const sessionRecords = await db
		.select()
		.from(sessions)
		.where(eq(sessions.tokenHash, tokenHash))
		.limit(1);

	if (sessionRecords.length === 0) {
		return null;
	}

	const session = sessionRecords[0];

	// Check if session has expired
	if (new Date() > session.expiresAt) {
		// Clean up expired session
		await db.delete(sessions).where(eq(sessions.id, session.id));
		return null;
	}

	// Update last activity time
	await db
		.update(sessions)
		.set({ lastActivityAt: new Date() })
		.where(eq(sessions.id, session.id));

	// Log session verification for audit trail (non-blocking)
	try {
		await logSessionEvent(
			c,
			session.userId,
			"session_verified",
			session.id,
			metadata,
		);
	} catch (error) {
		// Non-blocking: don't fail session verification if audit logging fails
		console.error(
			"[session-manager] Failed to log session verification:",
			error,
		);
	}

	return {
		sessionId: session.id,
		userId: session.userId,
		expiresAt: session.expiresAt,
		createdAt: session.createdAt,
		lastActivityAt: session.lastActivityAt,
		isRotated: session.isRotated,
		replacedSessionId: session.replacedSessionId ?? undefined,
	};
}

/**
 * Invalidate a specific session (logout)
 *
 * @param token - JWT session token to invalidate
 * @returns true if session was found and deleted, false otherwise
 */
export async function invalidateSession(
	c: any,
	token: string,
): Promise<boolean> {
	const db = getDb(c);
	const tokenHash = await hashToken(token);

	// Get session info for audit logging before deletion
	const sessionRecords = await db
		.select()
		.from(sessions)
		.where(eq(sessions.tokenHash, tokenHash))
		.limit(1);

	const userId = sessionRecords.length > 0 ? sessionRecords[0].userId : null;
	const sessionId = sessionRecords.length > 0 ? sessionRecords[0].id : null;

	const result = await db
		.delete(sessions)
		.where(eq(sessions.tokenHash, tokenHash))
		.returning();

	// Log session invalidation for audit trail (non-blocking)
	if (userId && sessionId && result.length > 0) {
		try {
			await logSessionEvent(c, userId, "session_invalidated", sessionId);
		} catch (error) {
			// Non-blocking: don't fail session invalidation if audit logging fails
			console.error(
				"[session-manager] Failed to log session invalidation:",
				error,
			);
		}
	}

	return result.length > 0;
}

/**
 * Invalidate all sessions for a user (e.g., password change, security event)
 *
 * @param userId - User ID whose sessions should be invalidated
 * @returns Number of sessions invalidated
 */
export async function invalidateAllUserSessions(
	c: any,
	userId: string,
): Promise<number> {
	const db = getDb(c);

	const result = await db
		.delete(sessions)
		.where(eq(sessions.userId, userId))
		.returning();

	return result.length;
}

/**
 * Rotate a session (create new session, invalidate old one)
 * Used for session fixation prevention and privilege escalation
 *
 * @param oldToken - Original JWT session token
 * @param newToken - New JWT session token
 * @param newExpiresAt - Expiration time for new session
 * @param metadata - Optional new session metadata
 * @returns New session ID
 */
export async function rotateSession(
	c: any,
	oldToken: string,
	newToken: string,
	newExpiresAt: Date,
	metadata?: SessionMetadata,
): Promise<string | null> {
	const db = getDb(c);
	const oldTokenHash = await hashToken(oldToken);

	// Find old session
	const oldSessions = await db
		.select()
		.from(sessions)
		.where(eq(sessions.tokenHash, oldTokenHash))
		.limit(1);

	if (oldSessions.length === 0) {
		return null;
	}

	const oldSession = oldSessions[0];

	// Create new session
	const newSessionId = await registerSession(
		c,
		oldSession.userId,
		newToken,
		newExpiresAt,
		metadata || {
			userAgent: oldSession.userAgent ?? undefined,
			ipAddress: oldSession.ipAddress ?? undefined,
		},
		oldSession.id, // Mark as replacing the old session
	);

	// Delete old session (session fixation prevention)
	await db.delete(sessions).where(eq(sessions.id, oldSession.id));

	// Log session rotation for audit trail (non-blocking)
	try {
		await logSessionEvent(
			c,
			oldSession.userId,
			"session_rotated",
			newSessionId,
			metadata,
		);
	} catch (error) {
		// Non-blocking: don't fail session rotation if audit logging fails
		console.error("[session-manager] Failed to log session rotation:", error);
	}

	return newSessionId;
}

/**
 * Clean up expired sessions from the database
 * Should be called periodically (e.g., cron job)
 *
 * @returns Number of sessions cleaned up
 */
export async function cleanupExpiredSessions(c: any): Promise<number> {
	const db = getDb(c);
	const now = new Date();

	const result = await db
		.delete(sessions)
		.where(eq(sessions.expiresAt, now))
		.returning();

	return result.length;
}

/**
 * Get active session count for a user
 * Useful for enforcing concurrent session limits
 *
 * @param userId - User ID to check
 * @returns Number of active sessions
 */
export async function getActiveSessionCount(
	c: any,
	userId: string,
): Promise<number> {
	const db = getDb(c);
	const now = new Date();

	const activeSessions = await db
		.select()
		.from(sessions)
		.where(eq(sessions.userId, userId))
		.all();

	// Filter out expired sessions
	return activeSessions.filter((s) => s.expiresAt > now).length;
}

/**
 * Invalidate oldest session for a user (when exceeding concurrent session limit)
 *
 * @param userId - User ID whose oldest session should be invalidated
 * @returns true if a session was invalidated, false otherwise
 */
export async function invalidateOldestSession(
	c: any,
	userId: string,
): Promise<boolean> {
	const db = getDb(c);

	const oldestSessions = await db
		.select()
		.from(sessions)
		.where(eq(sessions.userId, userId))
		.orderBy(sessions.createdAt)
		.limit(1);

	if (oldestSessions.length === 0) {
		return false;
	}

	await db.delete(sessions).where(eq(sessions.id, oldestSessions[0].id));

	return true;
}
