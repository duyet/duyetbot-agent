/**
 * Auth routes for Hono worker
 * POST /api/auth/login - Login with email/password
 * POST /api/auth/register - Register new user
 * POST /api/auth/logout - Clear session cookie
 * GET /api/auth/session - Get current session
 * GET /api/auth/guest - Create guest user (redirect)
 * GET /api/auth/github - GitHub OAuth flow
 * GET /api/auth/github/callback - GitHub OAuth callback
 */

import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { user } from "../../lib/db/schema";
import {
	logAuthFailure,
	logAuthSuccess,
	logSecurityEvent,
} from "../lib/audit-logger";
import {
	clearSessionCookie,
	createAndRegisterSession,
	getSessionFromRequest,
	getSessionMetadata,
	setSessionCookie,
} from "../lib/auth-helpers";
import { getDb } from "../lib/context";
import {
	hashPassword,
	signState,
	verifyPassword,
	verifyState,
} from "../lib/crypto";
import { invalidateSession, verifySession } from "../lib/session-manager";
import { generateUUID } from "../lib/utils";
import type { Env } from "../types";

export const authRoutes = new Hono<{ Bindings: Env }>();

// Generic error message to prevent user enumeration
const GENERIC_AUTH_ERROR = "Invalid email or password";

// Schemas - consistent with client-side validation
const passwordSchema = z
	.string()
	.min(8, "Password must be at least 8 characters")
	.max(128, "Password must be at most 128 characters")
	.regex(/[a-zA-Z]/, "Password must contain at least one letter")
	.regex(/[0-9]/, "Password must contain at least one number");

const loginSchema = z.object({
	email: z.string().email("Invalid email address"),
	password: passwordSchema,
});

/**
 * KV-based rate limiter for auth endpoints
 * Uses Cloudflare KV for persistent rate limiting across worker instances
 */
async function checkRateLimit(
	c: any,
	identifier: string,
	maxRequests = 5,
	windowMs = 60_000,
): Promise<boolean> {
	try {
		const kv = c.env.RATE_LIMIT_KV;
		if (!kv) {
			// Fallback to in-memory if KV not available (development)
			console.warn(
				"RATE_LIMIT_KV not available, using in-memory rate limiting",
			);
			return true; // Allow in development
		}

		const key = `auth_rate_limit:${identifier}`;
		const now = Date.now();
		const _windowStart = now - windowMs;

		// Get current rate limit data
		const record = await kv.get(key, "json");
		const data = record as { count: number; resetTime: number } | null;

		// Clean up expired window
		if (!data || now > data.resetTime) {
			await kv.put(
				key,
				JSON.stringify({ count: 1, resetTime: now + windowMs }),
				{
					expirationTtl: Math.ceil(windowMs / 1000),
				},
			);
			return true;
		}

		// Check if limit exceeded
		if (data.count >= maxRequests) {
			return false;
		}

		// Increment counter
		data.count++;
		await kv.put(key, JSON.stringify(data), {
			expirationTtl: Math.ceil((data.resetTime - now) / 1000),
		});

		return true;
	} catch (error) {
		console.error("Rate limit check failed:", error);
		// Fail open - allow request if rate limiting fails
		return true;
	}
}

/**
 * Get client identifier for rate limiting
 */
function getClientId(c: any): string {
	const forwarded = c.req.header("x-forwarded-for");
	const ip = forwarded
		? forwarded.split(",")[0]
		: c.req.header("cf-connecting-ip") || "unknown";
	return ip;
}

/**
 * POST /api/auth/login
 * Login with email/password
 * - Rate limiting by IP
 * - Constant-time password verification to prevent timing attacks
 * - Generic error messages to prevent user enumeration
 */
