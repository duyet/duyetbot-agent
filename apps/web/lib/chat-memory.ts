"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Memory entry type for storing important conversation context
 */
export interface MemoryEntry {
	id: string;
	chatId: string;
	type: MemoryType;
	content: string;
	importance: number; // 0-1
	timestamp: string;
	accessCount: number;
	lastAccessed: string;
	metadata?: Record<string, unknown>;
}

/**
 * Types of memory entries
 */
export type MemoryType =
	| "fact" // Important facts mentioned
	| "preference" // User preferences
	| "context" // Important context
	| "decision" // Decisions made
	| "code" // Code snippets/solutions
	| "reference"; // Reference information

/**
 * Memory storage configuration
 */
const MEMORY_CONFIG = {
	MAX_MEMORY_PER_CHAT: 50,
	MAX_GLOBAL_MEMORY: 200,
	STORAGE_KEY: "chat-memory-store",
	IMPORTANCE_DECAY_RATE: 0.01, // Decay per day
	MIN_IMPORTANCE: 0.1,
} as const;

/**
 * Hook for managing chat memory
 *
 * Features:
 * - Store important conversation context
 * - Retrieve relevant memories by type and content
 * - Importance-based scoring with decay
 * - Global and per-chat memory scopes
 */
export function useChatMemory(chatId: string) {
	const [memories, setMemories] = useState<MemoryEntry[]>([]);
	const [isLoaded, setIsLoaded] = useState(false);

	/**
	 * Load memories from localStorage
	 */
	const loadMemories = useCallback(() => {
		try {
			const stored = localStorage.getItem(MEMORY_CONFIG.STORAGE_KEY);
			if (stored) {
				const allMemories = JSON.parse(stored) as MemoryEntry[];
				const chatMemories = allMemories.filter((m) => m.chatId === chatId);
				// Apply importance decay
				const decayed = applyImportanceDecay(chatMemories);
				setMemories(decayed);
			}
			setIsLoaded(true);
		} catch (error) {
			console.error("[ChatMemory] Failed to load memories:", error);
			setIsLoaded(true);
		}
	}, [chatId]);

	// Load memories on mount
	useEffect(() => {
		loadMemories();
	}, [loadMemories]);

	/**
	 * Save all memories to localStorage
	 */
	const saveMemories = useCallback(
		(updatedMemories: MemoryEntry[]) => {
			try {
				// Load all memories
				const stored = localStorage.getItem(MEMORY_CONFIG.STORAGE_KEY);
				const allMemories: MemoryEntry[] = stored ? JSON.parse(stored) : [];

				// Remove old memories for this chat
				const filtered = allMemories.filter((m) => m.chatId !== chatId);

				// Add updated memories
				const merged = [...filtered, ...updatedMemories];

				// Limit total memories
				const limited = merged
					.sort((a, b) => b.importance - a.importance)
					.slice(-MEMORY_CONFIG.MAX_GLOBAL_MEMORY);

				localStorage.setItem(
					MEMORY_CONFIG.STORAGE_KEY,
					JSON.stringify(limited),
				);
			} catch (error) {
				console.error("[ChatMemory] Failed to save memories:", error);
			}
		},
		[chatId],
	);

	/**
	 * Add a new memory entry
	 */
	const addMemory = useCallback(
		(
			type: MemoryType,
			content: string,
			importance = 0.5,
			metadata?: Record<string, unknown>,
		) => {
			const newMemory: MemoryEntry = {
				id: generateId(),
				chatId,
				type,
				content,
				importance: Math.max(0, Math.min(1, importance)),
				timestamp: new Date().toISOString(),
				accessCount: 0,
				lastAccessed: new Date().toISOString(),
				metadata,
			};

			const updated = [...memories, newMemory]
				.sort((a, b) => b.importance - a.importance)
				.slice(-MEMORY_CONFIG.MAX_MEMORY_PER_CHAT);

			setMemories(updated);
			saveMemories(updated);

			return newMemory;
		},
		[chatId, memories, saveMemories],
	);

	/**
	 * Update an existing memory
	 */
	const updateMemory = useCallback(
		(id: string, updates: Partial<MemoryEntry>) => {
			const updated = memories.map((m) =>
				m.id === id
					? {
							...m,
							...updates,
							lastAccessed: new Date().toISOString(),
							accessCount: m.accessCount + 1,
						}
					: m,
			);

			setMemories(updated);
			saveMemories(updated);
		},
		[memories, saveMemories],
	);

	/**
	 * Delete a memory
	 */
	const deleteMemory = useCallback(
		(id: string) => {
			const updated = memories.filter((m) => m.id !== id);
			setMemories(updated);
			saveMemories(updated);
		},
		[memories, saveMemories],
	);

	/**
	 * Get memories by type
	 */
	const getMemoriesByType = useCallback(
		(type: MemoryType) => {
			return memories.filter((m) => m.type === type);
		},
		[memories],
	);

	/**
	 * Search memories by content
	 */
	const searchMemories = useCallback(
		(query: string) => {
			const lowerQuery = query.toLowerCase();
			return memories.filter((m) =>
				m.content.toLowerCase().includes(lowerQuery),
			);
		},
		[memories],
	);

	/**
	 * Get important memories (importance > threshold)
	 */
	const getImportantMemories = useCallback(
		(threshold = 0.7) => {
			return memories.filter((m) => m.importance >= threshold);
		},
		[memories],
	);

	/**
	 * Get recent memories (within time range)
	 */
	const getRecentMemories = useCallback(
		(hours = 24) => {
			const cutoff = Date.now() - hours * 60 * 60 * 1000;
			return memories.filter((m) => new Date(m.timestamp).getTime() > cutoff);
		},
		[memories],
	);

	/**
	 * Boost memory importance
	 */
	const boostImportance = useCallback(
		(id: string, amount = 0.1) => {
			const memory = memories.find((m) => m.id === id);
			if (memory) {
				const updatedImportance = Math.min(1, memory.importance + amount);
				updateMemory(id, { importance: updatedImportance });
			}
		},
		[memories, updateMemory],
	);

	/**
	 * Decay all memory importance
	 */
	const decayImportance = useCallback(() => {
		const decayed = memories.map((m) => ({
			...m,
			importance: Math.max(
				MEMORY_CONFIG.MIN_IMPORTANCE,
				m.importance - MEMORY_CONFIG.IMPORTANCE_DECAY_RATE,
			),
		}));

		setMemories(decayed);
		saveMemories(decayed);
	}, [memories, saveMemories]);

	/**
	 * Get context for AI (formatted string of relevant memories)
	 */
	const getContextForAI = useCallback(
		(maxTokens = 500) => {
			// Get important memories first
			const important = getImportantMemories(0.6);
			const recent = getRecentMemories(4);

			// Combine and deduplicate
			const combined = [
				...important,
				...recent.filter((r) => !important.find((i) => i.id === r.id)),
			];

			// Format as context
			let context = "";
			let tokenCount = 0;

			for (const memory of combined) {
				const text = `[${memory.type}] ${memory.content}\n`;
				if (tokenCount + text.length > maxTokens) break;
				context += text;
				tokenCount += text.length;

				// Update access count
				updateMemory(memory.id, {});
			}

			return context.trim();
		},
		[getImportantMemories, getRecentMemories, updateMemory],
	);

	return {
		memories,
		isLoaded,
		addMemory,
		updateMemory,
		deleteMemory,
		getMemoriesByType,
		searchMemories,
		getImportantMemories,
		getRecentMemories,
		boostImportance,
		decayImportance,
		getContextForAI,
	};
}

