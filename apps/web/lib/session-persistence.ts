"use client";

import { useCallback, useEffect, useRef } from "react";
import type { ChatMessage } from "./types";

/**
 * Session state that can be persisted
 */
export interface SessionState {
	chatId: string;
	messages: ChatMessage[];
	input: string;
	selectedModelId: string;
	visibilityType: string;
	timestamp: string;
	metadata?: SessionMetadata;
}

/**
 * Additional session metadata
 */
export interface SessionMetadata {
	title?: string;
	tags?: string[];
	folderId?: string;
	isPinned?: boolean;
	isArchived?: boolean;
	lastReadMessageId?: string;
	scrollPosition?: number;
}

/**
 * Storage keys for localStorage
 */
const STORAGE_KEYS = {
	ACTIVE_SESSION: "chat-active-session",
	SESSION_HISTORY: "chat-session-history",
	DRAFT_MESSAGES: "chat-draft-messages",
	SESSION_METADATA: "chat-session-metadata",
} as const;

/**
 * Maximum sessions to keep in history
 */
const MAX_SESSION_HISTORY = 100;

/**
 * Debounce delay for auto-save (ms)
 */
const AUTOSAVE_DELAY = 2000;

/**
 * Session history entry (lightweight)
 */
export interface SessionHistoryEntry {
	chatId: string;
	title: string;
	messageCount: number;
	timestamp: string;
	tags?: string[];
	folderId?: string;
}

/**
 * Hook for persisting chat session state
 *
 * Features:
 * - Auto-save with debouncing
 * - Draft message persistence
 * - Session history tracking
 * - Metadata management
 */
export function useSessionPersistence(chatId: string) {
	const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	);
	const isDirtyRef = useRef(false);

	/**
	 * Save session state to localStorage
	 */
	const saveSession = useCallback(
		(state: SessionState) => {
			try {
				const sessionData: SessionState = {
					...state,
					chatId,
					timestamp: new Date().toISOString(),
				};

				localStorage.setItem(
					`${STORAGE_KEYS.ACTIVE_SESSION}:${chatId}`,
					JSON.stringify(sessionData),
				);

				// Update session history
				updateSessionHistory({
					chatId,
					title: state.metadata?.title || "New chat",
					messageCount: state.messages.length,
					timestamp: sessionData.timestamp,
					tags: state.metadata?.tags,
					folderId: state.metadata?.folderId,
				});

				isDirtyRef.current = false;
				return true;
			} catch (error) {
				console.error("[SessionPersistence] Failed to save session:", error);
				return false;
			}
		},
		[chatId],
	);

	/**
	 * Load session state from localStorage
	 */
	const loadSession = useCallback((): SessionState | null => {
		try {
			const saved = localStorage.getItem(
				`${STORAGE_KEYS.ACTIVE_SESSION}:${chatId}`,
			);
			if (saved) {
				const session = JSON.parse(saved) as SessionState;
				// Only restore if recent (within 24 hours)
				const sessionAge = Date.now() - new Date(session.timestamp).getTime();
				if (sessionAge < 24 * 60 * 60 * 1000) {
					return session;
				}
			}
			return null;
		} catch (error) {
			console.error("[SessionPersistence] Failed to load session:", error);
			return null;
		}
	}, [chatId]);

	/**
	 * Debounced auto-save
	 */
	const debouncedSave = useCallback(
		(state: SessionState, delay = AUTOSAVE_DELAY) => {
			isDirtyRef.current = true;

			if (saveTimeoutRef.current) {
				clearTimeout(saveTimeoutRef.current);
			}

			saveTimeoutRef.current = setTimeout(() => {
				saveSession(state);
			}, delay);
		},
		[saveSession],
	);

	/**
	 * Save draft message
	 */
	const saveDraft = useCallback(
		(input: string) => {
			try {
				localStorage.setItem(
					`${STORAGE_KEYS.DRAFT_MESSAGES}:${chatId}`,
					JSON.stringify({
						input,
						timestamp: new Date().toISOString(),
					}),
				);
			} catch (error) {
				console.error("[SessionPersistence] Failed to save draft:", error);
			}
		},
		[chatId],
	);

	/**
	 * Load draft message
	 */
	const loadDraft = useCallback((): string => {
		try {
			const saved = localStorage.getItem(
				`${STORAGE_KEYS.DRAFT_MESSAGES}:${chatId}`,
			);
			if (saved) {
				const draft = JSON.parse(saved) as { input: string; timestamp: string };
				// Only restore if recent (within 1 hour)
				const draftAge = Date.now() - new Date(draft.timestamp).getTime();
				if (draftAge < 60 * 60 * 1000) {
					return draft.input;
				}
			}
			return "";
		} catch (error) {
			console.error("[SessionPersistence] Failed to load draft:", error);
			return "";
		}
	}, [chatId]);

	/**
	 * Clear session data
	 */
	const clearSession = useCallback(() => {
		try {
			localStorage.removeItem(`${STORAGE_KEYS.ACTIVE_SESSION}:${chatId}`);
			localStorage.removeItem(`${STORAGE_KEYS.DRAFT_MESSAGES}:${chatId}`);
		} catch (error) {
			console.error("[SessionPersistence] Failed to clear session:", error);
		}
	}, [chatId]);

	/**
	 * Update session metadata
	 */
	const updateMetadata = useCallback(
		(metadata: Partial<SessionMetadata>) => {
			try {
				const current = loadSession();
				if (current) {
					const updated: SessionState = {
						...current,
						metadata: {
							...current.metadata,
							...metadata,
						},
					};
					saveSession(updated);
				} else {
					// Save just metadata
					const metaKey = `${STORAGE_KEYS.SESSION_METADATA}:${chatId}`;
					const existing = JSON.parse(localStorage.getItem(metaKey) || "{}");
					localStorage.setItem(
						metaKey,
						JSON.stringify({ ...existing, ...metadata }),
					);
				}
			} catch (error) {
				console.error("[SessionPersistence] Failed to update metadata:", error);
			}
		},
		[chatId, loadSession, saveSession],
	);

	/**
	 * Get session metadata
	 */
	const getMetadata = useCallback((): SessionMetadata | null => {
		try {
			const metaKey = `${STORAGE_KEYS.SESSION_METADATA}:${chatId}`;
			const saved = localStorage.getItem(metaKey);
			return saved ? JSON.parse(saved) : null;
		} catch (error) {
			console.error("[SessionPersistence] Failed to get metadata:", error);
			return null;
		}
	}, [chatId]);

	// Cleanup on unmount - save if dirty
	useEffect(() => {
		return () => {
			if (saveTimeoutRef.current) {
				clearTimeout(saveTimeoutRef.current);
			}
			if (isDirtyRef.current) {
				// Trigger immediate save on unmount if dirty
				// Note: This won't have access to current state here,
				// the component should call saveSession before unmount
			}
		};
	}, []);

	return {
		saveSession,
		loadSession,
		debouncedSave,
		saveDraft,
		loadDraft,
		clearSession,
		updateMetadata,
		getMetadata,
	};
}

