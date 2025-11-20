import { z } from 'zod';
import {
  generateSessionToken,
  generateUserId,
  githubUserToUser,
  verifyGitHubToken,
} from '../auth/github.js';
import type { D1Storage } from '../storage/d1.js';
import type { AuthResult } from '../types.js';

export const authenticateSchema = z.object({
  github_token: z.string().optional(),
  oauth_code: z.string().optional(),
});

export type AuthenticateInput = z.infer<typeof authenticateSchema>;

const TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function authenticate(
  input: AuthenticateInput,
  storage: D1Storage
): Promise<AuthResult> {
  const { github_token, oauth_code } = input;

  if (!github_token && !oauth_code) {
    throw new Error('Either github_token or oauth_code is required');
  }

  // For now, only support direct token authentication
  // OAuth code flow can be added later
  if (oauth_code) {
    throw new Error('OAuth code flow not yet implemented');
  }

  if (!github_token) {
    throw new Error('github_token is required');
  }

  // Verify GitHub token
  const githubUser = await verifyGitHubToken(github_token);
  if (!githubUser) {
    throw new Error('Invalid GitHub token');
  }

  // Get or create user
  let user = await storage.getUserByGitHubId(String(githubUser.id));

  if (user) {
    // Update user info
    await storage.updateUser(user.id, {
      github_login: githubUser.login,
      email: githubUser.email,
      name: githubUser.name,
      avatar_url: githubUser.avatar_url,
      updated_at: Date.now(),
    });
  } else {
    // Create new user
    const userData = githubUserToUser(githubUser);
    user = await storage.createUser({
      id: generateUserId(),
      ...userData,
    });
  }

  // Create session token
  const now = Date.now();
  const sessionToken = generateSessionToken();
  const expiresAt = now + TOKEN_EXPIRY_MS;

  await storage.createToken({
    token: sessionToken,
    user_id: user.id,
    expires_at: expiresAt,
    created_at: now,
  });

  // Clean up expired tokens
  await storage.deleteExpiredTokens();

  return {
    user_id: user.id,
    session_token: sessionToken,
    expires_at: expiresAt,
  };
}
