'use client';

import { isToday, isYesterday, subMonths, subWeeks } from 'date-fns';
import { motion } from 'framer-motion';
import { useCallback } from 'react';
import { toast } from 'sonner';
import useSWRInfinite from 'swr/infinite';
import type { Session } from '@/types';
import { SidebarHistoryItem } from './sidebar-history-item';

type GroupedChats = {
  today: Chat[];
  yesterday: Chat[];
  lastWeek: Chat[];
  lastMonth: Chat[];
  older: Chat[];
};

// Chat type extends Session with visibility
export interface Chat extends Session {
  visibility?: 'private' | 'public';
}

export interface ChatHistory {
  chats: Chat[];
  hasMore: boolean;
}

const PAGE_SIZE = 20;

// Fetcher function for SWR
const fetcher = async (url: string): Promise<ChatHistory> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch history: ${response.statusText}`);
  }
  return response.json();
};

// Date grouping logic
const groupChatsByDate = (chats: Chat[]): GroupedChats => {
  const now = new Date();
  const oneWeekAgo = subWeeks(now, 1);
  const oneMonthAgo = subMonths(now, 1);

  return chats.reduce(
    (groups, chat) => {
      const chatDate = new Date(chat.updatedAt);

      if (isToday(chatDate)) {
        groups.today.push(chat);
      } else if (isYesterday(chatDate)) {
        groups.yesterday.push(chat);
      } else if (chatDate > oneWeekAgo) {
        groups.lastWeek.push(chat);
      } else if (chatDate > oneMonthAgo) {
        groups.lastMonth.push(chat);
      } else {
        groups.older.push(chat);
      }

      return groups;
    },
    {
      today: [],
      yesterday: [],
      lastWeek: [],
      lastMonth: [],
      older: [],
    } as GroupedChats
  );
};

// Key function for SWR infinite
export function getChatHistoryPaginationKey(
  pageIndex: number,
  previousPageData: ChatHistory | null
) {
  if (previousPageData && previousPageData.hasMore === false) {
    return null;
  }

  if (pageIndex === 0) {
    return `/api/v1/history?limit=${PAGE_SIZE}`;
  }

  const lastChatFromPage = previousPageData?.chats.at(-1);

  if (!lastChatFromPage) {
    return null;
  }

  return `/api/v1/history?starting_after=${lastChatFromPage.sessionId}&limit=${PAGE_SIZE}`;
}

// Loading skeleton
function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-3">
      {[44, 32, 28, 64, 52].map((item, index) => (
        <div className="flex h-12 items-center gap-2 rounded-xl px-3" key={index}>
          <div
            className="h-4 flex-1 rounded-md bg-muted/50 animate-pulse"
            style={{ maxWidth: `${item}%` }}
          />
        </div>
      ))}
    </div>
  );
}

// Empty state
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center px-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/50 mb-3">
        <svg
          className="h-6 w-6 text-muted-foreground"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <title>Empty chat history</title>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>
      <p className="text-sm text-muted-foreground">No conversations yet</p>
      <p className="text-xs text-muted-foreground mt-1">Start chatting to see your history here</p>
    </div>
  );
}

// Loading indicator
function LoadingIndicator() {
  return (
    <div className="flex flex-row items-center justify-center gap-2 p-4 text-muted-foreground">
      <div className="flex items-center gap-1">
        <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:-0ms]" />
        <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:-150ms]" />
        <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:-300ms]" />
      </div>
    </div>
  );
}

// Props
export interface SidebarHistoryProps {
  activeChatId?: string;
  onSelectChat: (chatId: string) => void;
  onDeleteChat?: (chatId: string) => void;
}

export function SidebarHistory({ activeChatId, onSelectChat, onDeleteChat }: SidebarHistoryProps) {
  const {
    data: paginatedChatHistories,
    setSize,
    isValidating,
    isLoading,
    mutate,
  } = useSWRInfinite<ChatHistory>(getChatHistoryPaginationKey, fetcher, {
    fallbackData: [],
    revalidateFirstPage: false,
    revalidateOnFocus: false,
  });

  const hasReachedEnd = paginatedChatHistories
    ? paginatedChatHistories.some((page) => page.hasMore === false)
    : false;

  const hasEmptyChatHistory = paginatedChatHistories
    ? paginatedChatHistories.every((page) => page.chats.length === 0)
    : false;

  const handleDelete = useCallback(
    (chatId: string) => {
      const chatToDelete = chatId;

      const deletePromise = fetch(`/api/v1/history/${chatToDelete}`, {
        method: 'DELETE',
      });

      toast.promise(deletePromise, {
        loading: 'Deleting chat...',
        success: () => {
          mutate((chatHistories) => {
            if (chatHistories) {
              return chatHistories.map((chatHistory) => ({
                ...chatHistory,
                chats: chatHistory.chats.filter((chat) => chat.sessionId !== chatToDelete),
              }));
            }
          });

          // Call the delete callback if provided
          if (onDeleteChat) {
            onDeleteChat(chatToDelete);
          }

          return 'Chat deleted successfully';
        },
        error: 'Failed to delete chat',
      });
    },
    [mutate, onDeleteChat]
  );

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (hasEmptyChatHistory) {
    return <EmptyState />;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-6">
        {paginatedChatHistories &&
          (() => {
            const chatsFromHistory = paginatedChatHistories.flatMap(
              (paginatedChatHistory) => paginatedChatHistory.chats
            );

            const groupedChats = groupChatsByDate(chatsFromHistory);

            return (
              <>
                {groupedChats.today.length > 0 && (
                  <div>
                    <div className="px-3 pb-1 pt-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Today
                    </div>
                    <div className="space-y-0.5">
                      {groupedChats.today.map((chat) => (
                        <SidebarHistoryItem
                          key={chat.sessionId}
                          chat={chat}
                          isActive={chat.sessionId === activeChatId}
                          onDelete={handleDelete}
                          onClick={onSelectChat}
                          setOpenMobile={() => {
                            /* noop */
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {groupedChats.yesterday.length > 0 && (
                  <div>
                    <div className="px-3 pb-1 pt-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Yesterday
                    </div>
                    <div className="space-y-0.5">
                      {groupedChats.yesterday.map((chat) => (
                        <SidebarHistoryItem
                          key={chat.sessionId}
                          chat={chat}
                          isActive={chat.sessionId === activeChatId}
                          onDelete={handleDelete}
                          onClick={onSelectChat}
                          setOpenMobile={() => {
                            /* noop */
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {groupedChats.lastWeek.length > 0 && (
                  <div>
                    <div className="px-3 pb-1 pt-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Last 7 days
                    </div>
                    <div className="space-y-0.5">
                      {groupedChats.lastWeek.map((chat) => (
                        <SidebarHistoryItem
                          key={chat.sessionId}
                          chat={chat}
                          isActive={chat.sessionId === activeChatId}
                          onDelete={handleDelete}
                          onClick={onSelectChat}
                          setOpenMobile={() => {
                            /* noop */
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {groupedChats.lastMonth.length > 0 && (
                  <div>
                    <div className="px-3 pb-1 pt-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Last 30 days
                    </div>
                    <div className="space-y-0.5">
                      {groupedChats.lastMonth.map((chat) => (
                        <SidebarHistoryItem
                          key={chat.sessionId}
                          chat={chat}
                          isActive={chat.sessionId === activeChatId}
                          onDelete={handleDelete}
                          onClick={onSelectChat}
                          setOpenMobile={() => {
                            /* noop */
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {groupedChats.older.length > 0 && (
                  <div>
                    <div className="px-3 pb-1 pt-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Older
                    </div>
                    <div className="space-y-0.5">
                      {groupedChats.older.map((chat) => (
                        <SidebarHistoryItem
                          key={chat.sessionId}
                          chat={chat}
                          isActive={chat.sessionId === activeChatId}
                          onDelete={handleDelete}
                          onClick={onSelectChat}
                          setOpenMobile={() => {
                            /* noop */
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            );
          })()}

        <motion.div
          onViewportEnter={() => {
            if (!isValidating && !hasReachedEnd) {
              setSize((size) => size + 1);
            }
          }}
        />

        {hasReachedEnd ? (
          <div className="flex w-full flex-row items-center justify-center gap-2 px-4 py-6 text-sm text-muted-foreground">
            You have reached the end of your chat history.
          </div>
        ) : (
          <LoadingIndicator />
        )}
      </div>
    </div>
  );
}
