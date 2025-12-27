/**
 * Chat API comprehensive tests
 *
 * Tests both authenticated and unauthenticated (guest) scenarios
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const API_URL = process.env.API_URL || "https://duyetbot-web.duyet.workers.dev";

// Store session cookie for authenticated tests
let sessionCookie: string | null = null;
let testChatId: string | null = null;

describe("Chat API - Unauthenticated (Guest)", () => {
	it("POST /api/chat with valid UUID creates guest session and returns stream", async () => {
		const chatId = crypto.randomUUID();
		const messageId = crypto.randomUUID();

		const response = await fetch(`${API_URL}/api/chat`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				id: chatId,
				message: {
					id: messageId,
					role: "user",
					parts: [{ type: "text", text: "Hello, this is a test message" }],
				},
				selectedChatModel: "xiaomi/mimo-v2-flash:free",
				selectedVisibilityType: "private",
			}),
		});

		// Should return streaming response
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/event-stream");

		// Extract session cookie for subsequent tests
		const setCookie = response.headers.get("set-cookie");
		if (setCookie) {
			sessionCookie = setCookie.split(";")[0]; // Store just the cookie value
			testChatId = chatId;
		}

		// Read some of the stream to verify it's working
		const reader = response.body?.getReader();
		expect(reader).toBeDefined();

		const decoder = new TextDecoder();
		let chunks = 0;
		const maxChunks = 10;

		if (reader) {
			while (chunks < maxChunks) {
				const { done, value } = await reader.read();
				if (done) break;
				const chunk = decoder.decode(value);
				if (chunk.length > 0) chunks++;
			}
			reader.releaseLock();
		}

		// Should have received some data
		expect(chunks).toBeGreaterThan(0);
	});

	it("POST /api/chat rejects invalid UUID", async () => {
		const response = await fetch(`${API_URL}/api/chat`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				id: "not-a-valid-uuid",
				message: {
					id: crypto.randomUUID(),
					role: "user",
					parts: [{ type: "text", text: "Test" }],
				},
				selectedChatModel: "xiaomi/mimo-v2-flash:free",
				selectedVisibilityType: "private",
			}),
		});

		expect(response.status).toBeGreaterThanOrEqual(400);
	});

	it("POST /api/chat rejects invalid message parts", async () => {
		const response = await fetch(`${API_URL}/api/chat`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				id: crypto.randomUUID(),
				message: {
					id: crypto.randomUUID(),
					role: "user",
					parts: [{ type: "invalid", text: "Test" }],
				},
				selectedChatModel: "xiaomi/mimo-v2-flash:free",
				selectedVisibilityType: "private",
			}),
		});

		expect(response.status).toBeGreaterThanOrEqual(400);
	});
});

describe("Chat API - With Session", () => {
	beforeAll(() => {
		if (!sessionCookie || !testChatId) {
			throw new Error("Guest session test must pass first");
		}
	});

	it("GET /api/chat/:id returns chat with messages", async () => {
		const response = await fetch(`${API_URL}/api/chat/${testChatId}`, {
			headers: {
				Cookie: sessionCookie ?? "",
			},
		});

		expect(response.status).toBe(200);

		const data = (await response.json()) as {
			id: string;
			messages: unknown[];
		};
		expect(data).toHaveProperty("id", testChatId);
		expect(data).toHaveProperty("messages");
		expect(Array.isArray(data.messages)).toBe(true);
	});

	it("POST /api/chat/title generates title", async () => {
		const response = await fetch(`${API_URL}/api/chat/title`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Cookie: sessionCookie!,
			},
			body: JSON.stringify({
				chatId: testChatId,
				message: "What is the capital of France?",
			}),
		});

		expect(response.status).toBe(200);

		const data = (await response.json()) as { title: string };
		expect(data).toHaveProperty("title");
		expect(typeof data.title).toBe("string");
	});
});

describe("Chat API - Error Handling", () => {
	it("GET /api/chat/:id returns 401 for unauthenticated private chat", async () => {
		// Try to access a chat that doesn't belong to us
		const response = await fetch(`${API_URL}/api/chat/${crypto.randomUUID()}`);

		expect(response.status).toBe(401);
	});

	it("DELETE /api/chat returns 401 without auth", async () => {
		const response = await fetch(
			`${API_URL}/api/chat?id=${crypto.randomUUID()}`,
			{
				method: "DELETE",
			},
		);

		expect(response.status).toBe(401);
	});

	it("PATCH /api/chat/visibility returns 401 without auth", async () => {
		const response = await fetch(`${API_URL}/api/chat/visibility`, {
			method: "PATCH",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				chatId: crypto.randomUUID(),
				visibility: "public",
			}),
		});

		expect(response.status).toBe(401);
	});

	it("DELETE /api/chat/messages/trailing returns 401 without auth", async () => {
		const response = await fetch(`${API_URL}/api/chat/messages/trailing`, {
			method: "DELETE",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				messageId: crypto.randomUUID(),
			}),
		});

		expect(response.status).toBe(401);
	});
});

describe("Chat API - Input Validation", () => {
	it("POST /api/chat rejects empty message", async () => {
		const response = await fetch(`${API_URL}/api/chat`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				id: crypto.randomUUID(),
				message: {
					id: crypto.randomUUID(),
					role: "user",
					parts: [{ type: "text", text: "" }],
				},
				selectedChatModel: "xiaomi/mimo-v2-flash:free",
				selectedVisibilityType: "private",
			}),
		});

		expect(response.status).toBeGreaterThanOrEqual(400);
	});

	it("POST /api/chat rejects message exceeding max length", async () => {
		const longText = "a".repeat(3000); // Exceeds 2000 char limit

		const response = await fetch(`${API_URL}/api/chat`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				id: crypto.randomUUID(),
				message: {
					id: crypto.randomUUID(),
					role: "user",
					parts: [{ type: "text", text: longText }],
				},
				selectedChatModel: "xiaomi/mimo-v2-flash:free",
				selectedVisibilityType: "private",
			}),
		});

		expect(response.status).toBeGreaterThanOrEqual(400);
	});

	it("POST /api/chat rejects invalid visibility type", async () => {
		const response = await fetch(`${API_URL}/api/chat`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				id: crypto.randomUUID(),
				message: {
					id: crypto.randomUUID(),
					role: "user",
					parts: [{ type: "text", text: "Test" }],
				},
				selectedChatModel: "xiaomi/mimo-v2-flash:free",
				selectedVisibilityType: "invalid",
			}),
		});

		expect(response.status).toBeGreaterThanOrEqual(400);
	});
});

describe("Chat API - CORS", () => {
	it("OPTIONS /api/chat returns CORS headers", async () => {
		const response = await fetch(`${API_URL}/api/chat`, {
			method: "OPTIONS",
		});

		expect(response.status).toBeGreaterThanOrEqual(200);
		expect(response.status).toBeLessThan(500);

		const corsHeader = response.headers.get("access-control-allow-origin");
		expect(corsHeader).toBeDefined();
	});
});
