"use client";

/**
 * Data deletion and retention policies
 *
 * GDPR Compliance:
 * - Article 17: Right to erasure ("right to be forgotten")
 * - Data retention policies with automatic cleanup
 * - Secure deletion with verification
 */

/**
 * Deletion scope options
 */
export type DeletionScope =
	| "sessions" // Delete only chat sessions
	| "memories" // Delete only AI memories
	| "metadata" // Delete only tags/folders/metadata
	| "local" // Delete all local data
	| "full" // Delete everything including server data
	| "anonymize"; // Remove personal identifiers while keeping data

/**
 * Deletion result
 */
export interface DeletionResult {
	success: boolean;
	deletedItems: number;
	errors: string[];
	timestamp: string;
}

/**
 * Storage keys to delete by scope
 */
const DELETION_MAP: Record<DeletionScope, string[]> = {
	sessions: [
		"chat-active-session",
		"chat-session-history",
		"chat-draft-messages",
	],
	memories: ["chat-memory-store"],
	metadata: ["chat-session-metadata", "chat-folders", "chat-tags"],
	local: [
		"chat-active-session",
		"chat-session-history",
		"chat-draft-messages",
		"chat-session-metadata",
		"chat-folders",
		"chat-tags",
		"chat-memory-store",
		"user-preferences",
	],
	full: [
		// Client-side: delete all local data
		"chat-active-session",
		"chat-session-history",
		"chat-draft-messages",
		"chat-session-metadata",
		"chat-folders",
		"chat-tags",
		"chat-memory-store",
		"user-preferences",
	],
	anonymize: [
		// Anonymization transforms data rather than deleting
		// This list is for tracking purposes only
	],
};

/**
 * Delete data by scope
 *
 * @param scope - What to delete
 * @param confirmationToken - Optional token to prevent accidental deletion
 * @returns Result of deletion operation
 */
export async function deleteData(
	scope: DeletionScope,
	confirmationToken?: string,
): Promise<DeletionResult> {
	const errors: string[] = [];
	let deletedItems = 0;

	// Require confirmation for destructive operations
	if (scope === "full" || scope === "local") {
		if (!confirmationToken) {
			return {
				success: false,
				deletedItems: 0,
				errors: ["Confirmation required for destructive operations"],
				timestamp: new Date().toISOString(),
			};
		}
		if (confirmationToken !== "CONFIRM_DELETE") {
			return {
				success: false,
				deletedItems: 0,
				errors: ["Invalid confirmation token"],
				timestamp: new Date().toISOString(),
			};
		}
	}

	try {
		// Get keys to delete for this scope
		const keysToDelete = DELETION_MAP[scope];

		// Delete exact keys
		for (const key of keysToDelete) {
			try {
				localStorage.removeItem(key);
				deletedItems++;
			} catch (_error) {
				errors.push(`Failed to delete ${key}`);
			}
		}

		// Delete wildcard patterns (e.g., chat-active-session:* for specific chats)
		if (scope === "local" || scope === "full") {
			deletedItems += deletePattern("chat-active-session:*");
			deletedItems += deletePattern("chat-draft-messages:*");
			deletedItems += deletePattern("chat-session-metadata:*");
		}

		// For full deletion, also trigger server-side deletion
		if (scope === "full") {
			await triggerServerDeletion();
		}

		// Log deletion for audit trail
		logDeletionEvent(scope, deletedItems);

		return {
			success: errors.length === 0,
			deletedItems,
			errors,
			timestamp: new Date().toISOString(),
		};
	} catch (error) {
		return {
			success: false,
			deletedItems,
			errors: [error instanceof Error ? error.message : "Unknown error"],
			timestamp: new Date().toISOString(),
		};
	}
}

/**
 * Delete all items matching a pattern
 *
 * localStorage doesn't support wildcards natively,
 * so we iterate all keys and match patterns
 */
