/**
 * Unit tests for api-client
 *
 * Test Categories:
 * 1. safeFetch retry behavior (tested indirectly through public APIs)
 * 2. API functions (login, register, logout, chat operations, agents)
 * 3. Error handling and fallbacks
 * 4. Zod schema validation
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as apiClient from "./api-client";

describe("api-client - Retry Behavior", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubGlobal("window", {
			location: { href: "" },
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("retries on 500 Internal Server Error", async () => {
		let attemptCount = 0;

		global.fetch = vi.fn(() => {
			attemptCount++;
			if (attemptCount <= 2) {
				return Promise.resolve({
					ok: false,
					status: 500,
					json: () => Promise.resolve({ error: "Server error" }),
				} as Response);
			}
			return Promise.resolve({
				ok: true,
				status: 200,
				json: () => Promise.resolve({ title: "Success" }),
			} as Response);
		}) as any;

		const result = await apiClient.generateTitleFromUserMessage({
			chatId: "test",
			message: "test",
		});

		// Should have retried and succeeded
		expect(attemptCount).toBe(3);
		expect(result).toBe("Success");
	});

	it("retries on 429 Too Many Requests status", async () => {
		let attemptCount = 0;

		global.fetch = vi.fn(() => {
			attemptCount++;
			if (attemptCount <= 2) {
				return Promise.resolve({
					ok: false,
					status: 429,
					json: () => Promise.resolve({ error: "Rate limited" }),
				} as Response);
			}
			return Promise.resolve({
				ok: true,
				status: 200,
				json: () => Promise.resolve({ title: "Success" }),
			} as Response);
		}) as any;

		const result = await apiClient.generateTitleFromUserMessage({
			chatId: "test",
			message: "test",
		});

		// Should have retried and succeeded
		expect(attemptCount).toBe(3);
		expect(result).toBe("Success");
	});

	it("returns error immediately for non-retryable status (404)", async () => {
		global.fetch = vi.fn(() =>
			Promise.resolve({
				ok: false,
				status: 404,
				json: () => Promise.resolve({ error: "Not found" }),
			} as Response),
		) as any;

		const result = await apiClient.generateTitleFromUserMessage({
			chatId: "test",
			message: "test",
		});

		// 404 is not retryable, should return fallback immediately
		expect(global.fetch).toHaveBeenCalledTimes(1);
		expect(result).toBe("New chat");
	});
});

describe("api-client - Authentication Functions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubGlobal("window", {
			location: { href: "" },
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("login returns success with token on valid credentials", async () => {
		const formData = new FormData();
		formData.set("email", "test@example.com");
		formData.set("password", "password123");

		global.fetch = vi.fn(() =>
			Promise.resolve({
				ok: true,
				status: 200,
				json: () =>
					Promise.resolve({
						success: true,
						user: {
							id: "user-123",
							email: "test@example.com",
							type: "regular",
						},
						token: "jwt-token-abc",
					}),
			} as Response),
		) as any;

		const result = await apiClient.login(formData);

		expect(result.status).toBe("success");
		expect(result.token).toBe("jwt-token-abc");
	});

	it("login returns invalid_data for malformed credentials", async () => {
		const formData = new FormData();
		formData.set("email", "not-an-email");
		formData.set("password", "password123");

		global.fetch = vi.fn(() =>
			Promise.resolve({
				ok: true,
				status: 200,
				json: () => Promise.resolve({}),
			} as Response),
		) as any;

		const result = await apiClient.login(formData);

		expect(result.status).toBe("invalid_data");
		expect(result.error).toBeDefined();
	});

	it("register returns success with token on new user", async () => {
		const formData = new FormData();
		formData.set("email", "new@example.com");
		formData.set("password", "password123");

		global.fetch = vi.fn(() =>
			Promise.resolve({
				ok: true,
				status: 200,
				json: () =>
					Promise.resolve({
						success: true,
						user: { id: "user-456", email: "new@example.com", type: "regular" },
						token: "new-jwt-token",
					}),
			} as Response),
		) as any;

		const result = await apiClient.register(formData);

		expect(result.status).toBe("success");
		expect(result.token).toBe("new-jwt-token");
	});

	it("register returns user_exists status on 409 conflict", async () => {
		const formData = new FormData();
		formData.set("email", "existing@example.com");
		formData.set("password", "password123");

		global.fetch = vi.fn(() =>
			Promise.resolve({
				ok: false,
				status: 409,
				json: () => Promise.resolve({ error: "User already exists" }),
			} as Response),
		) as any;

		const result = await apiClient.register(formData);

		expect(result.status).toBe("user_exists");
		expect(result.error).toBe("User already exists");
	});

	it("logout redirects to home after API call", async () => {
		const mockWindow = { location: { href: "" } };
		vi.stubGlobal("window", mockWindow);

		global.fetch = vi.fn(() =>
			Promise.resolve({
				ok: true,
				status: 200,
				json: () => Promise.resolve({ success: true }),
			} as Response),
		) as any;

		await apiClient.logout();

		expect(global.fetch).toHaveBeenCalledWith("/api/auth/logout", {
			method: "POST",
			signal: expect.any(AbortSignal),
		});
		expect(mockWindow.location.href).toBe("/");

		vi.unstubAllGlobals();
	});
});

describe("api-client - Chat Operations", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubGlobal("window", {
			location: { href: "" },
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("updateChatVisibility calls API with correct payload", async () => {
		global.fetch = vi.fn(() =>
			Promise.resolve({
				ok: true,
				status: 200,
				json: () => Promise.resolve({ success: true }),
			} as Response),
		) as any;

		await expect(
			apiClient.updateChatVisibility({
				chatId: "chat-123",
				visibility: "private",
			}),
		).resolves.not.toThrow();

		expect(global.fetch).toHaveBeenCalledWith(
			"/api/chat/visibility",
			expect.objectContaining({
				method: "PATCH",
				body: JSON.stringify({ chatId: "chat-123", visibility: "private" }),
			}),
		);
	});

	it("updateChatVisibility throws on error", async () => {
		global.fetch = vi.fn(() =>
			Promise.resolve({
				ok: false,
				status: 500,
				json: () => Promise.resolve({ error: "Server error" }),
			} as Response),
		) as any;

		await expect(
			apiClient.updateChatVisibility({
				chatId: "chat-123",
				visibility: "private",
			}),
		).rejects.toThrow("Server error");
	});

	it("deleteTrailingMessages calls API with message ID", async () => {
		global.fetch = vi.fn(() =>
			Promise.resolve({
				ok: true,
				status: 200,
				json: () => Promise.resolve({ success: true }),
			} as Response),
		) as any;

		await expect(
			apiClient.deleteTrailingMessages({ id: "msg-123" }),
		).resolves.not.toThrow();

		expect(global.fetch).toHaveBeenCalledWith(
			"/api/chat/messages/trailing",
			expect.objectContaining({
				method: "DELETE",
				body: JSON.stringify({ messageId: "msg-123" }),
			}),
		);
	});

	it("deleteMessage calls API with message ID in path", async () => {
		global.fetch = vi.fn(() =>
			Promise.resolve({
				ok: true,
				status: 200,
				json: () => Promise.resolve({ success: true }),
			} as Response),
		) as any;

		await expect(
			apiClient.deleteMessage({ id: "msg-456" }),
		).resolves.not.toThrow();

		expect(global.fetch).toHaveBeenCalledWith(
			"/api/chat/messages/msg-456",
			expect.objectContaining({
				method: "DELETE",
			}),
		);
	});

	it("generateTitleFromUserMessage returns title on success", async () => {
		global.fetch = vi.fn(() =>
			Promise.resolve({
				ok: true,
				status: 200,
				json: () => Promise.resolve({ title: "Generated Chat Title" }),
			} as Response),
		) as any;

		const title = await apiClient.generateTitleFromUserMessage({
			chatId: "chat-123",
			message: "Hello world",
		});

		expect(title).toBe("Generated Chat Title");
	});

	it("generateTitleFromUserMessage returns fallback on error", async () => {
		const consoleWarnSpy = vi
			.spyOn(console, "warn")
			.mockImplementation(() => {});

		global.fetch = vi.fn(() =>
			Promise.resolve({
				ok: false,
				status: 500,
				json: () => Promise.resolve({ error: "Generation failed" }),
			} as Response),
		) as any;

		const title = await apiClient.generateTitleFromUserMessage({
			chatId: "chat-123",
			message: "Hello world",
		});

		expect(title).toBe("New chat");
		expect(consoleWarnSpy).toHaveBeenCalledWith(
			"[generateTitle] Failed to generate title:",
			expect.any(String),
		);

		consoleWarnSpy.mockRestore();
	});
});

describe("api-client - Share Operations", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubGlobal("window", {
			location: { href: "" },
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("createArtifactShare returns share URL on success", async () => {
		global.fetch = vi.fn(() =>
			Promise.resolve({
				ok: true,
				status: 200,
				json: () =>
					Promise.resolve({
						shareId: "share-123",
						shareToken: "token-abc",
						shareUrl: "https://example.com/share/share-123",
					}),
			} as Response),
		) as any;

		const result = await apiClient.createArtifactShare({
			documentId: "doc-123",
		});

		expect(result).toEqual({ shareUrl: "https://example.com/share/share-123" });
	});

	it("createArtifactShare returns null on error", async () => {
		const consoleErrorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => {});

		global.fetch = vi.fn(() =>
			Promise.resolve({
				ok: false,
				status: 500,
				json: () => Promise.resolve({ error: "Server error" }),
			} as Response),
		) as any;

		const result = await apiClient.createArtifactShare({
			documentId: "doc-123",
		});

		expect(result).toBeNull();
		expect(consoleErrorSpy).toHaveBeenCalled();

		consoleErrorSpy.mockRestore();
	});

	it("revokeArtifactShare returns true on success", async () => {
		global.fetch = vi.fn(() =>
			Promise.resolve({
				ok: true,
				status: 200,
				json: () => Promise.resolve({ success: true }),
			} as Response),
		) as any;

		const result = await apiClient.revokeArtifactShare({
			documentId: "doc-123",
		});

		expect(result).toBe(true);
	});

	it("getSharedArtifact returns data on success", async () => {
		const mockData = [{ id: "1", content: "Shared content" }];

		global.fetch = vi.fn(() =>
			Promise.resolve({
				ok: true,
				status: 200,
				json: () => Promise.resolve(mockData),
			} as Response),
		) as any;

		const result = await apiClient.getSharedArtifact({
			shareId: "share-123",
		});

		expect(result).toEqual(mockData);
	});

	it("getSuggestions returns empty array on error", async () => {
		global.fetch = vi.fn(() =>
			Promise.resolve({
				ok: false,
				status: 500,
				json: () => Promise.resolve({ error: "Server error" }),
			} as Response),
		) as any;

		const result = await apiClient.getSuggestions({ documentId: "doc-123" });

		expect(result).toEqual([]);
	});
});

describe("api-client - Agent Operations", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubGlobal("window", {
			location: { href: "" },
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("getAgents returns array of agents on success", async () => {
		const mockAgents = [
			{
				id: "agent-1",
				name: "Test Agent",
				description: "A test agent",
				avatar: null,
				systemPrompt: "You are helpful",
				guidelines: "Be nice",
				outputFormat: "text",
				modelId: "gpt-4",
				temperature: "0.7",
				maxTokens: "2000",
				topP: "1.0",
				frequencyPenalty: "0",
				presencePenalty: "0",
				enabledTools: ["search"],
				needsApproval: false,
				isEnabled: true,
				category: "general",
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		];

		global.fetch = vi.fn(() =>
			Promise.resolve({
				ok: true,
				status: 200,
				json: () => Promise.resolve({ agents: mockAgents }),
			} as Response),
		) as any;

		const result = await apiClient.getAgents();

		expect(result).toEqual(mockAgents);
	});

	it("getAgents returns null on error", async () => {
		const consoleErrorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => {});

		global.fetch = vi.fn(() =>
			Promise.resolve({
				ok: false,
				status: 500,
				json: () => Promise.resolve({ error: "Server error" }),
			} as Response),
		) as any;

		const result = await apiClient.getAgents();

		expect(result).toBeNull();
		expect(consoleErrorSpy).toHaveBeenCalled();

		consoleErrorSpy.mockRestore();
	});

	it("createAgent returns created agent on success", async () => {
		const newAgent = {
			id: "agent-2",
			name: "New Agent",
			description: "A new agent",
			avatar: null,
			systemPrompt: "You are helpful",
			guidelines: "Be nice",
			outputFormat: "text",
			modelId: "gpt-4",
			temperature: "0.7",
			maxTokens: "2000",
			topP: "1.0",
			frequencyPenalty: "0",
			presencePenalty: "0",
			enabledTools: ["search"],
			needsApproval: false,
			isEnabled: true,
			category: "general",
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		global.fetch = vi.fn(() =>
			Promise.resolve({
				ok: true,
				status: 200,
				json: () => Promise.resolve({ agent: newAgent }),
			} as Response),
		) as any;

		const result = await apiClient.createAgent({
			name: "New Agent",
			description: "A new agent",
			avatar: null,
			systemPrompt: "You are helpful",
			guidelines: "Be nice",
			outputFormat: "text",
			modelId: "gpt-4",
			temperature: "0.7",
			maxTokens: "2000",
			topP: "1.0",
			frequencyPenalty: "0",
			presencePenalty: "0",
			enabledTools: ["search"],
			needsApproval: false,
			isEnabled: true,
			category: "general",
		});

		expect(result).toEqual(newAgent);
	});

	it("deleteAgent returns true on success", async () => {
		global.fetch = vi.fn(() =>
			Promise.resolve({
				ok: true,
				status: 200,
				json: () => Promise.resolve({ success: true }),
			} as Response),
		) as any;

		const result = await apiClient.deleteAgent("agent-1");

		expect(result).toBe(true);
	});

	it("toggleAgent returns updated agent on success", async () => {
		const originalAgent = {
			id: "agent-1",
			name: "Test Agent",
			description: "A test agent",
			avatar: null,
			systemPrompt: "You are helpful",
			guidelines: "Be nice",
			outputFormat: "text",
			modelId: "gpt-4",
			temperature: "0.7",
			maxTokens: "2000",
			topP: "1.0",
			frequencyPenalty: "0",
			presencePenalty: "0",
			enabledTools: ["search"],
			needsApproval: false,
			isEnabled: false,
			category: "general",
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		global.fetch = vi.fn(() =>
			Promise.resolve({
				ok: true,
				status: 200,
				json: () => Promise.resolve({ agent: originalAgent }),
			} as Response),
		) as any;

		const result = await apiClient.toggleAgent("agent-1");

		expect(result).toBeDefined();
		expect(result?.isEnabled).toBe(false);
	});
});
