'use client';

import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  LogOut,
  MessageSquare,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import type { SessionItem, SessionUser } from '@/lib/session';
import { SidebarHistory } from './sidebar-history';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Separator } from './ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet';

const STORAGE_KEY = 'duyetbot-sidebar-open';

interface AppSidebarProps {
  user: SessionUser;
  sessions: SessionItem[];
  currentSessionId: string;
  onNewChat: () => void;
  onSessionSelect: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onDeleteAllSessions: () => void;
  onLogout: () => void;
}

export function useSidebar() {
  const [isOpen, setIsOpen] = useState(() => {
    // Default to open during SSR
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved !== 'false';
  });

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      const newValue = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, String(newValue));
      }
      return newValue;
    });
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, 'true');
    }
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, 'false');
    }
  }, []);

  return { isOpen, toggle, open, close };
}

export function AppSidebar({
  user,
  sessions,
  currentSessionId,
  onNewChat,
  onSessionSelect,
  onDeleteSession,
  onDeleteAllSessions,
  onLogout,
}: AppSidebarProps) {
  const { isOpen, toggle } = useSidebar();
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleDeleteAll = useCallback(() => {
    onDeleteAllSessions();
    setDeleteAllOpen(false);
  }, [onDeleteAllSessions]);

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent/80 shadow-lg shadow-accent/20">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <h2 className="text-sm font-semibold tracking-tight">duyetbot</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={onNewChat} className="hidden sm:flex">
          <Plus className="h-4 w-4 mr-2" />
          New
        </Button>
      </div>

      {/* Mobile New Chat Button */}
      <div className="sm:hidden p-3">
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start"
          onClick={onNewChat}
        >
          <Plus className="h-4 w-4 mr-2" />
          New Conversation
        </Button>
      </div>

      <Separator />

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto p-3">
        <SidebarHistory
          activeChatId={currentSessionId}
          onSelectChat={onSessionSelect}
          onDeleteChat={onDeleteSession}
        />
      </div>

      <Separator />

      {/* Footer - Delete All & User Profile */}
      <div className="p-3 space-y-2">
        {/* Delete All Button */}
        {sessions.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setDeleteAllOpen(true)}
            className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete All Chats
          </Button>
        )}

        {/* User Profile */}
        <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/30 transition-colors">
          {user.avatarUrl ? (
            <div
              style={{ backgroundImage: `url(${user.avatarUrl})` }}
              className="h-9 w-9 rounded-full bg-cover bg-center ring-2 ring-border/50 flex-shrink-0"
              role="img"
              aria-label={user.login}
            />
          ) : (
            <div className="h-9 w-9 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
              <MessageSquare className="h-4 w-4 text-accent" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user.name ?? user.login}</p>
            {user.email && <p className="text-xs text-muted-foreground truncate">{user.email}</p>}
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onLogout} title="Log out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  // Mobile: Use Sheet component
  if (isMobile) {
    return (
      <>
        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggle}
          className="lg:hidden"
          aria-label="Open menu"
        >
          {isOpen ? <X className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
        </Button>

        <Sheet open={isOpen} onOpenChange={toggle}>
          <SheetContent side="left" className="w-80 p-0">
            <SheetHeader className="px-4 pt-4">
              <SheetTitle className="sr-only">Menu</SheetTitle>
            </SheetHeader>
            {sidebarContent}
          </SheetContent>
        </Sheet>

        {/* Delete All Confirmation Dialog */}
        <Dialog open={deleteAllOpen} onOpenChange={setDeleteAllOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Delete All Chats
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to delete all {sessions.length} conversations? This action
                cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDeleteAllOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteAll}>
                Delete All
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Desktop: Use collapsible sidebar
  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 transition-all duration-300 ease-in-out
          lg:relative lg:z-auto
          ${isOpen ? 'w-72 translate-x-0' : 'w-16 -translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="flex h-full flex-col border-r border-border bg-card">
          {isOpen ? (
            sidebarContent
          ) : (
            <div className="flex h-full flex-col items-center py-4 gap-2">
              <button
                type="button"
                onClick={onNewChat}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent/80 shadow-lg shadow-accent/20 hover:shadow-accent/30 transition-shadow"
                title="New conversation"
              >
                <Plus className="h-4 w-4 text-white" />
              </button>

              <div className="flex-1" />

              {/* Collapsed User Profile */}
              <div className="flex flex-col gap-1">
                {user.avatarUrl ? (
                  <div
                    style={{ backgroundImage: `url(${user.avatarUrl})` }}
                    className="h-9 w-9 rounded-full bg-cover bg-center ring-2 ring-border/50"
                    role="img"
                    aria-label={user.login}
                  />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-accent/10 flex items-center justify-center">
                    <MessageSquare className="h-4 w-4 text-accent" />
                  </div>
                )}
                <Button variant="ghost" size="icon-sm" onClick={onLogout} title="Log out">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Sidebar Toggle Button (Header) */}
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={toggle}
        className="hidden lg:flex"
        title={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        {isOpen ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
      </Button>

      {/* Delete All Confirmation Dialog */}
      <Dialog open={deleteAllOpen} onOpenChange={setDeleteAllOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete All Chats
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete all {sessions.length} conversations? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteAllOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteAll}>
              Delete All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
