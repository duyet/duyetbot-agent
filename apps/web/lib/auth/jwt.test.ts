/**
 * Unit tests for lib/auth/jwt.ts
 * JWT session management with HMAC-SHA256 signing
 */
import { beforeAll, describe, expect, it, vi } from "vitest";

// Set environment variable BEFORE importing the module
// because jwt.ts throws on import if SESSION_SECRET is not set
beforeAll(() => {
	process.env.SESSION_SECRET = "test-secret-key-for-unit-tests-only";
});

// Dynamic import to ensure env is set before module loads
const importJwt = async () => {
	return await import("./jwt");
};

describe("JWT Session Management", () => {
	describe("createSessionToken", () => {
		it("creates a valid JWT token with 3 parts", async () => {
			const { createSessionToken } = await importJwt();
			const token = await createSessionToken(
				"user-123",
				"test@example.com",
				"regular",
			);

			const parts = token.split(".");
			expect(parts).toHaveLength(3);
		});

		it("encodes user information in the token", async () => {
			const { createSessionToken, verifySessionToken } = await importJwt();
			const token = await createSessionToken(
				"user-123",
				"test@example.com",
				"regular",
			);

			const payload = await verifySessionToken(token);
			expect(payload).not.toBeNull();
			expect(payload?.id).toBe("user-123");
			expect(payload?.email).toBe("test@example.com");
			expect(payload?.type).toBe("regular");
		});

		it("creates guest session without email", async () => {
			const { createSessionToken, verifySessionToken } = await importJwt();
			const token = await createSessionToken("guest-123", undefined, "guest");

			const payload = await verifySessionToken(token);
			expect(payload).not.toBeNull();
			expect(payload?.id).toBe("guest-123");
			expect(payload?.email).toBeUndefined();
			expect(payload?.type).toBe("guest");
		});

		it("sets correct expiration time", async () => {
			const { createSessionToken, verifySessionToken } = await importJwt();
			const expiresIn = 60 * 1000; // 1 minute
			const beforeCreate = Math.floor(Date.now() / 1000);

			const token = await createSessionToken(
				"user-123",
				"test@example.com",
				"regular",
				expiresIn,
			);

			const payload = await verifySessionToken(token);
			const afterCreate = Math.floor(Date.now() / 1000);

			expect(payload).not.toBeNull();
			// exp should be within 1 minute of creation
			expect(payload?.exp).toBeGreaterThanOrEqual(beforeCreate + 59);
			expect(payload?.exp).toBeLessThanOrEqual(afterCreate + 61);
		});

		it("includes iat (issued at) claim", async () => {
			const { createSessionToken, verifySessionToken } = await importJwt();
			const beforeCreate = Math.floor(Date.now() / 1000);

			const token = await createSessionToken(
				"user-123",
				"test@example.com",
				"regular",
			);

			const payload = await verifySessionToken(token);
			const afterCreate = Math.floor(Date.now() / 1000);

			expect(payload?.iat).toBeGreaterThanOrEqual(beforeCreate);
			expect(payload?.iat).toBeLessThanOrEqual(afterCreate);
		});

		it("default expiration is 30 days", async () => {
			const { createSessionToken, verifySessionToken } = await importJwt();
			const beforeCreate = Math.floor(Date.now() / 1000);
			const thirtyDaysInSeconds = 30 * 24 * 60 * 60;

			const token = await createSessionToken(
				"user-123",
				"test@example.com",
				"regular",
			);

			const payload = await verifySessionToken(token);

			// Should expire approximately 30 days from now
			expect(payload?.exp).toBeGreaterThan(
				beforeCreate + thirtyDaysInSeconds - 10,
			);
			expect(payload?.exp).toBeLessThan(
				beforeCreate + thirtyDaysInSeconds + 10,
			);
		});
	});

	describe("verifySessionToken", () => {
		it("returns payload for valid token", async () => {
			const { createSessionToken, verifySessionToken } = await importJwt();
			const token = await createSessionToken(
				"user-123",
				"test@example.com",
				"regular",
			);

			const payload = await verifySessionToken(token);

			expect(payload).not.toBeNull();
			expect(payload?.id).toBe("user-123");
		});

		it("returns null for expired token", async () => {
			const { createSessionToken, verifySessionToken } = await importJwt();

			// Mock Date.now to create a token that's already expired
			const _realDateNow = Date.now;
			const pastTime = Date.now() - 2000; // 2 seconds ago
			vi.spyOn(Date, "now").mockReturnValue(pastTime);

			// Create token that expires in 1 second (but since we're mocking time 2 seconds ago, it's already expired)
			const token = await createSessionToken(
				"user-123",
				"test@example.com",
				"regular",
				1000,
			);

			// Restore real Date.now
			vi.restoreAllMocks();

			// Now verification should fail because token was created "in the past"
			const payload = await verifySessionToken(token);
			expect(payload).toBeNull();
		});

		it("returns null for token with invalid signature", async () => {
			const { createSessionToken, verifySessionToken } = await importJwt();
			const token = await createSessionToken(
				"user-123",
				"test@example.com",
				"regular",
			);

			// Tamper with the signature
			const parts = token.split(".");
			const tamperedToken = `${parts[0]}.${parts[1]}.tampered_signature`;

			const payload = await verifySessionToken(tamperedToken);
			expect(payload).toBeNull();
		});

		it("returns null for token with tampered payload", async () => {
			const { createSessionToken, verifySessionToken } = await importJwt();
			const token = await createSessionToken(
				"user-123",
				"test@example.com",
				"regular",
			);

			// Tamper with the payload
			const parts = token.split(".");
			const tamperedPayload = btoa(
				JSON.stringify({ id: "hacker", type: "admin" }),
			)
				.replace(/\+/g, "-")
				.replace(/\//g, "_")
				.replace(/=/g, "");
			const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

			const payload = await verifySessionToken(tamperedToken);
			expect(payload).toBeNull();
		});

		it("returns null for malformed token (missing parts)", async () => {
			const { verifySessionToken } = await importJwt();

			expect(await verifySessionToken("only.two")).toBeNull();
			expect(await verifySessionToken("only_one_part")).toBeNull();
			expect(await verifySessionToken("")).toBeNull();
		});

		it("returns null for token with invalid base64", async () => {
			const { verifySessionToken } = await importJwt();

			expect(await verifySessionToken("!!!.@@@.###")).toBeNull();
		});
	});

	describe("createSessionFromPayload", () => {
		it("creates session object with correct structure", async () => {
			const { createSessionFromPayload } = await importJwt();

			const now = Math.floor(Date.now() / 1000);
			const exp = now + 3600; // 1 hour from now

			const session = createSessionFromPayload({
				id: "user-123",
				email: "test@example.com",
				type: "regular",
				exp,
				iat: now,
			});

			expect(session.user.id).toBe("user-123");
			expect(session.user.email).toBe("test@example.com");
			expect(session.user.type).toBe("regular");
			expect(session.expires).toBe(new Date(exp * 1000).toISOString());
		});

		it("handles guest user without email", async () => {
			const { createSessionFromPayload } = await importJwt();

			const session = createSessionFromPayload({
				id: "guest-123",
				email: undefined,
				type: "guest",
				exp: Math.floor(Date.now() / 1000) + 3600,
				iat: Math.floor(Date.now() / 1000),
			});

			expect(session.user.id).toBe("guest-123");
			expect(session.user.email).toBeUndefined();
			expect(session.user.type).toBe("guest");
		});
	});

	describe("SESSION_MAX_AGE", () => {
		it("equals 30 days in seconds", async () => {
			const { SESSION_MAX_AGE } = await importJwt();

			const thirtyDaysInSeconds = 30 * 24 * 60 * 60;
			expect(SESSION_MAX_AGE).toBe(thirtyDaysInSeconds);
		});
	});
});

describe("JWT token format", () => {
	it("uses HS256 algorithm in header", async () => {
		const { createSessionToken } = await importJwt();
		const token = await createSessionToken(
			"user-123",
			"test@example.com",
			"regular",
		);

		const [headerPart] = token.split(".");
		// Add padding for proper base64 decoding
		const paddedHeader = headerPart.replace(/-/g, "+").replace(/_/g, "/");
		const header = JSON.parse(atob(paddedHeader));

		expect(header.alg).toBe("HS256");
		expect(header.typ).toBe("JWT");
	});

	it("uses base64url encoding (no +, /, or =)", async () => {
		const { createSessionToken } = await importJwt();

		// Create multiple tokens to increase chance of hitting special chars
		for (let i = 0; i < 10; i++) {
			const token = await createSessionToken(
				`user-${i}`,
				`test${i}@example.com`,
				"regular",
			);

			expect(token).not.toContain("+");
			expect(token).not.toContain("/");
			expect(token).not.toContain("=");
		}
	});
});