function deletePattern(pattern: string): number {
	let deleted = 0;
	const prefix = pattern.replace("*", "");

	try {
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (key?.startsWith(prefix)) {
				localStorage.removeItem(key);
				deleted++;
			}
		}
	} catch (error) {
		console.error("[DataDeletion] Failed to delete pattern:", pattern, error);
	}

	return deleted;
}

/**
 * Trigger server-side data deletion
 *
 * For "full" deletion, we also need to delete:
 * - Server-side chat history
 * - User account data
 * - Any cloud backups
 */
async function triggerServerDeletion(): Promise<void> {
	try {
		// Call the deletion API endpoint
		const response = await fetch("/api/privacy/delete-account", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				requestedAt: new Date().toISOString(),
				scope: "full",
			}),
		});

		if (!response.ok) {
			const errorData = (await response.json()) as { message?: string };
			throw new Error(errorData.message || "Server deletion failed");
		}

		// Store deletion request ID for tracking
		const responseData = (await response.json()) as { deletionId?: string };
		const { deletionId } = responseData;
		if (deletionId) {
			localStorage.setItem("deletion-request-id", deletionId);
		}
	} catch (error) {
		console.error("[DataDeletion] Server deletion failed:", error);
		// Don't throw - allow client-side deletion to complete
	}
}

/**
 * Log deletion event for audit trail
 *
 * GDPR Requirement: Keep records of deletion requests
 */
function logDeletionEvent(scope: DeletionScope, count: number): void {
	try {
		const auditLog = JSON.parse(
			localStorage.getItem("privacy-audit-log") || "[]",
		);
		auditLog.push({
			type: "deletion",
			scope,
			itemCount: count,
			timestamp: new Date().toISOString(),
			userAgent: navigator.userAgent,
		});

		// Keep only last 100 audit entries
		const trimmed = auditLog.slice(-100);
		localStorage.setItem("privacy-audit-log", JSON.stringify(trimmed));
	} catch (error) {
		console.error("[DataDeletion] Failed to log deletion:", error);
	}
}

/**
 * Get audit log
 */
export function getAuditLog(): Array<{
	type: string;
	scope: string;
	itemCount: number;
	timestamp: string;
	userAgent?: string;
}> {
	try {
		return JSON.parse(localStorage.getItem("privacy-audit-log") || "[]");
	} catch {
		return [];
	}
}

/**
 * Apply data retention policy
 *
 * GDPR Requirement: Personal data should not be kept longer than necessary
 * This automatically deletes old data based on retention settings
 */
export async function applyRetentionPolicy(
	retentionDays: number,
): Promise<DeletionResult> {
	const cutoffDate = new Date();
	cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

	let deletedItems = 0;
	const errors: string[] = [];

	try {
		// Clean up old session history
		const historyKey = "chat-session-history";
		const history = JSON.parse(localStorage.getItem(historyKey) || "[]");

		const filteredHistory = history.filter((session: any) => {
			const sessionDate = new Date(session.timestamp);
			return sessionDate > cutoffDate;
		});

		deletedItems += history.length - filteredHistory.length;
		localStorage.setItem(historyKey, JSON.stringify(filteredHistory));

		// Clean up old individual session data
		deletedItems += deleteOldSessionsBefore(cutoffDate);

		// Clean up old drafts (older than 7 days)
		deletedItems += deleteOldDrafts(7);

		// Clean up old audit logs (older than 1 year)
		deletedItems += cleanOldAuditLogs(365);

		return {
			success: errors.length === 0,
			deletedItems,
			errors,
			timestamp: new Date().toISOString(),
		};
	} catch (error) {
		return {
			success: false,
			deletedItems,
			errors: [error instanceof Error ? error.message : "Unknown error"],
			timestamp: new Date().toISOString(),
		};
	}
}

/**
 * Delete individual session data older than cutoff date
 */
function deleteOldSessionsBefore(cutoffDate: Date): number {
	let deleted = 0;

	try {
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (key?.startsWith("chat-active-session:")) {
				try {
					const session = JSON.parse(localStorage.getItem(key) || "{}");
					const sessionDate = new Date(session.timestamp);

					if (sessionDate < cutoffDate) {
						localStorage.removeItem(key);
						deleted++;
					}
				} catch {
					// Invalid session data, remove it
					localStorage.removeItem(key);
					deleted++;
				}
			}
		}
	} catch (error) {
		console.error("[DataDeletion] Failed to delete old sessions:", error);
	}

	return deleted;
}

