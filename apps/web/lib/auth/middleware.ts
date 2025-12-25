/**
 * Authentication Middleware
 * Provides auth() and requireAuth() functions for server components
 */

import { cookies } from "next/headers";
import type { Session } from "./jwt";
import {
  createSessionFromPayload,
  SESSION_MAX_AGE,
  verifySessionToken,
} from "./jwt";

const SESSION_COOKIE_NAME = "session";

/**
 * Get the current session from cookies
 * Returns null if no valid session exists
 */
export async function auth(): Promise<Session | null> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionToken) {
      return null;
    }

    const payload = await verifySessionToken(sessionToken);
    if (!payload) {
      return null;
    }

    return createSessionFromPayload(payload);
  } catch {
    return null;
  }
}

/**
 * Require authentication - throws error if not authenticated
 * Use this in server actions/routes that require login
 */
export async function requireAuth(): Promise<Session> {
  const session = await auth();

  if (!session) {
    throw new AuthError("Authentication required");
  }

  return session;
}

/**
 * Set the session cookie
 */
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

/**
 * Clear the session cookie
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete({
    name: SESSION_COOKIE_NAME,
    path: "/",
  });
}

/**
 * Custom error class for authentication failures
 */
export class AuthError extends Error {
  constructor(message: string, public statusCode: number = 401) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Re-export types for convenience
 */
export type { Session, SessionPayload, UserType } from "./jwt";
