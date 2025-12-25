/**
 * Client-side auth hook
 * Provides session state and auth methods
 */

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { UserType } from "@/lib/auth/middleware";

export interface AuthUser {
  id: string;
  email?: string;
  type: UserType;
}

export interface Session {
  user: AuthUser;
  expires: string;
}

type AuthState = {
  data: Session | null;
  status: "loading" | "authenticated" | "unauthenticated";
};

type UseAuthReturn = AuthState & {
  signOut: () => Promise<void>;
};

/**
 * Hook to access authentication state
 */
export function useAuth(): UseAuthReturn {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<AuthState>({
    data: null,
    status: "loading",
  });

  useEffect(() => {
    // Fetch session from server
    fetch("/api/auth/session")
      .then((res) => {
        if (!res.ok) {
          setState({ data: null, status: "unauthenticated" });
          return null;
        }
        return res.json();
      })
      .then((session) => {
        if (session) {
          setState({ data: session as Session, status: "authenticated" });
        } else {
          setState({ data: null, status: "unauthenticated" });
        }
      })
      .catch(() => {
        setState({ data: null, status: "unauthenticated" });
      });
  }, []);

  const signOut = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setState({ data: null, status: "unauthenticated" });
      router.push("/");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  return {
    ...state,
    signOut,
  };
}
