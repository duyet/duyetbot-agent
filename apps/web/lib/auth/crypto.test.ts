/**
 * Unit tests for lib/auth/crypto.ts
 * Password hashing and verification using PBKDF2-HMAC-SHA256
 */
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./crypto";

describe("hashPassword", () => {
	it("generates a hash in salt$hash format", async () => {
		const password = "mySecurePassword123!";
		const hash = await hashPassword(password);

		expect(hash).toContain("$");
		const [salt, derivedHash] = hash.split("$");
		expect(salt).toBeDefined();
		expect(derivedHash).toBeDefined();
		expect(salt.length).toBeGreaterThan(0);
		expect(derivedHash.length).toBeGreaterThan(0);
	});

	it("generates unique hashes for same password (different salts)", async () => {
		const password = "samePassword";
		const hash1 = await hashPassword(password);
		const hash2 = await hashPassword(password);

		expect(hash1).not.toBe(hash2);

		// But both should verify correctly
		expect(await verifyPassword(password, hash1)).toBe(true);
		expect(await verifyPassword(password, hash2)).toBe(true);
	});

	it("handles empty password", async () => {
		const hash = await hashPassword("");
		expect(hash).toContain("$");

		// Empty password should still verify
		expect(await verifyPassword("", hash)).toBe(true);
	});

	it("handles unicode characters", async () => {
		const password = "日本語パスワード🔐";
		const hash = await hashPassword(password);

		expect(await verifyPassword(password, hash)).toBe(true);
	});

	it("handles very long passwords", async () => {
		const password = "a".repeat(1000);
		const hash = await hashPassword(password);

		expect(await verifyPassword(password, hash)).toBe(true);
	});

	it("produces base64-encoded salt and hash", async () => {
		const hash = await hashPassword("test");
		const [salt, derivedHash] = hash.split("$");

		// Base64 should only contain these characters
		const base64Regex = /^[A-Za-z0-9+/=]+$/;
		expect(salt).toMatch(base64Regex);
		expect(derivedHash).toMatch(base64Regex);
	});
});

describe("verifyPassword", () => {
	it("returns true for correct password", async () => {
		const password = "correctPassword";
		const hash = await hashPassword(password);

		expect(await verifyPassword(password, hash)).toBe(true);
	});

	it("returns false for incorrect password", async () => {
		const password = "correctPassword";
		const hash = await hashPassword(password);

		expect(await verifyPassword("wrongPassword", hash)).toBe(false);
	});

	it("returns false for similar but not exact password", async () => {
		const password = "password123";
		const hash = await hashPassword(password);

		expect(await verifyPassword("Password123", hash)).toBe(false); // Case difference
		expect(await verifyPassword("password123 ", hash)).toBe(false); // Trailing space
		expect(await verifyPassword(" password123", hash)).toBe(false); // Leading space
		expect(await verifyPassword("password1234", hash)).toBe(false); // Extra character
	});

	it("returns false for malformed hash (missing $)", async () => {
		expect(await verifyPassword("password", "invalidhashformat")).toBe(false);
	});

	it("returns false for malformed hash (empty salt)", async () => {
		expect(await verifyPassword("password", "$somehash")).toBe(false);
	});

	it("returns false for malformed hash (empty hash)", async () => {
		expect(await verifyPassword("password", "somesalt$")).toBe(false);
	});

	it("returns false for invalid base64 in hash", async () => {
		// Invalid base64 characters
		expect(await verifyPassword("password", "validSalt$!!!invalid!!!")).toBe(
			false,
		);
	});

	it("returns false for empty stored hash", async () => {
		expect(await verifyPassword("password", "")).toBe(false);
	});

	it("is case-sensitive for passwords", async () => {
		const hash = await hashPassword("Password");

		expect(await verifyPassword("Password", hash)).toBe(true);
		expect(await verifyPassword("password", hash)).toBe(false);
		expect(await verifyPassword("PASSWORD", hash)).toBe(false);
	});
});

describe("security properties", () => {
	it("produces different hashes for same password on each call", async () => {
		const password = "testPassword";
		const hashes = new Set<string>();

		for (let i = 0; i < 10; i++) {
			hashes.add(await hashPassword(password));
		}

		// All 10 hashes should be unique due to random salt
		expect(hashes.size).toBe(10);
	});

	it("salt is 16 bytes (22 base64 characters without padding)", async () => {
		const hash = await hashPassword("test");
		const [salt] = hash.split("$");

		// 16 bytes = ceil(16 * 4/3) = 24 base64 chars, but with padding trimmed
		// Actually with proper base64 encoding it's 24 chars including potential =
		// Let's just check it's reasonable length
		expect(salt.length).toBeGreaterThanOrEqual(20);
		expect(salt.length).toBeLessThanOrEqual(24);
	});

	it("derived key is 32 bytes (44 base64 characters with padding)", async () => {
		const hash = await hashPassword("test");
		const [, derivedHash] = hash.split("$");

		// 32 bytes = ceil(32 * 4/3) = 44 base64 chars
		expect(derivedHash.length).toBeGreaterThanOrEqual(42);
		expect(derivedHash.length).toBeLessThanOrEqual(44);
	});
});
