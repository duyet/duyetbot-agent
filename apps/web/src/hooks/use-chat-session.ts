/**
 * Chat Session Hook
 *
 * Manages session state and URL synchronization for the chat interface.
 * Handles loading sessions from history API and browser navigation.
 */

'use client';

import type { UIMessage } from 'ai';
import { useCallback, useEffect, useRef, useState } from 'react';
import { convertToUIMessages, type SessionData } from '@/lib/message-converter';

export interface UseChatSessionResult {
  /** Current session ID (null for new unsaved session) */
  sessionId: string | null;
  /** Whether this is a new session without messages */
  isNewSession: boolean;
  /** Whether session is being loaded from API */
  isLoadingSession: boolean;
  /** Loaded session messages (null if not loaded yet) */
  sessionMessages: UIMessage[] | null;
  /** Session title from loaded session */
  sessionTitle: string | null;
  /** Update session ID and URL */
  setSessionId: (id: string, options?: { replace?: boolean }) => void;
  /** Create a new empty session */
  createNewSession: () => void;
  /** Load a session's messages from the API */
  loadSession: (id: string) => Promise<void>;
  /** Error message if session load failed */
  error: string | null;
}

/**
 * Read session ID from URL query parameter
 */
function getSessionIdFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

/**
 * Update URL with session ID using History API
 */
function updateUrlWithSession(sessionId: string | null, replace = false): void {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);

  if (sessionId) {
    url.searchParams.set('id', sessionId);
  } else {
    url.searchParams.delete('id');
  }

  // Remove any hash-based session ID (legacy cleanup)
  url.hash = '';

  if (replace) {
    window.history.replaceState({ sessionId }, '', url.toString());
  } else {
    window.history.pushState({ sessionId }, '', url.toString());
  }
}

export function useChatSession(): UseChatSessionResult {
  // Session state
  const [sessionId, setSessionIdState] = useState<string | null>(() => getSessionIdFromUrl());
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [sessionMessages, setSessionMessages] = useState<UIMessage[] | null>(null);
  const [sessionTitle, setSessionTitle] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Track if initial load has happened
  const initialLoadDone = useRef(false);
  // Track current load to handle race conditions
  const currentLoadId = useRef<string | null>(null);

  /**
   * Load session messages from API
   */
  const loadSession = useCallback(async (id: string) => {
    // Set current load ID to handle race conditions
    currentLoadId.current = id;
    setIsLoadingSession(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/history/${id}`);

      // Check if this load is still current (not superseded by another)
      if (currentLoadId.current !== id) {
        return;
      }

      if (response.status === 404) {
        setError('Session not found');
        setSessionMessages(null);
        setSessionTitle(null);
        // Clear URL and create new session
        updateUrlWithSession(null, true);
        setSessionIdState(null);
        return;
      }

      if (response.status === 403) {
        setError('You do not have access to this session');
        setSessionMessages(null);
        setSessionTitle(null);
        updateUrlWithSession(null, true);
        setSessionIdState(null);
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to load session');
      }

      const data = (await response.json()) as SessionData;

      // Check again for race condition after async operation
      if (currentLoadId.current !== id) {
        return;
      }

      const uiMessages = convertToUIMessages(data.messages);
      setSessionMessages(uiMessages);
      setSessionTitle(data.title);
      setSessionIdState(id);
    } catch (err) {
      if (currentLoadId.current !== id) {
        return;
      }
      console.error('[useChatSession] Error loading session:', err);
      setError('Failed to load session');
      setSessionMessages(null);
      setSessionTitle(null);
    } finally {
      if (currentLoadId.current === id) {
        setIsLoadingSession(false);
      }
    }
  }, []);

  /**
   * Set session ID and update URL
   */
  const setSessionId = useCallback(
    (id: string, options?: { replace?: boolean }) => {
      setSessionIdState(id);
      updateUrlWithSession(id, options?.replace);
      // Load the session messages
      void loadSession(id);
    },
    [loadSession]
  );

  /**
   * Create a new empty session
   */
  const createNewSession = useCallback(() => {
    currentLoadId.current = null; // Cancel any pending loads
    setSessionIdState(null);
    setSessionMessages(null);
    setSessionTitle(null);
    setError(null);
    setIsLoadingSession(false);
    updateUrlWithSession(null);
  }, []);

  /**
   * Handle browser back/forward navigation
   */
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const id = getSessionIdFromUrl();
      setSessionIdState(id);

      if (id) {
        void loadSession(id);
      } else {
        // Going back to new chat state
        currentLoadId.current = null;
        setSessionMessages(null);
        setSessionTitle(null);
        setError(null);
        setIsLoadingSession(false);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [loadSession]);

  /**
   * Load session on mount if ID is in URL
   */
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    const id = getSessionIdFromUrl();
    if (id) {
      void loadSession(id);
    }
  }, [loadSession]);

  // Determine if this is a new session
  const isNewSession = sessionId === null || (sessionMessages === null && !isLoadingSession);

  return {
    sessionId,
    isNewSession,
    isLoadingSession,
    sessionMessages,
    sessionTitle,
    setSessionId,
    createNewSession,
    loadSession,
    error,
  };
}
