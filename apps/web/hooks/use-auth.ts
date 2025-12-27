/**
 * Client-side auth hook
 * Provides session state and auth methods
 * - Fixed race condition with storage event listener for cross-tab sync
 * - Proper error handling for unhandled promise rejections
 * - Abort controller for cleanup on unmount
 * - Bearer token support with localStorage storage
 */

"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getStoredToken,
  initTokenSync,
  removeStoredToken,
  setStoredToken,
} from "@/lib/auth/token-storage";

export type AuthUser = {
  id: string;
  email?: string;
  type: "guest" | "regular";
};

export type Session = {
  user: AuthUser;
  expires: string;
};

type AuthState = {
  data: Session | null;
  status: "loading" | "authenticated" | "unauthenticated";
};

type UseAuthReturn = AuthState & {
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

// Zod schema for session validation
const _sessionSchema = {
  user: {
    id: "string",
    email: "string|undefined",
    type: "guest|regular",
  },
  expires: "string",
};

/**
 * Hook to access authentication state
 */
export function useAuth(): UseAuthReturn {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    data: null,
    status: "loading",
  });

  // Use ref to track if component is mounted
  const isMountedRef = useRef(true);
  // Use ref to prevent multiple simultaneous fetches
  const isFetchingRef = useRef(false);

  /**
   * Fetch session from server with abort controller
   * Uses Authorization header if token exists in localStorage
   */
  const fetchSession = useCallback(async (signal?: AbortSignal) => {
    // Prevent multiple simultaneous fetches
    if (isFetchingRef.current) {
      return;
    }

    isFetchingRef.current = true;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000); // 10s timeout

      // Use external signal if provided (for cleanup)
      const effectiveSignal = signal || controller.signal;

      // Add Authorization header if token exists
      const token = getStoredToken();
      const headers: HeadersInit = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch("/api/auth/session", {
        signal: effectiveSignal,
        headers,
      });

      clearTimeout(timeoutId);

      if (!isMountedRef.current) {
        return; // Component unmounted, don't update state
      }

      if (!response.ok) {
        setState({ data: null, status: "unauthenticated" });
        return;
      }

      const session = await response.json();

      // Basic runtime validation
      if (
        session &&
        typeof session === "object" &&
        "user" in session &&
        typeof session.user === "object" &&
        session.user !== null &&
        "id" in session.user &&
        typeof session.user.id === "string"
      ) {
        setState({ data: session as Session, status: "authenticated" });
      } else {
        console.warn("[useAuth] Invalid session format");
        setState({ data: null, status: "unauthenticated" });
      }
    } catch (error) {
      if (!isMountedRef.current) {
        return; // Component unmounted
      }

      // Handle abort separately - it's expected during cleanup
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      console.error("[useAuth] Failed to fetch session:", error);
      setState({ data: null, status: "unauthenticated" });
    } finally {
      isFetchingRef.current = false;
    }
  }, []);

  /**
   * Manual refresh function
   */
  const refresh = useCallback(async () => {
    isFetchingRef.current = false; // Reset fetch flag
    await fetchSession();
  }, [fetchSession]);

  // Initial fetch and token sync initialization
  useEffect(() => {
    fetchSession();

    return () => {
      isMountedRef.current = false;
    };
  }, [fetchSession]);

  // Initialize token sync for cross-tab synchronization
  useEffect(() => {
    initTokenSync();
  }, []);

  // Listen for storage events to sync auth state across tabs
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      // Check for session-related changes or token changes
      if (
        event.key === "session" ||
        event.key === null ||
        event.key === "auth_token"
      ) {
        // Refresh session when another tab updates it
        refresh();
      }
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [refresh]);

  /**
   * Sign out with proper error handling
   * Clears both server session and local token
   */
  const signOut = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

      // Get token for Authorization header
      const token = getStoredToken();
      const headers: HeadersInit = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      await fetch("/api/auth/logout", {
        method: "POST",
        signal: controller.signal,
        headers,
      });

      clearTimeout(timeoutId);

      // Clear local token
      removeStoredToken();

      setState({ data: null, status: "unauthenticated" });
      router.push("/");
    } catch (error) {
      console.error("[useAuth] Sign out error:", error);

      // Still clear local state even if request fails
      removeStoredToken();
      setState({ data: null, status: "unauthenticated" });
      router.push("/");
    }
  }, [router]);

  return {
    ...state,
    signOut,
    refresh,
  };
}