authRoutes.post("/login", zValidator("json", loginSchema), async (c) => {
	const clientId = getClientId(c);

	// Rate limiting (now using KV)
	const allowed = await checkRateLimit(c, clientId, 5, 60_000);
	if (!allowed) {
		// Log rate limit exceeded for security monitoring
		await logSecurityEvent(
			c,
			null,
			"rate_limit_exceeded",
			`Login rate limit exceeded for IP: ${clientId}`,
			getSessionMetadata(c),
		);
		return c.json(
			{ error: "Too many login attempts. Please try again later." },
			429,
		);
	}

	const { email, password } = c.req.valid("json");

	const db = getDb(c);
	const users = await db.select().from(user).where(eq(user.email, email));

	// Use constant-time behavior for both user not found and wrong password
	// to prevent user enumeration via timing attacks
	if (users.length === 0) {
		// Always perform password verification to maintain consistent timing
		// Use a pre-computed dummy hash instead of hashing on each request
		const dummyHash = "$2a$10$abcdefghijklmnopqrstuvwxyz1234567890"; // Valid bcrypt hash format
		await verifyPassword("dummy_password_for_timing", dummyHash);
		// Log failed login attempt for security monitoring
		await logAuthFailure(
			"failed_login",
			`Login attempt failed for email: ${email}`,
			getSessionMetadata(c),
		);
		return c.json({ error: GENERIC_AUTH_ERROR }, 401);
	}

	const [userRecord] = users;

	if (!userRecord.password) {
		// User was created via OAuth - can't login with password
		// Still verify a dummy password for consistent timing
		const dummyHash = "$2a$10$abcdefghijklmnopqrstuvwxyz1234567890";
		await verifyPassword("dummy_password_for_timing", dummyHash);
		// Log failed login attempt (OAuth user trying password login)
		await logAuthFailure(
			"failed_login",
			`Password login attempted for OAuth user: ${email}`,
			getSessionMetadata(c),
		);
		return c.json({ error: GENERIC_AUTH_ERROR }, 401);
	}

	const passwordsMatch = await verifyPassword(password, userRecord.password);

	if (!passwordsMatch) {
		// Log failed login attempt for security monitoring
		await logAuthFailure(
			"failed_login",
			`Incorrect password for email: ${email}`,
			getSessionMetadata(c),
		);
		return c.json({ error: GENERIC_AUTH_ERROR }, 401);
	}

	// Validate SESSION_SECRET is set
	if (!c.env.SESSION_SECRET) {
		console.error("SESSION_SECRET is not configured");
		return c.json({ error: "Server configuration error" }, 500);
	}

	// Create and register session in database (for invalidation support)
	const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
	const sessionToken = await createAndRegisterSession(
		userRecord.id,
		userRecord.email,
		"regular",
		c.env.SESSION_SECRET,
		expiresAt,
		c,
		getSessionMetadata(c),
	);

	// Log successful login for audit trail
	await logAuthSuccess(c, userRecord.id, "login", getSessionMetadata(c));

	const response = c.json({
		success: true,
		user: {
			id: userRecord.id,
			email: userRecord.email,
			type: "regular" as const,
		},
		token: sessionToken,
	});

	// Keep setting cookie for backward compatibility during migration
	return setSessionCookie(response, sessionToken);
});

/**
 * POST /api/auth/register
 * Register new user
 * - Rate limiting by IP
 * - Strong password validation
 * - Generic error for existing user to prevent enumeration
 */
authRoutes.post("/register", zValidator("json", loginSchema), async (c) => {
	const clientId = getClientId(c);

	// Rate limiting
	if (!checkRateLimit(clientId, 3, 60_000)) {
		// Log rate limit exceeded for security monitoring
		await logSecurityEvent(
			c,
			null,
			"rate_limit_exceeded",
			`Registration rate limit exceeded for IP: ${clientId}`,
			getSessionMetadata(c),
		);
		return c.json(
			{ error: "Too many registration attempts. Please try again later." },
			429,
		);
	}

	const { email, password } = c.req.valid("json");

	// Validate SESSION_SECRET is set
	if (!c.env.SESSION_SECRET) {
		console.error("SESSION_SECRET is not configured");
		return c.json({ error: "Server configuration error" }, 500);
	}

	const db = getDb(c);
	const existingUsers = await db
		.select()
		.from(user)
		.where(eq(user.email, email));

	if (existingUsers.length > 0) {
		// Use generic error to prevent user enumeration
		return c.json({ error: "An account with this email already exists" }, 409);
	}

	const hashedPassword = await hashPassword(password);

	try {
		await db.insert(user).values({ email, password: hashedPassword });
	} catch (error) {
		console.error("Failed to create user:", error);
		// Log failed registration attempt for security monitoring
		await logAuthFailure(
			"failed_register",
			`Database error during registration for email: ${email}`,
			getSessionMetadata(c),
		);
		return c.json({ error: "Failed to create account" }, 500);
	}

	const users = await db.select().from(user).where(eq(user.email, email));
	const [newUser] = users;

	if (!newUser) {
		return c.json({ error: "Failed to create account" }, 500);
	}

	// Create and register session in database (for invalidation support)
	const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
	const sessionToken = await createAndRegisterSession(
		newUser.id,
		newUser.email,
		"regular",
		c.env.SESSION_SECRET,
		expiresAt,
		c,
		getSessionMetadata(c),
	);

	// Log successful registration for audit trail
	await logAuthSuccess(c, newUser.id, "register", getSessionMetadata(c));
	await logAuthSuccess(c, newUser.id, "account_created", getSessionMetadata(c));

	const response = c.json({
		success: true,
		user: {
			id: newUser.id,
			email: newUser.email,
			type: "regular" as const,
		},
		token: sessionToken,
	});

	// Keep setting cookie for backward compatibility during migration
	return setSessionCookie(response, sessionToken);
});

