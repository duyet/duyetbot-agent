/**
 * IndexedDB wrapper for offline storage
 * Stores messages and sessions for offline access
 */

const DB_NAME = "duyetbot-offline";
const DB_VERSION = 1;

// Store names
export const STORES = {
	MESSAGES: "messages",
	SESSIONS: "sessions",
	DRAFTS: "drafts",
} as const;

// Message type for offline storage
export type OfflineMessage = {
	id: string;
	sessionId: string;
	role: "user" | "assistant" | "system";
	content: string;
	timestamp: number;
	pending?: boolean; // True if message hasn't been synced to server
	attachments?: Array<{
		name: string;
		type: string;
		data: ArrayBuffer; // Store file data as ArrayBuffer
	}>;
};

// Session type for offline storage
export type OfflineSession = {
	id: string;
	title: string;
	timestamp: number;
	messageCount: number;
	model?: string;
	pending?: boolean; // True if session hasn't been synced to server
};

// Draft message type
export type OfflineDraft = {
	sessionId: string;
	content: string;
	timestamp: number;
};

class IndexedDBHelper {
	private db: IDBDatabase | null = null;

	/**
	 * Initialize the database
	 */
	async init(): Promise<void> {
		if (this.db) {
			return;
		}

		return new Promise((resolve, reject) => {
			const request = indexedDB.open(DB_NAME, DB_VERSION);

			request.onerror = () => {
				reject(new Error(`Failed to open IndexedDB: ${request.error}`));
			};

			request.onsuccess = () => {
				this.db = request.result;
				resolve();
			};

			request.onupgradeneeded = (event) => {
				const db = (event.target as IDBOpenDBRequest).result;

				// Create messages store
				if (!db.objectStoreNames.contains(STORES.MESSAGES)) {
					const messageStore = db.createObjectStore(STORES.MESSAGES, {
						keyPath: "id",
					});
					messageStore.createIndex("sessionId", "sessionId", { unique: false });
					messageStore.createIndex("timestamp", "timestamp", { unique: false });
					messageStore.createIndex("pending", "pending", { unique: false });
				}

				// Create sessions store
				if (!db.objectStoreNames.contains(STORES.SESSIONS)) {
					const sessionStore = db.createObjectStore(STORES.SESSIONS, {
						keyPath: "id",
					});
					sessionStore.createIndex("timestamp", "timestamp", { unique: false });
					sessionStore.createIndex("pending", "pending", { unique: false });
				}

				// Create drafts store
				if (!db.objectStoreNames.contains(STORES.DRAFTS)) {
					const draftStore = db.createObjectStore(STORES.DRAFTS, {
						keyPath: "sessionId",
					});
					draftStore.createIndex("timestamp", "timestamp", { unique: false });
				}
			};
		});
	}

	/**
	 * Add a message to offline storage
	 */
	async addMessage(message: OfflineMessage): Promise<void> {
		await this.init();
		return this.transactionVoid(STORES.MESSAGES, "readwrite", (store) =>
			store.put(message),
		);
	}

	/**
	 * Get all messages for a session
	 */
	async getMessages(sessionId: string): Promise<OfflineMessage[]> {
		await this.init();
		return this.transaction(STORES.MESSAGES, "readonly", (store) =>
			store.index("sessionId").getAll(sessionId),
		);
	}

	/**
	 * Get pending messages (not yet synced to server)
	 */
	async getPendingMessages(): Promise<OfflineMessage[]> {
		await this.init();
		return this.transaction(STORES.MESSAGES, "readonly", (store) =>
			store.index("pending").getAll(IDBKeyRange.only(true)),
		);
	}

	/**
	 * Mark message as synced
	 */
	async markMessageSynced(messageId: string): Promise<void> {
		await this.init();
		const message = await this.getById<OfflineMessage>(
			STORES.MESSAGES,
			messageId,
		);
		if (message) {
			message.pending = false;
			await this.addMessage(message);
		}
	}

	/**
	 * Delete a message
	 */
	async deleteMessage(messageId: string): Promise<void> {
		await this.init();
		return this.transactionVoid(STORES.MESSAGES, "readwrite", (store) =>
			store.delete(messageId),
		);
	}

