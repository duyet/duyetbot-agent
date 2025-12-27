"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  ClockIcon,
  RefreshCwIcon,
  Trash2Icon,
  FileIcon as FileText,
} from "./icons";
import { getSessionHistory, clearAllSessions } from "@/lib/session-persistence";
import type { SessionHistoryEntry } from "@/lib/session-persistence";

/**
 * Session restore dialog options
 */
export interface SessionRestoreOptions {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestore?: (chatId: string) => void;
}

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

/**
 * Format time string
 */
function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Session restore dialog component
 *
 * Features:
 * - List of recently closed sessions
 * - Restore session with confirmation
 * - Clear all sessions option
 * - Session preview with metadata
 */
export function SessionRestoreDialog({
  open,
  onOpenChange,
  onRestore,
}: SessionRestoreOptions) {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionHistoryEntry[]>([]);
  const [selectedSession, setSelectedSession] = useState<SessionHistoryEntry | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // Load sessions when dialog opens
  useEffect(() => {
    if (open) {
      loadSessions();
    }
  }, [open]);

  const loadSessions = useCallback(() => {
    const history = getSessionHistory();
    // Sort by timestamp (newest first)
    setSessions(history.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    ));
  }, []);

  const handleRestore = useCallback((session: SessionHistoryEntry) => {
    if (onRestore) {
      onRestore(session.chatId);
    } else {
      // Default behavior: navigate to chat
      router.push(`/chat/${session.chatId}`);
    }
    onOpenChange(false);
  }, [onRestore, router, onOpenChange]);

  const handleClearAll = useCallback(() => {
    clearAllSessions();
    setSessions([]);
    setShowConfirm(false);
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Restore Previous Session</DialogTitle>
          <DialogDescription>
            Select a session to restore. Sessions are automatically saved as you chat.
          </DialogDescription>
        </DialogHeader>

        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-muted-foreground/50 mb-4">
              <FileText size={48} />
            </div>
            <p className="text-muted-foreground">No previous sessions found</p>
            <p className="text-sm text-muted-foreground mt-2">
              Sessions are saved automatically as you chat
            </p>
          </div>
        ) : (
          <>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-2">
                {sessions.map((session) => (
                  <SessionItem
                    key={session.chatId}
                    session={session}
                    onRestore={handleRestore}
                    onDelete={() => {
                      setSelectedSession(session);
                      setShowConfirm(true);
                    }}
                  />
                ))}
              </div>
            </ScrollArea>

            <DialogFooter className="flex justify-between">
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => setShowConfirm(true)}
              >
                <Trash2Icon size={14} className="mr-2" />
                Clear All
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Clear all confirmation */}
        <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Clear All Sessions?</DialogTitle>
              <DialogDescription>
                This will permanently delete all saved session history. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowConfirm(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleClearAll}
              >
                Clear All
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Session list item component
 */
interface SessionItemProps {
  session: SessionHistoryEntry;
  onRestore: (session: SessionHistoryEntry) => void;
  onDelete: () => void;
}

function SessionItem({ session, onRestore, onDelete }: SessionItemProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  }, [onDelete]);

  return (
    <button
      className={cn(
        "w-full flex items-start gap-3 p-3 rounded-lg border",
        "hover:bg-accent transition-colors text-left",
        "group"
      )}
      onClick={() => onRestore(session)}
    >
      <div className="flex-shrink-0 mt-1">
        <FileText size={16} className="text-muted-foreground" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium truncate">{session.title}</p>
          {session.tags && session.tags.length > 0 && (
            <div className="flex gap-1">
              {session.tags.slice(0, 2).map((tag) => (
                <span
                  key={tag}
                  className="px-1.5 py-0.5 text-xs bg-muted rounded"
                >
                  {tag}
                </span>
              ))}
              {session.tags.length > 2 && (
                <span className="px-1.5 py-0.5 text-xs bg-muted rounded">
                  +{session.tags.length - 2}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <ClockIcon size={12} />
            {formatTimestamp(session.timestamp)}
          </span>
          <span>•</span>
          <span>{session.messageCount} messages</span>
          <span className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
            {formatTime(session.timestamp)}
          </span>
        </div>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "flex-shrink-0 h-8 w-8 opacity-0 group-hover:opacity-100",
          "hover:bg-destructive/10 hover:text-destructive",
          "transition-all"
        )}
        onClick={handleDeleteClick}
      >
        <Trash2Icon size={14} />
      </Button>
    </button>
  );
}

/**
 * Hook to show session restore dialog
 */
export function useSessionRestore() {
  const [isOpen, setIsOpen] = useState(false);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    props: {
      open: isOpen,
      onOpenChange: setIsOpen,
    },
  };
}

/**
 * Session restore button component
 */
export function SessionRestoreButton() {
  const { props } = useSessionRestore();

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => props.onOpenChange(true)}
        title="Restore session"
      >
        <RefreshCwIcon size={18} />
      </Button>
      <SessionRestoreDialog {...props} />
    </>
  );
}