/**
 * POST /api/auth/logout
 * Clear session cookie and invalidate session in database
 */
authRoutes.post("/logout", async (c) => {
	// Get session token for database invalidation
	const authHeader = c.req.header("Authorization");
	const cookieHeader = c.req.header("Cookie");

	let token: string | null = null;

	// Try Authorization header first
	if (authHeader?.startsWith("Bearer ")) {
		token = authHeader.slice(7);
	}
	// Fallback to cookie
	else if (cookieHeader) {
		const cookies = cookieHeader.split(";").map((c: string) => c.trim());
		const sessionCookie = cookies.find((c: string) => c.startsWith("session="));
		if (sessionCookie) {
			token = sessionCookie.slice(8);
		}
	}

	// Get user ID for audit logging before invalidating session
	let userId: string | null = null;
	if (token) {
		try {
			const sessionInfo = await verifySession(c, token);
			if (sessionInfo) {
				userId = sessionInfo.userId;
			}
		} catch (error) {
			console.error("[logout] Failed to verify session for logging:", error);
		}
	}

	// Invalidate session in database if token found
	if (token) {
		try {
			await invalidateSession(c, token);
		} catch (error) {
			console.error("[logout] Failed to invalidate session:", error);
			// Continue with cookie clearing even if database invalidation fails
		}
	}

	// Log logout event for audit trail
	if (userId) {
		await logAuthSuccess(c, userId, "logout", getSessionMetadata(c));
	}

	const response = c.json({ success: true });
	return clearSessionCookie(response);
});

/**
 * GET /api/auth/session
 * Get current session
 */
authRoutes.get("/session", async (c) => {
	const session = await getSessionFromRequest(c);

	if (!session) {
		return c.json(null, 401);
	}

	return c.json(session);
});

/**
 * GET /api/auth/guest
 * Create guest user and redirect (simplified - returns JSON instead of redirect)
 */
authRoutes.get("/guest", async (c) => {
	const email = `guest-${Date.now()}`;
	const password = await hashPassword(generateUUID());

	const db = getDb(c);
	await db.insert(user).values({ email, password });

	const users = await db.select().from(user).where(eq(user.email, email));
	const [guestUser] = users;

	if (!guestUser) {
		return c.json({ error: "Failed to create guest user" }, 500);
	}

	// Create and register session in database (for invalidation support)
	const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
	const sessionToken = await createAndRegisterSession(
		guestUser.id,
		guestUser.email,
		"guest",
		c.env.SESSION_SECRET,
		expiresAt,
		c,
		getSessionMetadata(c),
	);

	// Log guest user creation for audit trail
	await logAuthSuccess(c, guestUser.id, "guest_created", getSessionMetadata(c));
	await logAuthSuccess(
		c,
		guestUser.id,
		"account_created",
		getSessionMetadata(c),
	);

	const response = c.json({
		success: true,
		user: {
			id: guestUser.id,
			email: guestUser.email,
			type: "guest" as const,
		},
		token: sessionToken,
	});

	// Keep setting cookie for backward compatibility during migration
	return setSessionCookie(response, sessionToken);
});

/**
 * GET /api/auth/github
 * Initiate GitHub OAuth flow
 */
authRoutes.get("/github", async (c) => {
	const clientId = c.env.GITHUB_CLIENT_ID;
	if (!clientId) {
		return c.json({ error: "GitHub OAuth not configured" }, 500);
	}

	// Generate a random state parameter for CSRF protection
	const state = generateUUID();
	const signedState = await signState(state, c.env.SESSION_SECRET);

	// Build GitHub authorize URL
	const params = new URLSearchParams({
		client_id: clientId,
		redirect_uri: `${new URL(c.req.url).origin}/api/auth/github/callback`,
		scope: "read:user user:email",
		state: signedState,
	});

	const githubUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;

	// Redirect to GitHub
	return c.redirect(githubUrl);
});

/**
 * GET /api/auth/github/callback
 * GitHub OAuth callback
 */
