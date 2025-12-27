"use client";

import { useCallback, useEffect, useRef } from "react";

// Simple UUID generator for browser
function generateUUID(): string {
	if (typeof crypto !== "undefined" && crypto.randomUUID) {
		return crypto.randomUUID();
	}
	// Fallback for older browsers
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		const v = c === "x" ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

/**
 * Artifact state that can be persisted
 */
export interface ArtifactState {
	id: string;
	title: string;
	kind: string;
	content: string;
	isVisible: boolean;
	viewMode: "preview" | "source" | "split";
	panelWidth: number;
	createdAt: string;
	updatedAt: string;
	metadata?: Record<string, unknown>;
}

/**
 * Storage keys for localStorage
 */
const STORAGE_KEYS = {
	ARTIFACT_STATE: "artifact-state",
	ARTIFACT_HISTORY: "artifact-history",
	ARTIFACT_SHARES: "artifact-shares",
} as const;

/**
 * Maximum number of artifacts to keep in history
 */
const MAX_HISTORY_SIZE = 50;

/**
 * Hook for persisting artifact state
 *
 * Features:
 * - Auto-save to localStorage
 * - History tracking with undo/redo
 * - Export/import functionality
 * - Share link generation
 */
export function useArtifactPersistence(artifactId: string) {
	const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	);

	/**
	 * Save artifact state to localStorage
	 */
	const saveState = useCallback(
		(state: ArtifactState) => {
			try {
				// Save current state
				const stateToSave: ArtifactState = {
					...state,
					updatedAt: new Date().toISOString(),
				};
				localStorage.setItem(
					`${STORAGE_KEYS.ARTIFACT_STATE}:${artifactId}`,
					JSON.stringify(stateToSave),
				);

				// Add to history
				const history = getHistory();
				const updatedHistory = [
					...history.filter((item) => item.id !== artifactId),
					{
						id: artifactId,
						title: state.title,
						kind: state.kind,
						createdAt: state.createdAt,
						updatedAt: stateToSave.updatedAt,
					},
				].slice(-MAX_HISTORY_SIZE);

				localStorage.setItem(
					STORAGE_KEYS.ARTIFACT_HISTORY,
					JSON.stringify(updatedHistory),
				);

				return true;
			} catch (error) {
				console.error("Failed to save artifact state:", error);
				return false;
			}
		},
		[artifactId],
	);

	/**
	 * Load artifact state from localStorage
	 */
	const loadState = useCallback((): ArtifactState | null => {
		try {
			const saved = localStorage.getItem(
				`${STORAGE_KEYS.ARTIFACT_STATE}:${artifactId}`,
			);
			if (saved) {
				return JSON.parse(saved) as ArtifactState;
			}
			return null;
		} catch (error) {
			console.error("Failed to load artifact state:", error);
			return null;
		}
	}, [artifactId]);

	/**
	 * Debounced save with automatic cleanup
	 */
	const debouncedSave = useCallback(
		(state: ArtifactState, delay = 1000) => {
			if (saveTimeoutRef.current) {
				clearTimeout(saveTimeoutRef.current);
			}

			saveTimeoutRef.current = setTimeout(() => {
				saveState(state);
			}, delay);
		},
		[saveState],
	);

	/**
	 * Clear artifact state
	 */
	const clearState = useCallback(() => {
		try {
			localStorage.removeItem(`${STORAGE_KEYS.ARTIFACT_STATE}:${artifactId}`);
			return true;
		} catch (error) {
			console.error("Failed to clear artifact state:", error);
			return false;
		}
	}, [artifactId]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (saveTimeoutRef.current) {
				clearTimeout(saveTimeoutRef.current);
			}
		};
	}, []);

	return {
		saveState,
		loadState,
		debouncedSave,
		clearState,
	};
}

/**
 * Get artifact history from localStorage
 */
