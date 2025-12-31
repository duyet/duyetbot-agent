/**
 * GitHub OAuth utilities
 */

import { kv } from "@vercel/kv";
import { createSessionToken } from "@/lib/auth/jwt";
import { setSessionCookie } from "@/lib/auth/middleware";
import { createUser, getUser } from "@/lib/db/queries";
import { hashPassword } from "./crypto";

export type GitHubUser = {
	id: number;
	login: string;
	email: string;
	name?: string;
	avatar_url?: string;
};

export type GitHubTokenResponse = {
	access_token: string;
	token_type: string;
	scope: string;
};

/**
 * Generate a random state token for OAuth
 */
function generateStateToken(): string {
	const array = new Uint8Array(16);
	crypto.getRandomValues(array);
	return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

/**
 * Store OAuth state in KV with 5-minute TTL
 */
export async function storeOAuthState(state: string): Promise<void> {
	await kv.set(`oauth:state:${state}`, "valid", { ex: 300 }); // 5 minutes
}

/**
 * Verify OAuth state from KV
 */
export async function verifyOAuthState(state: string): Promise<boolean> {
	const value = await kv.get(`oauth:state:${state}`);
	await kv.del(`oauth:state:${state}`); // One-time use
	return value === "valid";
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(
	code: string,
): Promise<GitHubTokenResponse> {
	const response = await fetch("https://github.com/login/oauth/access_token", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json",
		},
		body: JSON.stringify({
			client_id: process.env.GITHUB_CLIENT_ID,
			client_secret: process.env.GITHUB_CLIENT_SECRET,
			code,
		}),
	});

	if (!response.ok) {
		throw new Error("Failed to exchange code for token");
	}

	const data = (await response.json()) as GitHubTokenResponse;

	if (!data.access_token) {
		throw new Error("No access token in response");
	}

	return data;
}

/**
 * Fetch user profile from GitHub API
 */
export async function getGitHubUser(accessToken: string): Promise<GitHubUser> {
	const response = await fetch("https://api.github.com/user", {
		headers: {
			Authorization: `Bearer ${accessToken}`,
			Accept: "application/json",
		},
	});

	if (!response.ok) {
		throw new Error("Failed to fetch GitHub user");
	}

	const data = (await response.json()) as GitHubUser;

	// Get primary email if not public
	if (!data.email) {
		const emailResponse = await fetch("https://api.github.com/user/emails", {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				Accept: "application/json",
			},
		});

		if (emailResponse.ok) {
			const emails = (await emailResponse.json()) as Array<{
				email: string;
				primary: boolean;
				verified: boolean;
			}>;
			const primaryEmail = emails.find((e) => e.primary && e.verified);
			if (primaryEmail) {
				data.email = primaryEmail.email;
			}
		}
	}

	return data;
}

/**
 * Create or update user from GitHub profile
 */
export async function createOrUpdateGitHubUser(
	githubUser: GitHubUser,
): Promise<{ id: string; email: string }> {
	// Check if user exists by GitHub username in email
	const email = `${githubUser.login.toLowerCase()}@github.local`;
	const existingUsers = await getUser(email);

	if (existingUsers.length > 0) {
		const [user] = existingUsers;
		return { id: user.id, email: user.email };
	}

	// Create new user with dummy password (OAuth-only user)
	const hashedPassword = await hashPassword(generateStateToken());
	await createUser(email, hashedPassword);

	const users = await getUser(email);
	const [user] = users;

	if (!user) {
		throw new Error("Failed to create GitHub user");
	}

	return { id: user.id, email: user.email };
}

/**
 * Complete GitHub OAuth login
 */
export async function completeGitHubLogin(
	githubUser: GitHubUser,
): Promise<void> {
	const { id, email } = await createOrUpdateGitHubUser(githubUser);

	// Create session token
	const sessionToken = await createSessionToken(id, email, "regular");

	// Set session cookie
	await setSessionCookie(sessionToken);
}