	/**
	 * Add or update a session
	 */
	async addSession(session: OfflineSession): Promise<void> {
		await this.init();
		return this.transactionVoid(STORES.SESSIONS, "readwrite", (store) =>
			store.put(session),
		);
	}

	/**
	 * Get all sessions
	 */
	async getSessions(): Promise<OfflineSession[]> {
		await this.init();
		return this.transaction(STORES.SESSIONS, "readonly", (store) =>
			store.getAll(),
		);
	}

	/**
	 * Get a single session by ID
	 */
	async getSession(sessionId: string): Promise<OfflineSession | undefined> {
		await this.init();
		return this.getById<OfflineSession>(STORES.SESSIONS, sessionId);
	}

	/**
	 * Mark session as synced
	 */
	async markSessionSynced(sessionId: string): Promise<void> {
		await this.init();
		const session = await this.getSession(sessionId);
		if (session) {
			session.pending = false;
			await this.addSession(session);
		}
	}

	/**
	 * Delete a session and all its messages
	 */
	async deleteSession(sessionId: string): Promise<void> {
		await this.init();

		// Delete all messages for this session
		const messages = await this.getMessages(sessionId);
		await Promise.all(messages.map((msg) => this.deleteMessage(msg.id)));

		// Delete the session
		return this.transactionVoid(STORES.SESSIONS, "readwrite", (store) =>
			store.delete(sessionId),
		);
	}

	/**
	 * Save or update a draft
	 */
	async saveDraft(draft: OfflineDraft): Promise<void> {
		await this.init();
		return this.transactionVoid(STORES.DRAFTS, "readwrite", (store) =>
			store.put(draft),
		);
	}

	/**
	 * Get a draft for a session
	 */
	async getDraft(sessionId: string): Promise<OfflineDraft | undefined> {
		await this.init();
		return this.getById<OfflineDraft>(STORES.DRAFTS, sessionId);
	}

	/**
	 * Delete a draft
	 */
	async deleteDraft(sessionId: string): Promise<void> {
		await this.init();
		return this.transactionVoid(STORES.DRAFTS, "readwrite", (store) =>
			store.delete(sessionId),
		);
	}

	/**
	 * Clear all data (for logout or reset)
	 */
	async clearAll(): Promise<void> {
		await this.init();
		const stores = Object.values(STORES);
		await Promise.all(
			stores.map((store) =>
				this.transaction(store, "readwrite", (s) => s.clear()),
			),
		);
	}

	/**
	 * Generic transaction helper
	 */
	private async transaction<T>(
		storeName: string,
		mode: IDBTransactionMode,
		callback: (store: IDBObjectStore) => IDBRequest<T>,
	): Promise<T> {
		if (!this.db) {
			throw new Error("Database not initialized");
		}

		const db = this.db; // Capture for closure

		return new Promise((resolve, reject) => {
			const transaction = db.transaction(storeName, mode);
			const store = transaction.objectStore(storeName);
			const request = callback(store);

			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * Transaction helper for void-returning operations
	 */
	private async transactionVoid(
		storeName: string,
		mode: IDBTransactionMode,
		callback: (store: IDBObjectStore) => IDBRequest<any>,
	): Promise<void> {
		if (!this.db) {
			throw new Error("Database not initialized");
		}

		const db = this.db; // Capture for closure

		return new Promise((resolve, reject) => {
			const transaction = db.transaction(storeName, mode);
			const store = transaction.objectStore(storeName);
			const request = callback(store);

			request.onsuccess = () => resolve(undefined);
			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * Generic get by ID helper
	 */
	private async getById<T>(
		storeName: string,
		id: string,
	): Promise<T | undefined> {
		return this.transaction(storeName, "readonly", (store) => store.get(id));
	}

	/**
	 * Close the database connection
	 */
	close(): void {
		if (this.db) {
			this.db.close();
			this.db = null;
		}
	}
}

// Export singleton instance
export const indexedDBHelper = new IndexedDBHelper();