export function getHistory(): Array<{
	id: string;
	title: string;
	kind: string;
	createdAt: string;
	updatedAt: string;
}> {
	try {
		const saved = localStorage.getItem(STORAGE_KEYS.ARTIFACT_HISTORY);
		return saved ? JSON.parse(saved) : [];
	} catch (error) {
		console.error("Failed to get artifact history:", error);
		return [];
	}
}

/**
 * Clear all artifact history
 */
export function clearHistory(): void {
	try {
		localStorage.removeItem(STORAGE_KEYS.ARTIFACT_HISTORY);
	} catch (error) {
		console.error("Failed to clear artifact history:", error);
	}
}

/**
 * Generate a shareable link for an artifact
 *
 * Creates a compressed shareable URL with artifact content.
 * For production, this should upload to a server and return a URL.
 */
export function generateShareLink(artifact: ArtifactState): string {
	try {
		// Create share data
		const shareData = {
			id: generateUUID(),
			title: artifact.title,
			kind: artifact.kind,
			content: artifact.content,
			createdAt: new Date().toISOString(),
		};

		// Save to localStorage (in production, upload to server)
		const shares = getShares();
		shares.push(shareData);
		localStorage.setItem(STORAGE_KEYS.ARTIFACT_SHARES, JSON.stringify(shares));

		// Generate share URL
		const url = new URL(window.location.href);
		url.searchParams.set("share", shareData.id);

		return url.toString();
	} catch (error) {
		console.error("Failed to generate share link:", error);
		return "";
	}
}

/**
 * Get shared artifact by ID
 */
export function getSharedArtifact(shareId: string): ArtifactState | null {
	try {
		const shares = getShares();
		const share = shares.find((s) => s.id === shareId);
		if (share) {
			return {
				id: share.id,
				title: share.title,
				kind: share.kind,
				content: share.content,
				isVisible: true,
				viewMode: "preview",
				panelWidth: 400,
				createdAt: share.createdAt,
				updatedAt: share.createdAt,
			};
		}
		return null;
	} catch (error) {
		console.error("Failed to get shared artifact:", error);
		return null;
	}
}

/**
 * Get all shares from localStorage
 */
function getShares(): Array<{
	id: string;
	title: string;
	kind: string;
	content: string;
	createdAt: string;
}> {
	try {
		const saved = localStorage.getItem(STORAGE_KEYS.ARTIFACT_SHARES);
		return saved ? JSON.parse(saved) : [];
	} catch (error) {
		console.error("Failed to get shares:", error);
		return [];
	}
}

/**
 * Export artifact as JSON file
 */
export function exportArtifact(artifact: ArtifactState): void {
	try {
		const data = {
			...artifact,
			exportedAt: new Date().toISOString(),
			version: "1.0",
		};

		const blob = new Blob([JSON.stringify(data, null, 2)], {
			type: "application/json",
		});
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = `${artifact.title.replace(/[^a-z0-9]/gi, "-")}.json`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	} catch (error) {
		console.error("Failed to export artifact:", error);
	}
}

/**
 * Import artifact from JSON file
 */
export async function importArtifact(
	file: File,
): Promise<ArtifactState | null> {
	try {
		const text = await file.text();
		const data = JSON.parse(text);

		// Validate basic structure
		if (!data.title || !data.kind || data.content === undefined) {
			throw new Error("Invalid artifact file format");
		}

		return {
			id: data.id || generateUUID(),
			title: data.title,
			kind: data.kind,
			content: data.content,
			isVisible: true,
			viewMode: data.viewMode || "preview",
			panelWidth: data.panelWidth || 400,
			createdAt: data.createdAt || new Date().toISOString(),
			updatedAt: data.updatedAt || new Date().toISOString(),
			metadata: data.metadata,
		};
	} catch (error) {
		console.error("Failed to import artifact:", error);
		return null;
	}
}

/**
 * Clone an artifact (creates a new copy)
 */
export function cloneArtifact(artifact: ArtifactState): ArtifactState {
	return {
		...artifact,
		id: generateUUID(),
		title: `${artifact.title} (copy)`,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	};
}
