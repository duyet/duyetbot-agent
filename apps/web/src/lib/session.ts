/**
 * Session management utilities (client-side)
 *
 * For static export, session validation is done via API calls.
 * This file exports only types for TypeScript.
 */

export interface SessionUser {
  id: string;
  login: string;
  name: string | null;
  avatarUrl: string | null;
  email: string | null;
}

export interface Session {
  user: SessionUser;
  accessToken: string;
  expiresAt: number;
}

export interface SessionItem {
  sessionId: string;
  chatId: string;
  title: string | undefined;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

// Client-side session utilities
export async function getSession(): Promise<Session | null> {
  try {
    const response = await fetch('/api/sessions');
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export async function getUser(): Promise<SessionUser | null> {
  const session = await getSession();
  return session?.user ?? null;
}

export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return session !== null;
}
