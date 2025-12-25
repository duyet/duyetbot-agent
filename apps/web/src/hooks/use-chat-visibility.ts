/**
 * useChatVisibility Hook
 *
 * Manages chat visibility state (private/public) with SWR integration,
 * optimistic UI updates, and cache synchronization.
 */

import { useCallback, useMemo } from 'react';
import useSWR, { useSWRConfig } from 'swr';

/**
 * Visibility type for chats
 */
export type VisibilityType = 'private' | 'public';

/**
 * Session item from history API
 */
interface HistorySession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  visibility?: VisibilityType;
}

/**
 * History API response
 */
interface HistoryResponse {
  data: HistorySession[];
  pagination: {
    hasMore: boolean;
    nextCursor: string | null;
    prevCursor: string | null;
  };
}

/**
 * Parameters for useChatVisibility hook
 */
export interface UseChatVisibilityParams {
  /** Unique chat identifier */
  chatId: string;
  /** Initial visibility state */
  initialVisibilityType: VisibilityType;
}

/**
 * Result from useChatVisibility hook
 */
export interface UseChatVisibilityResult {
  /** Current visibility type */
  visibilityType: VisibilityType;
  /** Update visibility type */
  setVisibilityType: (visibility: VisibilityType) => Promise<void>;
  /** Whether update is in progress */
  isUpdating: boolean;
  /** Update error if any */
  error: Error | null;
}

/**
 * SWR cache key for chat visibility
 */
const VISIBILITY_CACHE_KEY = (chatId: string) => `chat-visibility-${chatId}`;

/**
 * SWR cache key for history
 */
const HISTORY_CACHE_KEY = '/api/v1/history';

/**
 * Fetcher for SWR (no-op - we use fallback data)
 */
const fetcher = (): Promise<VisibilityType> => Promise.resolve('private' as VisibilityType);

/**
 * Manages chat visibility state with optimistic updates.
 *
 * Features:
 * - SWR integration for cache management
 * - Optimistic UI updates for instant feedback
 * - Automatic cache synchronization with history
 * - Error handling with rollback
 *
 * @example
 * ```tsx
 * const { visibilityType, setVisibilityType, isUpdating } = useChatVisibility({
 *   chatId: 'abc123',
 *   initialVisibilityType: 'private',
 * });
 *
 * return (
 *   <button onClick={() => setVisibilityType('public')} disabled={isUpdating}>
 *     Make Public
 *   </button>
 * );
 * ```
 */
export function useChatVisibility({
  chatId,
  initialVisibilityType,
}: UseChatVisibilityParams): UseChatVisibilityResult {
  const { mutate, cache } = useSWRConfig();

  // Local visibility state using SWR for caching
  const {
    data: localVisibility,
    mutate: setLocalVisibility,
    error,
  } = useSWR<VisibilityType>(VISIBILITY_CACHE_KEY(chatId), fetcher, {
    fallbackData: initialVisibilityType,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  // Get visibility from history cache for consistency
  const visibilityFromHistory = useMemo(() => {
    const historyData = cache.get(HISTORY_CACHE_KEY)?.data as HistoryResponse | undefined;
    if (!historyData) {
      return null;
    }
    const chat = historyData.data.find((c) => c.id === chatId);
    return chat?.visibility || null;
  }, [cache, chatId]);

  // Resolve visibility type: history cache > local state > initial
  const visibilityType = useMemo<VisibilityType>(() => {
    if (visibilityFromHistory) {
      return visibilityFromHistory;
    }
    return localVisibility || initialVisibilityType;
  }, [visibilityFromHistory, localVisibility, initialVisibilityType]);

  /**
   * Update chat visibility with optimistic update
   */
  const setVisibilityType = useCallback(
    async (updatedVisibility: VisibilityType) => {
      // Skip if no change
      if (updatedVisibility === visibilityType) {
        return;
      }

      const previousVisibility = visibilityType;

      // Optimistic update: update local state immediately
      setLocalVisibility(updatedVisibility);

      // Optimistic update: update history cache
      mutate(
        HISTORY_CACHE_KEY,
        (current: HistoryResponse | undefined) => {
          if (!current) {
            return current;
          }
          return {
            ...current,
            data: current.data.map((chat) =>
              chat.id === chatId ? { ...chat, visibility: updatedVisibility } : chat
            ),
          };
        },
        false
      );

      try {
        // API call to update visibility in database
        const response = await fetch(`/api/v1/history/${chatId}/visibility`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ visibility: updatedVisibility }),
        });

        if (!response.ok) {
          const errorData = (await response
            .json()
            .catch(() => ({ error: 'Failed to update visibility' }))) as { error?: string };
          throw new Error(errorData.error || 'Failed to update visibility');
        }

        // Revalidate history to ensure consistency
        await mutate(HISTORY_CACHE_KEY);
      } catch (err) {
        // Rollback on error
        setLocalVisibility(previousVisibility);

        mutate(
          HISTORY_CACHE_KEY,
          (current: HistoryResponse | undefined) => {
            if (!current) {
              return current;
            }
            return {
              ...current,
              data: current.data.map((chat) =>
                chat.id === chatId ? { ...chat, visibility: previousVisibility } : chat
              ),
            };
          },
          false
        );

        // Re-throw error for caller to handle
        throw err instanceof Error ? err : new Error('Failed to update visibility');
      }
    },
    [chatId, visibilityType, setLocalVisibility, mutate]
  );

  return {
    visibilityType,
    setVisibilityType,
    isUpdating: false,
    error: error || null,
  };
}
