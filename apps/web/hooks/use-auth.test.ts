/**
 * Unit tests for use-auth hook
 *
 * Test Categories:
 * 1. Hook initialization and state
 * 2. Session fetching from server
 * 3. Bearer token authentication
 * 4. Sign out functionality
 * 5. Cross-tab synchronization
 * 6. Error handling
 * 7. Abort/cleanup behavior
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser, Session } from "./use-auth";
import { useAuth } from "./use-auth";

// Mock Next.js router
vi.mock("next/navigation", () => ({
	useRouter: () => ({
		push: vi.fn(),
		refresh: vi.fn(),
	}),
}));

// Mock token storage
vi.mock("@/lib/auth/token-storage", () => ({
	getStoredToken: vi.fn(() => null),
	initTokenSync: vi.fn(),
	removeStoredToken: vi.fn(),
}));

// Import mocked functions
import {
	getStoredToken,
	initTokenSync,
	removeStoredToken,
} from "@/lib/auth/token-storage";

describe("useAuth - Initialization and State", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		global.fetch = vi.fn(() =>
			Promise.resolve({
				ok: false,
				json: () => Promise.resolve({}),
			} as Response),
		) as any;
	});

	it("initializes with loading status", () => {
		const { result } = renderHook(() => useAuth());

		expect(result.current.status).toBe("loading");
		expect(result.current.data).toBeNull();
	});

	it("returns all expected API methods", () => {
		const { result } = renderHook(() => useAuth());

		expect(result.current.data).toBeDefined();
		expect(result.current.status).toBeDefined();
		expect(result.current.signOut).toBeDefined();
		expect(result.current.refresh).toBeDefined();
	});

	it("transitions to unauthenticated when session fetch fails", async () => {
		global.fetch = vi.fn(() =>
			Promise.resolve({
				ok: false,
				status: 401,
				json: () => Promise.resolve({ error: "Unauthorized" }),
			} as Response),
		) as any;

		const { result } = renderHook(() => useAuth());

		await waitFor(() => {
			expect(result.current.status).toBe("unauthenticated");
		});

		expect(result.current.data).toBeNull();
	});
});

describe("useAuth - Session Fetching", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("fetches session on mount", async () => {
		const mockSession: Session = {
			user: {
				id: "user-123",
				email: "test@example.com",
				type: "regular",
			},
			expires: new Date(Date.now() + 3600000).toISOString(),
		};

		global.fetch = vi.fn(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve(mockSession),
			} as Response),
		) as any;

		const { result } = renderHook(() => useAuth());

		await waitFor(() => {
			expect(result.current.status).toBe("authenticated");
		});

		expect(result.current.data).toEqual(mockSession);
		expect(global.fetch).toHaveBeenCalledWith(
			"/api/auth/session",
			expect.anything(),
		);
	});

	it("handles guest sessions", async () => {
		const mockSession: Session = {
			user: {
				id: "guest-123",
				type: "guest",
			},
			expires: new Date(Date.now() + 3600000).toISOString(),
		};

		global.fetch = vi.fn(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve(mockSession),
			} as Response),
		) as any;

		const { result } = renderHook(() => useAuth());

		await waitFor(() => {
			expect(result.current.status).toBe("authenticated");
		});

		expect(result.current.data?.user.type).toBe("guest");
	});

	it("validates session format", async () => {
		const consoleWarnSpy = vi
			.spyOn(console, "warn")
			.mockImplementation(() => {});

		// Invalid session format
		global.fetch = vi.fn(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve({ invalid: "data" }),
			} as Response),
		) as any;

		const { result } = renderHook(() => useAuth());

		await waitFor(() => {
			expect(result.current.status).toBe("unauthenticated");
		});

		expect(consoleWarnSpy).toHaveBeenCalledWith(
			"[useAuth] Invalid session format",
		);

		consoleWarnSpy.mockRestore();
	});

	it("handles missing session.user", async () => {
		global.fetch = vi.fn(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve({ expires: new Date().toISOString() }),
			} as Response),
		) as any;

		const { result } = renderHook(() => useAuth());

		await waitFor(() => {
			expect(result.current.status).toBe("unauthenticated");
		});
	});

	it("handles non-object session", async () => {
		global.fetch = vi.fn(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve(null),
			} as Response),
		) as any;

		const { result } = renderHook(() => useAuth());

		await waitFor(() => {
			expect(result.current.status).toBe("unauthenticated");
		});
	});
});

describe("useAuth - Bearer Token Authentication", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("includes Authorization header when token exists", async () => {
		const getStoredTokenMock = vi.mocked(getStoredToken);
		getStoredTokenMock.mockReturnValue("mock-token-123");

		const mockSession: Session = {
			user: { id: "user-123", type: "regular" },
			expires: new Date(Date.now() + 3600000).toISOString(),
		};

		global.fetch = vi.fn(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve(mockSession),
			} as Response),
		) as any;

		renderHook(() => useAuth());

		await waitFor(() => {
			expect(global.fetch).toHaveBeenCalled();
		});

		expect(getStoredToken).toHaveBeenCalled();
		const fetchCall = (global.fetch as any).mock.calls[0];
		expect(fetchCall[1]?.headers?.Authorization).toBe("Bearer mock-token-123");
	});

	it("does not include Authorization header when no token", async () => {
		const getStoredTokenMock = vi.mocked(getStoredToken);
		getStoredTokenMock.mockReturnValue(null);

		const mockSession: Session = {
			user: { id: "user-123", type: "regular" },
			expires: new Date(Date.now() + 3600000).toISOString(),
		};

		global.fetch = vi.fn(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve(mockSession),
			} as Response),
		) as any;

		renderHook(() => useAuth());

		await waitFor(() => {
			expect(global.fetch).toHaveBeenCalled();
		});

		const fetchCall = (global.fetch as any).mock.calls[0];
		expect(fetchCall[1]?.headers?.Authorization).toBeUndefined();
	});
});

describe("useAuth - Sign Out", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubGlobal("localStorage", {
			removeItem: vi.fn(),
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("signs out successfully", async () => {
		const mockSession: Session = {
			user: { id: "user-123", type: "regular" },
			expires: new Date(Date.now() + 3600000).toISOString(),
		};

		global.fetch = vi.fn(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve(mockSession),
			} as Response),
		) as any;

		const routerPush = vi.fn();
		vi.doMock("next/navigation", () => ({
			useRouter: () => ({ push: routerPush, refresh: vi.fn() }),
		}));

		const removeStoredTokenMock = vi.mocked(removeStoredToken);

		const { result } = renderHook(() => useAuth());

		// Wait for initial session fetch
		await waitFor(() => {
			expect(result.current.status).toBe("authenticated");
		});

		// Mock logout API
		global.fetch = vi.fn(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve({ success: true }),
			} as Response),
		) as any;

		// Sign out
		await act(async () => {
			await result.current.signOut();
		});

		expect(removeStoredTokenMock).toHaveBeenCalled();
		expect(result.current.status).toBe("unauthenticated");
		expect(routerPush).toHaveBeenCalledWith("/");
	});

	it("handles sign out API errors gracefully", async () => {
		const consoleErrorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => {});
		const routerPush = vi.fn();
		vi.doMock("next/navigation", () => ({
			useRouter: () => ({ push: routerPush, refresh: vi.fn() }),
		}));

		const removeStoredTokenMock = vi.mocked(removeStoredToken);

		global.fetch = vi.fn(() =>
			Promise.reject(new Error("Network error")),
		) as any;

		const { result } = renderHook(() => useAuth());

		await act(async () => {
			await result.current.signOut();
		});

		expect(removeStoredTokenMock).toHaveBeenCalled();
		expect(result.current.status).toBe("unauthenticated");
		expect(routerPush).toHaveBeenCalledWith("/");

		consoleErrorSpy.mockRestore();
	});
});

describe("useAuth - Cross-Tab Synchronization", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("initializes token sync on mount", () => {
		const initTokenSyncMock = vi.mocked(initTokenSync);

		global.fetch = vi.fn(() =>
			Promise.resolve({
				ok: false,
				json: () => Promise.resolve({}),
			} as Response),
		) as any;

		renderHook(() => useAuth());

		expect(initTokenSyncMock).toHaveBeenCalled();
	});

	it("refreshes session on storage event", async () => {
		const mockSession: Session = {
			user: { id: "user-123", type: "regular" },
			expires: new Date(Date.now() + 3600000).toISOString(),
		};

		global.fetch = vi.fn(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve(mockSession),
			} as Response),
		) as any;

		const { result } = renderHook(() => useAuth());

		await waitFor(() => {
			expect(result.current.status).toBe("authenticated");
		});

		const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve(mockSession),
		} as Response);

		// Trigger storage event
		act(() => {
			window.dispatchEvent(
				new StorageEvent("storage", {
					key: "auth_token",
					newValue: "new-token",
				}),
			);
		});

		await waitFor(() => {
			expect(fetchSpy).toHaveBeenCalled();
		});

		fetchSpy.mockRestore();
	});

	it("listens for session storage changes", async () => {
		global.fetch = vi.fn(() =>
			Promise.resolve({
				ok: false,
				json: () => Promise.resolve({}),
			} as Response),
		) as any;

		const addEventListenerSpy = vi.spyOn(window, "addEventListener");

		renderHook(() => useAuth());

		expect(addEventListenerSpy).toHaveBeenCalledWith(
			"storage",
			expect.any(Function),
		);

		addEventListenerSpy.mockRestore();
	});
});

describe("useAuth - Refresh Functionality", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("manually refreshes session", async () => {
		const mockSession: Session = {
			user: { id: "user-123", type: "regular" },
			expires: new Date(Date.now() + 3600000).toISOString(),
		};

		global.fetch = vi.fn(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve(mockSession),
			} as Response),
		) as any;

		const { result } = renderHook(() => useAuth());

		// Wait for initial fetch
		await waitFor(() => {
			expect(global.fetch).toHaveBeenCalledTimes(1);
		});

		const initialFetchCount = (global.fetch as any).mock.calls.length;

		// Manually refresh
		await act(async () => {
			await result.current.refresh();
		});

		// Should have called fetch again
		expect((global.fetch as any).mock.calls.length).toBe(initialFetchCount + 1);
	});
});

describe("useAuth - Abort and Cleanup", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	it("aborts fetch on unmount", () => {
		const abortSpy = vi.spyOn(AbortController.prototype, "abort");

		global.fetch = vi.fn(
			() => new Promise(() => {}), // Never resolves
		) as any;

		const { unmount } = renderHook(() => useAuth());

		unmount();

		expect(abortSpy).toHaveBeenCalled();

		abortSpy.mockRestore();
	});

	it("handles abort error gracefully", async () => {
		const controller = new AbortController();

		global.fetch = vi.fn(() => {
			controller.abort();
			return Promise.resolve({
				ok: false,
				json: () => Promise.resolve({}),
			} as Response);
		}) as any;

		const { result } = renderHook(() => useAuth());

		await waitFor(() => {
			// Should handle abort without throwing
			expect(result.current.status).toBe("unauthenticated");
		});
	});
});

describe("useAuth - Error Handling", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("handles network errors", async () => {
		const consoleErrorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => {});

		global.fetch = vi.fn(() =>
			Promise.reject(new Error("Network error")),
		) as any;

		const { result } = renderHook(() => useAuth());

		await waitFor(() => {
			expect(result.current.status).toBe("unauthenticated");
		});

		expect(consoleErrorSpy).toHaveBeenCalledWith(
			"[useAuth] Failed to fetch session:",
			expect.any(Error),
		);

		consoleErrorSpy.mockRestore();
	});

	it("handles malformed JSON response", async () => {
		const consoleErrorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => {});

		global.fetch = vi.fn(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.reject(new Error("Invalid JSON")),
			} as unknown as Response),
		) as any;

		const { result } = renderHook(() => useAuth());

		await waitFor(() => {
			expect(result.current.status).toBe("unauthenticated");
		});

		consoleErrorSpy.mockRestore();
	});
});
