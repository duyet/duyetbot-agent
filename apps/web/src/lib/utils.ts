import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generate a random UUID using crypto.randomUUID()
 */
export function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * Fetch wrapper that handles ChatSDKError responses from the API
 *
 * @param input - Request URL or Request object
 * @param init - Optional RequestInit options
 * @throws {Error} When response is not ok
 * @returns Response object when successful
 */
export async function fetchWithErrorHandlers(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const response = await fetch(input, init);

  if (!response.ok) {
    // Try to parse ChatSDKError format from response
    try {
      const data = (await response.json()) as { code?: string; cause?: string; message?: string };
      // Throw with code and cause if available
      const { code, cause, message } = data;
      const error = new Error(message || cause || 'Request failed');
      error.name = code || 'APIError';
      throw error;
    } catch {
      // If JSON parsing fails, throw generic error with status
      throw new Error(`Request failed with status ${response.status}`);
    }
  }

  return response;
}
