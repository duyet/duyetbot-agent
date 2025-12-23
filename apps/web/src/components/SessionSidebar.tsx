/**
 * SessionSidebar Component
 *
 * Displays a list of chat sessions with active session highlighting.
 * Provides session management: create new, delete, and switch sessions.
 */

import type { Session } from '@duyetbot/types';
import { Clock, MessageSquare, Plus, Trash2 } from 'lucide-react';
import { useCallback, useState } from 'react';

/**
 * Session item display format
 */
interface SessionItem extends Session {
  /** First message preview */
  preview?: string;
}

/**
 * Props for SessionSidebar component
 */
interface SessionSidebarProps {
  /** Available sessions */
  sessions: SessionItem[];
  /** Currently active session ID */
  activeSessionId: string | null;
  /** Callback when session is selected */
  onSelectSession: (sessionId: string) => void;
  /** Callback when creating new session */
  onCreateSession: () => void;
  /** Callback when deleting a session */
  onDeleteSession: (sessionId: string) => void;
  /** Whether a session is being loaded */
  isLoading?: boolean;
  /** Optional CSS class name */
  className?: string;
}

/**
 * Format timestamp to relative time
 */
function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) {
    return 'Just now';
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return `${days}d ago`;
}

/**
 * Truncate text to specified length
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}...`;
}

/**
 * Session sidebar with list, active highlighting, and actions.
 *
 * @example
 * ```tsx
 * <SessionSidebar
 *   sessions={sessions}
 *   activeSessionId={currentSessionId}
 *   onSelectSession={handleSelectSession}
 *   onCreateSession={handleCreateSession}
 *   onDeleteSession={handleDeleteSession}
 * />
 * ```
 */
export function SessionSidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  isLoading = false,
  className = '',
}: SessionSidebarProps) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  /**
   * Handle session click
   */
  const handleSessionClick = useCallback(
    (sessionId: string) => {
      if (confirmDelete === sessionId) {
        return;
      }
      onSelectSession(sessionId);
    },
    [onSelectSession, confirmDelete]
  );

  /**
   * Handle delete button click (with confirmation)
   */
  const handleDeleteClick = useCallback(
    (e: React.MouseEvent, sessionId: string) => {
      e.stopPropagation();

      if (confirmDelete === sessionId) {
        onDeleteSession(sessionId);
        setConfirmDelete(null);
      } else {
        setConfirmDelete(sessionId);
        setTimeout(() => setConfirmDelete(null), 3000);
      }
    },
    [confirmDelete, onDeleteSession]
  );

  return (
    <aside
      className={`flex flex-col h-full bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 ${className}`}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Sessions</h2>
          <button
            type="button"
            onClick={onCreateSession}
            disabled={isLoading}
            className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Create new session"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            Loading sessions...
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            <MessageSquare className="mx-auto mb-2 opacity-50" size={32} />
            <p className="text-sm">No sessions yet</p>
            <p className="text-xs mt-1">Create a new session to start chatting</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-800">
            {sessions.map((session) => {
              const isActive = session.id === activeSessionId;
              const isDeleting = confirmDelete === session.id;

              return (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => handleSessionClick(session.id)}
                  className={`
                    relative p-4 cursor-pointer transition-colors w-full text-left
                    ${
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-600'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800 border-l-4 border-transparent'
                    }
                  `}
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Session info */}
                    <div className="flex-1 min-w-0">
                      <h3
                        className={`
                          font-medium text-sm truncate
                          ${
                            isActive
                              ? 'text-blue-900 dark:text-blue-100'
                              : 'text-gray-900 dark:text-gray-100'
                          }
                        `}
                      >
                        {session.metadata?.title || 'Untitled Session'}
                      </h3>

                      {session.preview && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                          {truncate(session.preview, 50)}
                        </p>
                      )}

                      <div className="flex items-center gap-2 mt-2">
                        <Clock size={12} className="text-gray-400" />
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatRelativeTime(session.updatedAt)}
                        </span>
                        <span
                          className={`
                            text-xs px-2 py-0.5 rounded-full
                            ${
                              session.state === 'active'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : session.state === 'paused'
                                  ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                            }
                          `}
                        >
                          {session.state}
                        </span>
                      </div>
                    </div>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={(e) => handleDeleteClick(e, session.id)}
                      className={`
                        p-1.5 rounded-lg transition-colors flex-shrink-0
                        ${
                          isDeleting
                            ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                            : 'opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-red-600'
                        }
                      `}
                      aria-label={isDeleting ? 'Confirm delete' : 'Delete session'}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400">
        {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}
      </div>
    </aside>
  );
}
