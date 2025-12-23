'use client';

import { MessageSquare, Plus, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface SessionItem {
  sessionId: string;
  chatId: string;
  title?: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

interface SessionSidebarProps {
  userId: string;
  currentSessionId: string;
  onSessionSelect: (sessionId: string) => void;
  onNewSession: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export function SessionSidebar({
  userId,
  currentSessionId,
  onSessionSelect,
  onNewSession,
  isOpen,
  onClose,
}: SessionSidebarProps) {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/sessions?userId=${userId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch sessions');
      }
      const data = await response.json();
      setSessions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void fetchSessions();
  }, [fetchSessions]);

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      try {
        const response = await fetch(`/api/sessions/${sessionId}?userId=${userId}`, {
          method: 'DELETE',
        });
        if (!response.ok) {
          throw new Error('Failed to delete session');
        }
        await fetchSessions();
        if (sessionId === currentSessionId) {
          onNewSession();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete session');
      }
    },
    [userId, currentSessionId, onNewSession, fetchSessions]
  );

  const handleDeleteClick = useCallback(
    (e: React.MouseEvent, sessionId: string) => {
      e.stopPropagation();
      if (confirmDelete === sessionId) {
        void handleDeleteSession(sessionId);
        setConfirmDelete(null);
      } else {
        setConfirmDelete(sessionId);
        setTimeout(() => setConfirmDelete(null), 3000);
      }
    },
    [confirmDelete, handleDeleteSession]
  );

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    }
    if (diffDays === 1) {
      return 'Yesterday';
    }
    if (diffDays < 7) {
      return `${diffDays} days ago`;
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      action();
    }
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Session sidebar"
        className={`
          fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-gray-900
          border-r border-gray-200 dark:border-gray-800
          transform transition-transform duration-200 ease-in-out
          md:relative md:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 p-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Conversations
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onNewSession}
                className="rounded-lg bg-blue-600 p-2 text-white hover:bg-blue-700 transition-colors"
                aria-label="New conversation"
              >
                <Plus size={18} />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 md:hidden transition-colors"
                aria-label="Close sidebar"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-gray-500 dark:text-gray-400">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600 dark:border-gray-700 dark:border-t-blue-400" />
                <p className="mt-4 text-sm">Loading conversations...</p>
              </div>
            ) : error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center text-red-600 dark:border-red-800 dark:bg-red-900/20">
                <p className="text-sm">{error}</p>
                <button
                  type="button"
                  onClick={() => {
                    void fetchSessions();
                  }}
                  className="mt-2 text-sm font-medium underline hover:no-underline"
                >
                  Retry
                </button>
              </div>
            ) : sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-gray-500 dark:text-gray-400">
                <MessageSquare size={48} className="mb-4 opacity-50" />
                <p className="text-sm font-medium">No conversations yet</p>
                <p className="mt-1 text-xs">Start a new conversation to get started</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sessions.map((session) => {
                  const isActive = session.chatId === currentSessionId;
                  const isDeleting = confirmDelete === session.chatId;

                  return (
                    <button
                      key={session.chatId}
                      type="button"
                      onClick={() => {
                        if (!isDeleting) {
                          onSessionSelect(session.chatId);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (!isDeleting) {
                          handleKeyDown(e, () => onSessionSelect(session.chatId));
                        }
                      }}
                      disabled={isDeleting}
                      className={`
                        group relative rounded-lg border p-3 cursor-pointer transition-all w-full text-left
                        ${
                          isActive
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400'
                            : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900/50 dark:hover:border-gray-700'
                        }
                        ${isDeleting ? 'cursor-not-allowed opacity-70' : ''}
                      }
                      `}
                      aria-label={`Select conversation ${session.title || formatDate(session.createdAt)}`}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3
                            className={`
                              text-sm font-medium truncate
                              ${
                                isActive
                                  ? 'text-blue-900 dark:text-blue-100'
                                  : 'text-gray-900 dark:text-gray-100'
                              }
                            `}
                          >
                            {session.title || formatDate(session.createdAt)}
                          </h3>
                          <div className="mt-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                            <span>{session.messageCount} messages</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => handleDeleteClick(e, session.chatId)}
                          className={`
                            rounded-lg p-1.5 transition-colors flex-shrink-0
                            ${
                              isDeleting
                                ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                                : 'opacity-0 group-hover:opacity-100 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-red-600'
                            }
                          `}
                          aria-label={isDeleting ? 'Confirm delete' : 'Delete conversation'}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {isDeleting && (
                        <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                          Click again to confirm delete
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 dark:border-gray-800 p-4">
            <p className="text-xs text-center text-gray-500 dark:text-gray-400">
              {sessions.length} {sessions.length === 1 ? 'conversation' : 'conversations'}
            </p>
          </div>
        </div>
      </div>

      {isOpen && (
        <button
          type="button"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          aria-label="Close sidebar"
        />
      )}
    </>
  );
}