/**
 * Generate unique ID
 */
function generateId(): string {
	return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Apply importance decay based on time
 */
function applyImportanceDecay(memories: MemoryEntry[]): MemoryEntry[] {
	const now = Date.now();
	const oneDay = 24 * 60 * 60 * 1000;

	return memories.map((memory) => {
		const ageInDays = (now - new Date(memory.timestamp).getTime()) / oneDay;
		const decayedImportance = Math.max(
			MEMORY_CONFIG.MIN_IMPORTANCE,
			memory.importance - ageInDays * MEMORY_CONFIG.IMPORTANCE_DECAY_RATE,
		);

		return {
			...memory,
			importance: decayedImportance,
		};
	});
}

/**
 * Get all memories across all chats
 */
export function getAllMemories(): MemoryEntry[] {
	try {
		const stored = localStorage.getItem(MEMORY_CONFIG.STORAGE_KEY);
		return stored ? JSON.parse(stored) : [];
	} catch (error) {
		console.error("[ChatMemory] Failed to get all memories:", error);
		return [];
	}
}

/**
 * Clear all memories
 */
export function clearAllMemories() {
	try {
		localStorage.removeItem(MEMORY_CONFIG.STORAGE_KEY);
	} catch (error) {
		console.error("[ChatMemory] Failed to clear memories:", error);
	}
}

/**
 * Export memories as JSON
 */
export function exportMemories(): string {
	try {
		const data = {
			version: "1.0",
			exportedAt: new Date().toISOString(),
			memories: getAllMemories(),
		};
		return JSON.stringify(data, null, 2);
	} catch (error) {
		console.error("[ChatMemory] Failed to export memories:", error);
		return "{}";
	}
}

/**
 * Import memories from JSON
 */
export function importMemories(json: string): boolean {
	try {
		const data = JSON.parse(json);
		if (!data.memories || !Array.isArray(data.memories)) {
			throw new Error("Invalid import format");
		}

		localStorage.setItem(
			MEMORY_CONFIG.STORAGE_KEY,
			JSON.stringify(data.memories),
		);
		return true;
	} catch (error) {
		console.error("[ChatMemory] Failed to import memories:", error);
		return false;
	}
}
