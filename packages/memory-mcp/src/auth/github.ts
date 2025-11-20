import type { User } from '../types.js';

interface GitHubUser {
  id: number;
  login: string;
  email: string | null;
  name: string | null;
  avatar_url: string;
}

export async function verifyGitHubToken(token: string): Promise<GitHubUser | null> {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'duyetbot-memory-mcp',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as GitHubUser;
    return data;
  } catch {
    return null;
  }
}

export function githubUserToUser(githubUser: GitHubUser): Omit<User, 'id'> {
  const now = Date.now();
  return {
    github_id: String(githubUser.id),
    github_login: githubUser.login,
    email: githubUser.email,
    name: githubUser.name,
    avatar_url: githubUser.avatar_url,
    created_at: now,
    updated_at: now,
  };
}

export function generateUserId(): string {
  return `user_${crypto.randomUUID().replace(/-/g, '')}`;
}

export function generateSessionToken(): string {
  return `st_${crypto.randomUUID().replace(/-/g, '')}`;
}

export function generateSessionId(): string {
  return `sess_${crypto.randomUUID().replace(/-/g, '')}`;
}
