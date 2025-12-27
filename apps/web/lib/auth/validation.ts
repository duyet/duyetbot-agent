/**
 * Password validation utilities
 * Enforces consistent password requirements across client and server
 */

import { z } from "zod";

/**
 * Password requirements:
 * - Minimum 8 characters
 * - Maximum 128 characters
 * - At least one letter (a-z, A-Z)
 * - At least one digit (0-9)
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/**
 * Zod schema for password validation
 * Use this on both client and server for consistent validation
 */
export const passwordSchema = z
	.string()
	.min(
		PASSWORD_MIN_LENGTH,
		`Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
	)
	.max(
		PASSWORD_MAX_LENGTH,
		`Password must be at most ${PASSWORD_MAX_LENGTH} characters`,
	)
	.regex(/[a-zA-Z]/, "Password must contain at least one letter")
	.regex(/[0-9]/, "Password must contain at least one number");

/**
 * Email validation schema
 */
export const emailSchema = z
	.string()
	.min(1, "Email is required")
	.email("Invalid email address");

/**
 * Combined auth form schema (login and register)
 */
export const authFormSchema = z.object({
	email: emailSchema,
	password: passwordSchema,
});

export type AuthFormData = z.infer<typeof authFormSchema>;

/**
 * Validate password strength
 * Returns detailed strength information
 */
export function getPasswordStrength(password: string): {
	score: number; // 0-4
	feedback: string[];
} {
	const feedback: string[] = [];
	let score = 0;

	if (password.length >= 8) {
		score++;
	}
	if (password.length >= 12) {
		score++;
	}
	if (/[a-z]/.test(password) && /[A-Z]/.test(password)) {
		score++;
	}
	if (/[0-9]/.test(password)) {
		score++;
	}
	if (/[^a-zA-Z0-9]/.test(password)) {
		score++;
	}

	if (password.length < 8) {
		feedback.push("Use at least 8 characters");
	}
	if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
		feedback.push("Mix upper and lower case letters");
	}
	if (!/[0-9]/.test(password)) {
		feedback.push("Include at least one number");
	}
	if (!/[^a-zA-Z0-9]/.test(password)) {
		feedback.push("Add special characters for extra security");
	}

	return { score, feedback };
}

/**
 * Sanitize error messages to prevent user enumeration
 * Generic error messages for authentication failures
 */
export const AUTH_ERROR_MESSAGES = {
	INVALID_CREDENTIALS: "Invalid email or password",
	USER_EXISTS: "An account with this email already exists",
	WEAK_PASSWORD: "Password does not meet security requirements",
	INVALID_EMAIL: "Please enter a valid email address",
	SESSION_EXPIRED: "Your session has expired. Please sign in again",
	UNAUTHORIZED: "You must be signed in to perform this action",
} as const;

/**
 * Get a generic error message for auth failures
 * Prevents user enumeration by not revealing specific details
 */
export function getGenericAuthError(): string {
	return AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS;
}

/**
 * Check if error is a Zod validation error
 */
export function isZodError(error: unknown): error is z.ZodError {
	return error instanceof z.ZodError;
}

/**
 * Format Zod errors for display
 */
export function formatZodError(error: z.ZodError): string {
	return error.errors
		.map((e) => `${e.path.join(".")}: ${e.message}`)
		.join(", ");
}
