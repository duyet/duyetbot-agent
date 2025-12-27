/**
 * Client-side API functions to replace Server Actions
 * These functions call the Hono worker API endpoints
 */

import { z } from "zod";
import type { VisibilityType } from "@/components/visibility-selector";
import type { Suggestion } from "@/lib/db/schema";
import { authFormSchema, formatZodError, isZodError } from "./auth/validation";

// Type definitions matching the old Server Actions
export type LoginActionState = {
  status: "idle" | "in_progress" | "success" | "failed" | "invalid_data";
  error?: string;
  token?: string; // JWT token for bearer auth
};

export type RegisterActionState = {
  status:
    | "idle"
    | "in_progress"
    | "success"
    | "failed"
    | "user_exists"
    | "invalid_data";
  error?: string;
  token?: string; // JWT token for bearer auth
};

/**
 * Safe fetch wrapper with error handling and abort support
 */
async function safeFetch<T>(
  url: string,
  options: RequestInit = {},
  schema?: z.ZodSchema<T>
): Promise<{ data?: T; error?: string; status: number }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000); // 30s timeout

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return {
        error:
          (data as { error?: string }).error ||
          `Request failed with status ${response.status}`,
        status: response.status,
      };
    }

    const json = await response.json();

    if (schema) {
      try {
        const validated = schema.parse(json);
        return { data: validated, status: response.status };
      } catch (error) {
        if (isZodError(error)) {
          return { error: formatZodError(error), status: response.status };
        }
        return { error: "Invalid response format", status: response.status };
      }
    }

    return { data: json as T, status: response.status };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error) {
      if (error.name === "AbortError") {
        return { error: "Request timeout. Please try again.", status: 408 };
      }
      return { error: error.message, status: 0 };
    }

    return { error: "An unexpected error occurred", status: 0 };
  }
}

// Zod schemas for API responses
const _sessionResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.string().optional(),
  }),
  expires: z.string(),
});

const authResponseSchema = z.object({
  success: z.boolean(),
  user: z.object({
    id: z.string(),
    email: z.string(),
    type: z.enum(["guest", "regular"]),
  }),
  token: z.string(),
});

/**
 * Login with email/password
 */
export async function login(formData: FormData): Promise<LoginActionState> {
  try {
    const validatedData = authFormSchema.parse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    const result = await safeFetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: validatedData.email,
        password: validatedData.password,
      }),
    });

    if (result.error) {
      return { status: "failed", error: result.error };
    }

    // Validate and extract token
    const validated = authResponseSchema.safeParse(result.data);
    if (validated.success) {
      return { status: "success", token: validated.data.token };
    }

    return { status: "success" };
  } catch (error) {
    if (isZodError(error)) {
      return { status: "invalid_data", error: formatZodError(error) };
    }
    return { status: "failed", error: "An unexpected error occurred" };
  }
}

/**
 * Register new user
 */
export async function register(
  formData: FormData
): Promise<RegisterActionState> {
  try {
    const validatedData = authFormSchema.parse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    const result = await safeFetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: validatedData.email,
        password: validatedData.password,
      }),
    });

    if (result.status === 409) {
      return {
        status: "user_exists",
        error: result.error || "User already exists",
      };
    }

    if (result.error) {
      return { status: "failed", error: result.error };
    }

    // Validate and extract token
    const validated = authResponseSchema.safeParse(result.data);
    if (validated.success) {
      return { status: "success", token: validated.data.token };
    }

    return { status: "success" };
  } catch (error) {
    if (isZodError(error)) {
      return { status: "invalid_data", error: formatZodError(error) };
    }
    return { status: "failed", error: "An unexpected error occurred" };
  }
}

/**
 * Logout
 */
export async function logout(): Promise<void> {
  await safeFetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/";
}

/**
 * Update chat visibility
 */
export async function updateChatVisibility({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: VisibilityType;
}): Promise<void> {
  const result = await safeFetch("/api/chat/visibility", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatId, visibility }),
  });

  if (result.error) {
    throw new Error(result.error);
  }
}

/**
 * Delete trailing messages after a specific message
 */
export async function deleteTrailingMessages({
  id,
}: {
  id: string;
}): Promise<void> {
  const result = await safeFetch("/api/chat/messages/trailing", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messageId: id }),
  });

  if (result.error) {
    throw new Error(result.error);
  }
}

/**
 * Delete a single message by ID
 */
export async function deleteMessage({ id }: { id: string }): Promise<void> {
  const result = await safeFetch(`/api/chat/messages/${id}`, {
    method: "DELETE",
  });

  if (result.error) {
    throw new Error(result.error);
  }
}

/**
 * Generate title from message and update chat
 * With proper error handling and logging
 */
export async function generateTitleFromUserMessage({
  chatId,
  message,
}: {
  chatId: string;
  message: string;
}): Promise<string> {
  const result = await safeFetch("/api/chat/title", {
    method: "POST",
    body: JSON.stringify({ chatId, message }),
  });

  if (result.error) {
    console.warn("[generateTitle] Failed to generate title:", result.error);
    return "New chat";
  }

  const titleSchema = z.object({ title: z.string().optional() });
  const validated = titleSchema.safeParse(result.data);

  if (!validated.success) {
    console.warn("[generateTitle] Invalid response format");
    return "New chat";
  }

  return validated.data.title || "New chat";
}

/**
 * Get suggestions for document
 */
export async function getSuggestions({
  documentId,
}: {
  documentId: string;
}): Promise<Suggestion[]> {
  const result = await safeFetch(
    `/api/suggestions?documentId=${encodeURIComponent(documentId)}`
  );

  if (result.error) {
    return [];
  }

  const suggestionsSchema = z.array(z.any());
  const validated = suggestionsSchema.safeParse(result.data);

  return validated.success ? validated.data : [];
}
