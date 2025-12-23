/**
 * Session management utilities
 *
 * Handles session parsing and validation
 */

import { cookies } from 'next/headers';
import { isSessionValid, SESSION_COOKIE_NAME } from './auth';

export interface SessionUser {
  id: string;
  login: string;
  name: string | null;
  avatarUrl: string | null;
  email: string | null;
}

export interface SessionItem {
  sessionId: string;
  chatId: string;
  title: string | undefined;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

export interface Session {
  user: SessionUser;
  accessToken: string;
  expiresAt: number;
}

/**
 * Parse and validate session from cookie
 */
export async function getSession(): Promise<Session | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

    if (!sessionCookie?.value) {
      return null;
    }

    const session: Session = JSON.parse(sessionCookie.value);

    if (!isSessionValid(session)) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

/**
 * Get current user from session
 */
export async function getUser(): Promise<SessionUser | null> {
  const session = await getSession();
  return session?.user ?? null;
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return session !== null;
}