/**
 * Update session history entry
 */
function updateSessionHistory(entry: SessionHistoryEntry) {
	try {
		const history = getSessionHistory();
		const updated = [history.filter((h) => h.chatId !== entry.chatId), entry]
			.flat()
			.slice(-MAX_SESSION_HISTORY);

		localStorage.setItem(STORAGE_KEYS.SESSION_HISTORY, JSON.stringify(updated));
	} catch (error) {
		console.error("[SessionPersistence] Failed to update history:", error);
	}
}

/**
 * Get all session history
 */
export function getSessionHistory(): SessionHistoryEntry[] {
	try {
		const saved = localStorage.getItem(STORAGE_KEYS.SESSION_HISTORY);
		return saved ? JSON.parse(saved) : [];
	} catch (error) {
		console.error("[SessionPersistence] Failed to get history:", error);
		return [];
	}
}

/**
 * Clear all session data
 */
export function clearAllSessions() {
	try {
		// Clear all session-related keys
		Object.values(STORAGE_KEYS).forEach((key) => {
			localStorage.removeItem(key);
		});

		// Clear individual session data
		const sessionKeys = Object.keys(localStorage).filter(
			(key) =>
				key.startsWith(STORAGE_KEYS.ACTIVE_SESSION) ||
				key.startsWith(STORAGE_KEYS.DRAFT_MESSAGES) ||
				key.startsWith(STORAGE_KEYS.SESSION_METADATA),
		);

		sessionKeys.forEach((key) => {
			localStorage.removeItem(key);
		});
	} catch (error) {
		console.error("[SessionPersistence] Failed to clear all sessions:", error);
	}
}

/**
 * Export all sessions as JSON
 */
export function exportSessions(): string {
	try {
		const data = {
			version: "1.0",
			exportedAt: new Date().toISOString(),
			sessions: getSessionHistory(),
		};
		return JSON.stringify(data, null, 2);
	} catch (error) {
		console.error("[SessionPersistence] Failed to export sessions:", error);
		return "{}";
	}
}

/**
 * Import sessions from JSON
 */
export function importSessions(json: string): boolean {
	try {
		const data = JSON.parse(json);
		if (!data.sessions || !Array.isArray(data.sessions)) {
			throw new Error("Invalid import format");
		}

		const history = getSessionHistory();
		const merged = [...history, ...data.sessions]
			.reduce((acc, session) => {
				if (
					!acc.find((s: SessionHistoryEntry) => s.chatId === session.chatId)
				) {
					acc.push(session);
				}
				return acc;
			}, [] as SessionHistoryEntry[])
			.slice(-MAX_SESSION_HISTORY);

		localStorage.setItem(STORAGE_KEYS.SESSION_HISTORY, JSON.stringify(merged));
		return true;
	} catch (error) {
		console.error("[SessionPersistence] Failed to import sessions:", error);
		return false;
	}
}
