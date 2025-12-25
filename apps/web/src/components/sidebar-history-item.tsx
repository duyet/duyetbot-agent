'use client';

import { CheckCircle, Globe, Lock, MessageSquare, MoreHorizontal, Trash2 } from 'lucide-react';
import { memo, useCallback, useState } from 'react';
import { useChatVisibility } from '@/hooks/use-chat-visibility';
import { cn } from '@/lib/utils';
import type { Session } from '@/types';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

// Extended Session type with visibility
export interface ChatWithVisibility extends Session {
  visibility?: 'private' | 'public';
}

export interface ChatItemProps {
  chat: ChatWithVisibility;
  isActive: boolean;
  onDelete: (chatId: string) => void;
  onClick: (chatId: string) => void;
  setOpenMobile: (open: boolean) => void;
}

const PureSidebarHistoryItem = ({
  chat,
  isActive,
  onDelete,
  onClick,
  setOpenMobile,
}: ChatItemProps) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { visibilityType, setVisibilityType } = useChatVisibility({
    chatId: chat.sessionId,
    initialVisibilityType: chat.visibility || 'private',
  });

  const handleClick = useCallback(() => {
    onClick(chat.sessionId);
    setOpenMobile(false);
  }, [chat.sessionId, onClick, setOpenMobile]);

  const handleConfirmDelete = useCallback(() => {
    onDelete(chat.sessionId);
    setDeleteDialogOpen(false);
  }, [chat.sessionId, onDelete]);

  const handleCancelDelete = useCallback(() => {
    setDeleteDialogOpen(false);
  }, []);

  const title = chat.title || 'Untitled Chat';

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          'group relative w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 text-left',
          'hover:bg-muted/50',
          isActive ? 'bg-accent/10 text-accent shadow-sm' : 'hover:shadow-sm'
        )}
        title={title}
      >
        {/* Icon */}
        <div
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg transition-colors shrink-0',
            isActive
              ? 'bg-accent text-accent-foreground'
              : 'bg-muted/50 group-hover:bg-accent group-hover:text-accent-foreground'
          )}
        >
          <MessageSquare className="h-4 w-4" />
        </div>

        {/* Title and message count */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p
              className={cn(
                'text-sm font-medium truncate',
                isActive ? 'text-accent' : 'text-foreground'
              )}
            >
              {title}
            </p>
            <span
              className={cn(
                'text-xs font-mono shrink-0',
                isActive ? 'text-accent/70' : 'text-muted-foreground'
              )}
            >
              {chat.messageCount}
            </span>
          </div>
        </div>

        {/* Dropdown menu - show on hover */}
        <span
          className={cn(
            'opacity-0 group-hover:opacity-100 transition-opacity shrink-0',
            isActive && 'opacity-100'
          )}
        >
          <DropdownMenu modal={true}>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="h-7 w-7 hover:bg-accent/20"
                title="More options"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" side="bottom" className="w-48">
              {/* Share submenu with visibility options */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="cursor-pointer">
                  <Globe className="h-4 w-4" />
                  <span>Share</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem
                      className="cursor-pointer flex justify-between gap-2"
                      onClick={() => setVisibilityType('private')}
                    >
                      <div className="flex items-center gap-2">
                        <Lock className="h-3.5 w-3.5" />
                        <span>Private</span>
                      </div>
                      {visibilityType === 'private' && (
                        <CheckCircle className="h-4 w-4 text-foreground" />
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer flex justify-between gap-2"
                      onClick={() => setVisibilityType('public')}
                    >
                      <div className="flex items-center gap-2">
                        <Globe className="h-3.5 w-3.5" />
                        <span>Public</span>
                      </div>
                      {visibilityType === 'public' && (
                        <CheckCircle className="h-4 w-4 text-foreground" />
                      )}
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>

              {/* Delete action */}
              <DropdownMenuItem
                className="cursor-pointer text-destructive focus:bg-destructive/15 focus:text-destructive"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDeleteDialogOpen(true);
                }}
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      </button>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Delete Chat</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{title}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleCancelDelete}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

// Memoized component with comparison function
export const SidebarHistoryItem = memo(PureSidebarHistoryItem, (prevProps, nextProps) => {
  // Only re-render if these specific props change
  return (
    prevProps.chat.sessionId === nextProps.chat.sessionId &&
    prevProps.chat.title === nextProps.chat.title &&
    prevProps.chat.messageCount === nextProps.chat.messageCount &&
    prevProps.chat.updatedAt === nextProps.chat.updatedAt &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.chat.visibility === nextProps.chat.visibility
  );
});

SidebarHistoryItem.displayName = 'SidebarHistoryItem';