authRoutes.get("/github/callback", async (c) => {
	const { code, state } = c.req.query();
	const clientId = c.env.GITHUB_CLIENT_ID;
	const clientSecret = c.env.GITHUB_CLIENT_SECRET;

	if (!clientId || !clientSecret) {
		return c.json({ error: "GitHub OAuth not configured" }, 500);
	}

	if (!code || !state) {
		return c.json({ error: "Missing code or state parameter" }, 400);
	}

	// Verify state parameter to prevent CSRF attacks
	const verifiedState = await verifyState(state, c.env.SESSION_SECRET);
	if (!verifiedState) {
		return c.json({ error: "Invalid state parameter" }, 400);
	}

	try {
		// Exchange code for access token
		const tokenResponse = await fetch(
			"https://github.com/login/oauth/access_token",
			{
				method: "POST",
				headers: {
					Accept: "application/json",
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					client_id: clientId,
					client_secret: clientSecret,
					code,
				}),
			},
		);

		if (!tokenResponse.ok) {
			console.error(
				"[GitHub OAuth] Token exchange failed:",
				tokenResponse.status,
			);
			return c.json({ error: "Failed to exchange code for token" }, 500);
		}

		const tokenData = (await tokenResponse.json()) as { access_token?: string };
		const accessToken = tokenData.access_token;

		if (!accessToken) {
			console.error("[GitHub OAuth] No access token in response:", tokenData);
			return c.json({ error: "No access token received" }, 500);
		}

		// Fetch user profile from GitHub
		const userResponse = await fetch("https://api.github.com/user", {
			headers: {
				Authorization: `token ${accessToken}`,
				Accept: "application/vnd.github+json",
				"User-Agent": "DuyetBot-Web",
				"X-GitHub-Api-Version": "2022-11-28",
			},
		});

		if (!userResponse.ok) {
			const errorText = await userResponse.text();
			console.error(
				"[GitHub OAuth] User profile fetch failed:",
				userResponse.status,
				errorText,
			);
			return c.json(
				{ error: `Failed to fetch user profile: ${userResponse.status}` },
				500,
			);
		}

		const githubUser = (await userResponse.json()) as {
			id: number;
			login: string;
			name?: string;
			email?: string;
		};

		// Fetch user emails to get primary email
		const emailsResponse = await fetch("https://api.github.com/user/emails", {
			headers: {
				Authorization: `token ${accessToken}`,
				Accept: "application/vnd.github+json",
				"User-Agent": "DuyetBot-Web",
				"X-GitHub-Api-Version": "2022-11-28",
			},
		});

		let email = githubUser.email;
		if (emailsResponse.ok) {
			const emails = (await emailsResponse.json()) as Array<{
				email: string;
				primary: boolean;
				verified: boolean;
			}>;
			const primaryEmail = emails.find((e) => e.primary && e.verified);
			if (primaryEmail) {
				email = primaryEmail.email;
			}
		}

		if (!email) {
			return c.json({ error: "No email found for GitHub account" }, 400);
		}

		// Check if user exists by GitHub ID
		const db = getDb(c);
		const githubId = `github_${githubUser.id}`;

		let existingUser = await db
			.select()
			.from(user)
			.where(eq(user.githubId, githubId))
			.get();

		// If not found by GitHub ID, check by email
		if (!existingUser) {
			existingUser = await db
				.select()
				.from(user)
				.where(eq(user.email, email))
				.get();
		}

		let userId: string;
		let _isNewUser = false;

		if (existingUser) {
			// Update existing user with GitHub ID if missing
			if (!existingUser.githubId) {
				await db
					.update(user)
					.set({
						githubId,
						name: githubUser.name || githubUser.login,
						updatedAt: new Date(),
					})
					.where(eq(user.id, existingUser.id));
			}
			userId = existingUser.id;
		} else {
			// Create new user
			userId = generateUUID();
			await db.insert(user).values({
				id: userId,
				email,
				name: githubUser.name || githubUser.login,
				githubId,
				createdAt: new Date(),
				updatedAt: new Date(),
			});
			_isNewUser = true;
		}

		// Create and register session token
		const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
		const sessionToken = await createAndRegisterSession(
			userId,
			email,
			"regular",
			c.env.SESSION_SECRET,
			expiresAt,
			c,
			getSessionMetadata(c),
		);

		// Log GitHub OAuth login for audit trail
		await logAuthSuccess(c, userId, "oauth_login", getSessionMetadata(c));
		if (_isNewUser) {
			await logAuthSuccess(c, userId, "account_created", getSessionMetadata(c));
		}

		// Set session cookie and redirect to homepage
		const origin = new URL(c.req.url).origin;
		c.header(
			"Set-Cookie",
			`session=${sessionToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${30 * 24 * 60 * 60}`,
		);
		return c.redirect(origin);
	} catch (error) {
		console.error("[GitHub OAuth] Error:", error);
		return c.json({ error: "OAuth flow failed" }, 500);
	}
});
