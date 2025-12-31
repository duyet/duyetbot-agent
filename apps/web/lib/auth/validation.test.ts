import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
	AUTH_ERROR_MESSAGES,
	authFormSchema,
	emailSchema,
	formatZodError,
	getGenericAuthError,
	getPasswordStrength,
	isZodError,
	PASSWORD_MAX_LENGTH,
	PASSWORD_MIN_LENGTH,
	passwordSchema,
} from "./validation";

describe("validation", () => {
	describe("passwordSchema", () => {
		it("should accept valid password", () => {
			const result = passwordSchema.safeParse("Password123");
			expect(result.success).toBe(true);
		});

		it("should reject password shorter than minimum", () => {
			const result = passwordSchema.safeParse("Pass1");
			expect(result.success).toBe(false);
		});

		it("should accept password at minimum length", () => {
			const result = passwordSchema.safeParse("Passw0rd");
			expect(result.success).toBe(true);
			expect("Passw0rd".length).toBe(PASSWORD_MIN_LENGTH);
		});

		it("should reject password longer than maximum", () => {
			const longPassword = `${"A".repeat(PASSWORD_MAX_LENGTH)}1a`;
			const result = passwordSchema.safeParse(longPassword);
			expect(result.success).toBe(false);
		});

		it("should reject password without letters", () => {
			const result = passwordSchema.safeParse("12345678");
			expect(result.success).toBe(false);
		});

		it("should reject password without numbers", () => {
			const result = passwordSchema.safeParse("Password");
			expect(result.success).toBe(false);
		});

		it("should accept password with special characters", () => {
			const result = passwordSchema.safeParse("Pass@word1");
			expect(result.success).toBe(true);
		});
	});

	describe("emailSchema", () => {
		it("should accept valid email", () => {
			const result = emailSchema.safeParse("test@example.com");
			expect(result.success).toBe(true);
		});

		it("should reject empty email", () => {
			const result = emailSchema.safeParse("");
			expect(result.success).toBe(false);
		});

		it("should reject invalid email format", () => {
			const result = emailSchema.safeParse("notanemail");
			expect(result.success).toBe(false);
		});

		it("should reject email without domain", () => {
			const result = emailSchema.safeParse("test@");
			expect(result.success).toBe(false);
		});
	});

	describe("authFormSchema", () => {
		it("should accept valid form data", () => {
			const result = authFormSchema.safeParse({
				email: "user@example.com",
				password: "SecurePass1",
			});
			expect(result.success).toBe(true);
		});

		it("should reject invalid email with valid password", () => {
			const result = authFormSchema.safeParse({
				email: "invalid",
				password: "SecurePass1",
			});
			expect(result.success).toBe(false);
		});

		it("should reject valid email with invalid password", () => {
			const result = authFormSchema.safeParse({
				email: "user@example.com",
				password: "weak",
			});
			expect(result.success).toBe(false);
		});
	});

	describe("getPasswordStrength", () => {
		it("should return score 0 for empty password", () => {
			const result = getPasswordStrength("");
			expect(result.score).toBe(0);
			expect(result.feedback.length).toBeGreaterThan(0);
		});

		it("should return low score for short password", () => {
			const result = getPasswordStrength("abc");
			expect(result.score).toBeLessThan(3);
		});

		it("should increase score for length >= 8", () => {
			const short = getPasswordStrength("Abc1234");
			const long = getPasswordStrength("Abcd1234");
			expect(long.score).toBeGreaterThanOrEqual(short.score);
		});

		it("should increase score for length >= 12", () => {
			const result = getPasswordStrength("LongPassword1");
			expect(result.score).toBeGreaterThan(2);
		});

		it("should increase score for mixed case", () => {
			const lower = getPasswordStrength("password123");
			const mixed = getPasswordStrength("Password123");
			expect(mixed.score).toBeGreaterThan(lower.score);
		});

		it("should increase score for special characters", () => {
			const noSpecial = getPasswordStrength("Password123");
			const withSpecial = getPasswordStrength("Password123!");
			expect(withSpecial.score).toBeGreaterThan(noSpecial.score);
		});

		it("should provide feedback for weak password", () => {
			const result = getPasswordStrength("weak");
			expect(result.feedback).toContain("Use at least 8 characters");
		});

		it("should provide feedback for no numbers", () => {
			const result = getPasswordStrength("Password");
			expect(result.feedback).toContain("Include at least one number");
		});
	});

	describe("AUTH_ERROR_MESSAGES", () => {
		it("should have all required error messages", () => {
			expect(AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS).toBeDefined();
			expect(AUTH_ERROR_MESSAGES.USER_EXISTS).toBeDefined();
			expect(AUTH_ERROR_MESSAGES.WEAK_PASSWORD).toBeDefined();
			expect(AUTH_ERROR_MESSAGES.INVALID_EMAIL).toBeDefined();
			expect(AUTH_ERROR_MESSAGES.SESSION_EXPIRED).toBeDefined();
			expect(AUTH_ERROR_MESSAGES.UNAUTHORIZED).toBeDefined();
		});
	});

	describe("getGenericAuthError", () => {
		it("should return generic credentials error", () => {
			const error = getGenericAuthError();
			expect(error).toBe(AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS);
		});
	});

	describe("isZodError", () => {
		it("should return true for ZodError", () => {
			try {
				z.string().parse(123);
			} catch (error) {
				expect(isZodError(error)).toBe(true);
			}
		});

		it("should return false for regular Error", () => {
			expect(isZodError(new Error("test"))).toBe(false);
		});

		it("should return false for non-error values", () => {
			expect(isZodError(null)).toBe(false);
			expect(isZodError(undefined)).toBe(false);
			expect(isZodError("string")).toBe(false);
		});
	});

	describe("formatZodError", () => {
		it("should format single error", () => {
			const schema = z.object({ email: z.string().email() });
			const result = schema.safeParse({ email: "invalid" });
			if (!result.success) {
				const formatted = formatZodError(result.error);
				expect(formatted).toContain("email");
			}
		});

		it("should format multiple errors", () => {
			const schema = z.object({
				email: z.string().email(),
				name: z.string().min(1),
			});
			const result = schema.safeParse({ email: "invalid", name: "" });
			if (!result.success) {
				const formatted = formatZodError(result.error);
				expect(formatted).toContain(",");
			}
		});
	});
});
