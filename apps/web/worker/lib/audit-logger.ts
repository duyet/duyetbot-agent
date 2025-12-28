/**
 * Audit logging utilities for tracking sensitive security operations
 * Provides comprehensive audit trail for compliance and security monitoring
 */

import { auditLog } from "../../lib/db/schema";
import { getDb } from "./context";
import type { SessionMetadata } from "./auth-helpers";

/**
 * Audit action types for categorizing security events
 */
export type AuditAction =
	| "login" // User logged in
	| "logout" // User logged out
	| "register" // New user registration
	| "guest_created" // Guest user created
	| "oauth_login" // OAuth login (GitHub, etc.)
	| "session_created" // Session created
	| "session_verified" // Session verified (authentication check)
	| "session_invalidated" // Session invalidated (logout, revocation)
	| "session_rotated" // Session rotated (fixation prevention)
	| "session_expired" // Session expired (timeout)
	| "failed_login" // Failed login attempt
	| "failed_register" // Failed registration attempt
	| "rate_limit_exceeded" // Rate limit triggered
	| "password_change" // Password changed (future)
	| "password_reset" // Password reset requested (future)
	| "account_created" // Account created via any method
	| "suspicious_activity" // Security anomaly detected
	| "system"; // System-generated event

/**
 * Audit log entry parameters
 */
export interface AuditLogParams {
	userId: string | null;
	action: AuditAction;
	resourceType?: string;
	resourceId?: string;
	success: boolean;
	errorMessage?: string;
	metadata?: SessionMetadata & Record<string, unknown>;
}

/**
 * Log an audit event to the database
 * This function is non-blocking - failures are logged but don't throw
 *
 * @param c - Hono context (for database access)
 * @param params - Audit log parameters
 */
export async function logAuditEvent(
	c: any,
	params: AuditLogParams,
): Promise<void> {
	try {
		const db = getDb(c);

		await db.insert(auditLog).values({
			userId: params.userId,
			action: params.action,
			resourceType: params.resourceType || null,
			resourceId: params.resourceId || null,
			success: params.success,
			errorMessage: params.errorMessage || null,
			userAgent: params.metadata?.userAgent || null,
			ipAddress: params.metadata?.ipAddress || null,
			metadata: params.metadata || null,
			timestamp: new Date(),
		});
	} catch (error) {
		// Log failure but don't throw - audit logging shouldn't break the app
		console.error("[AuditLogger] Failed to log audit event:", error);
	}
}

/**
 * Convenience function for logging successful authentication events
 */
export async function logAuthSuccess(
	c: any,
	userId: string,
	action: AuditAction,
	metadata?: SessionMetadata,
): Promise<void> {
	return logAuditEvent(c, {
		userId,
		action,
		resourceType: "user",
		resourceId: userId,
		success: true,
		metadata,
	});
}

/**
 * Convenience function for logging failed authentication events
 */
export async function logAuthFailure(
	c: any,
	action: AuditAction,
	errorMessage: string,
	metadata?: SessionMetadata,
): Promise<void> {
	return logAuditEvent(c, {
		userId: null, // No user ID for failed auth
		action,
		resourceType: "auth",
		success: false,
		errorMessage,
		metadata,
	});
}

/**
 * Convenience function for logging session lifecycle events
 */
export async function logSessionEvent(
	c: any,
	userId: string,
	action: "session_created" | "session_verified" | "session_invalidated" | "session_rotated" | "session_expired",
	sessionId: string,
	metadata?: SessionMetadata,
): Promise<void> {
	return logAuditEvent(c, {
		userId,
		action,
		resourceType: "session",
		resourceId: sessionId,
		success: true,
		metadata,
	});
}

/**
 * Convenience function for logging security anomalies
 */
export async function logSecurityEvent(
	c: any,
	userId: string | null,
	action: "suspicious_activity" | "rate_limit_exceeded",
	details: string,
	metadata?: SessionMetadata,
): Promise<void> {
	return logAuditEvent(c, {
		userId,
		action,
		resourceType: "security",
		success: false,
		errorMessage: details,
		metadata,
	});
}

/**
 * Query audit logs for a user
 * Useful for security reviews and compliance reporting
 *
 * @param c - Hono context
 * @param userId - User ID to query
 * @param limit - Maximum number of records to return
 * @returns Array of audit log entries
 */
export async function getUserAuditLogs(
	c: any,
	userId: string,
	limit = 100,
): Promise<AuditLog[]> {
	try {
		const db = getDb(c);
		const logs = await db
			.select()
			.from(auditLog)
			.where((auditLog: any) => auditLog.userId === userId)
			.orderBy((auditLog: any) => auditLog.timestamp)
			.limit(limit);

		return logs as AuditLog[];
	} catch (error) {
		console.error("[AuditLogger] Failed to query audit logs:", error);
		return [];
	}
}

/**
 * Query recent audit logs across all users
 * Useful for security monitoring and anomaly detection
 *
 * @param c - Hono context
 * @param options - Query options
 * @returns Array of audit log entries
 */
export async function getRecentAuditLogs(
	c: any,
	options: {
		limit?: number;
		actions?: AuditAction[];
		userId?: string;
		successOnly?: boolean;
	} = {},
): Promise<AuditLog[]> {
	try {
		const db = getDb(c);
		const { limit = 100, actions, userId, successOnly } = options;

		let query = db.select().from(auditLog);

		// Apply filters if provided
		if (userId) {
			query = query.where((auditLog: any) => auditLog.userId === userId);
		}
		if (actions && actions.length > 0) {
			query = query.where((auditLog: any) =>
				// @ts-expect-error - Drizzle dynamic query
				auditLog.action.inArray(actions),
			);
		}
		if (successOnly) {
			query = query.where((auditLog: any) => auditLog.success === 1);
		}

		// Order by timestamp descending (most recent first)
		query = query.orderBy((auditLog: any) => auditLog.timestamp).limit(limit);

		return (await query.execute()) as AuditLog[];
	} catch (error) {
		console.error("[AuditLogger] Failed to query recent audit logs:", error);
		return [];
	}
}