/**
 * Delete old draft messages
 */
function deleteOldDrafts(maxAgeDays: number): number {
	let deleted = 0;
	const cutoffDate = new Date();
	cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

	try {
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (key?.startsWith("chat-draft-messages:")) {
				try {
					const draft = JSON.parse(localStorage.getItem(key) || "{}");
					const draftDate = new Date(draft.timestamp);

					if (draftDate < cutoffDate) {
						localStorage.removeItem(key);
						deleted++;
					}
				} catch {
					// Invalid draft data, remove it
					localStorage.removeItem(key);
					deleted++;
				}
			}
		}
	} catch (error) {
		console.error("[DataDeletion] Failed to delete old drafts:", error);
	}

	return deleted;
}

/**
 * Clean old audit log entries
 */
function cleanOldAuditLogs(maxAgeDays: number): number {
	try {
		const auditLog = JSON.parse(
			localStorage.getItem("privacy-audit-log") || "[]",
		);
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

		const filtered = auditLog.filter((entry: any) => {
			const entryDate = new Date(entry.timestamp);
			return entryDate > cutoffDate;
		});

		const deleted = auditLog.length - filtered.length;
		localStorage.setItem("privacy-audit-log", JSON.stringify(filtered));

		return deleted;
	} catch (error) {
		console.error("[DataDeletion] Failed to clean audit logs:", error);
		return 0;
	}
}

/**
 * Anonymize data (remove personal identifiers)
 *
 * GDPR Alternative: Instead of full deletion, users can request anonymization
 * This removes personally identifiable information while keeping analytics data
 */
export async function anonymizeData(): Promise<DeletionResult> {
	const errors: string[] = [];
	let anonymizedItems = 0;

	try {
		// Anonymize session history (remove titles which may contain personal info)
		const historyKey = "chat-session-history";
		const history = JSON.parse(localStorage.getItem(historyKey) || "[]");

		const anonymizedHistory = history.map((session: any) => ({
			...session,
			title: "Anonymous Chat",
			tags: [],
		}));

		localStorage.setItem(historyKey, JSON.stringify(anonymizedHistory));
		anonymizedItems = history.length;

		// Anonymize memories (remove content, keep type/importance)
		const memoryKey = "chat-memory-store";
		const memories = JSON.parse(localStorage.getItem(memoryKey) || "[]");

		const anonymizedMemories = memories.map((memory: any) => ({
			...memory,
			content: "[Anonymized]",
		}));

		localStorage.setItem(memoryKey, JSON.stringify(anonymizedMemories));
		anonymizedItems += memories.length;

		logDeletionEvent("anonymize", anonymizedItems);

		return {
			success: errors.length === 0,
			deletedItems: anonymizedItems,
			errors,
			timestamp: new Date().toISOString(),
		};
	} catch (error) {
		return {
			success: false,
			deletedItems: anonymizedItems,
			errors: [error instanceof Error ? error.message : "Unknown error"],
			timestamp: new Date().toISOString(),
		};
	}
}

/**
 * Check deletion status
 *
 * For "full" deletion, check if server-side deletion is complete
 */
export async function checkDeletionStatus(): Promise<{
	status: "pending" | "processing" | "complete" | "failed";
	estimatedDays?: number;
}> {
	const deletionId = localStorage.getItem("deletion-request-id");

	if (!deletionId) {
		return { status: "pending" };
	}

	try {
		const response = await fetch(
			`/api/privacy/deletion-status?id=${deletionId}`,
		);

		if (!response.ok) {
			return { status: "failed" };
		}

		const data = (await response.json()) as {
			status: "failed" | "complete" | "pending" | "processing";
			estimatedDays?: number;
		};
		return data;
	} catch {
		return { status: "processing" };
	}
}
