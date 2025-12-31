'use client';

import type { AnalyticsMessage } from '@duyetbot/analytics';
import {
  Calendar,
  ChevronDown,
  Download,
  Filter,
  MessageSquare,
  RefreshCw,
  Search,
  X,
  Zap,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useRecentMessages } from '@/lib/hooks/use-dashboard-data';
import {
  createMessagePairs,
  formatFullTimestamp,
  formatTimestamp,
  MessagePairHeader,
  MessagePairRow,
} from './message-pair-row';
import { VirtualizedMessagesContent } from './virtualized-messages-content';

// Threshold for switching to virtual scrolling
const VIRTUAL_SCROLL_THRESHOLD = 10; // groups
const VIRTUAL_MESSAGE_THRESHOLD = 100; // total messages

type Role = 'all' | 'user' | 'assistant' | 'system' | 'tool';
type Platform = 'all' | 'telegram' | 'github' | 'cli' | 'api';
type Visibility = 'all' | 'private' | 'public' | 'unlisted';

interface Filters {
  role: Role;
  platform: Platform;
  visibility: Visibility;
  search: string;
}

interface ConversationGroup {
  id: string;
  messages: AnalyticsMessage[];
  platform: string;
  username?: string;
  firstMessageAt: number;
  lastMessageAt: number;
}

function MessageItemSkeleton() {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-border/50 bg-secondary/20 p-4">
      <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-14" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="h-4 w-full max-w-lg" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-32" />
      </div>
      <Skeleton className="h-5 w-16 shrink-0" />
    </div>
  );
}

function FilterDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all duration-200 ${
          value !== 'all'
            ? 'border-primary/50 bg-primary/10 text-primary'
            : 'border-border bg-secondary/50 text-muted-foreground hover:bg-secondary'
        }`}
      >
        <span className="text-xs font-medium uppercase tracking-wider opacity-60">{label}</span>
        <span className="font-medium capitalize">{value === 'all' ? 'All' : value}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close dropdown"
            className="fixed inset-0 z-40 cursor-default bg-transparent"
            onClick={() => setOpen(false)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setOpen(false);
              }
            }}
          />
          <div className="absolute left-0 top-full z-50 mt-1 min-w-[140px] rounded-lg border border-border bg-popover p-1 shadow-lg animate-scale-in">
            {options.map((option) => (
              <button
                type="button"
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center rounded-md px-3 py-2 text-sm transition-colors ${
                  value === option.value
                    ? 'bg-primary/10 text-primary'
                    : 'text-foreground hover:bg-secondary'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function MessagesContent() {
  const { data: messages, isLoading, refetch } = useRecentMessages(200);
  const [filters, setFilters] = useState<Filters>({
    role: 'all',
    platform: 'all',
    visibility: 'all',
    search: '',
  });
  const [expandedMessage, setExpandedMessage] = useState<string | null>(null);
  const [allExpanded, setAllExpanded] = useState(false);

  // Toggle expand/collapse all messages
  const toggleExpandAll = useCallback(() => {
    setAllExpanded((prev) => !prev);
    setExpandedMessage(null); // Reset individual expansion when toggling all
  }, []);

  const updateFilter = useCallback(<K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      role: 'all',
      platform: 'all',
      visibility: 'all',
      search: '',
    });
  }, []);

  const hasActiveFilters =
    filters.role !== 'all' ||
    filters.platform !== 'all' ||
    filters.visibility !== 'all' ||
    filters.search !== '';

  // Filter messages client-side
  const filteredMessages = messages?.filter((msg) => {
    if (filters.role !== 'all' && msg.role !== filters.role) {
      return false;
    }
    if (filters.platform !== 'all' && msg.platform !== filters.platform) {
      return false;
    }
    if (filters.visibility !== 'all' && msg.visibility !== filters.visibility) {
      return false;
    }
    if (
      filters.search &&
      !msg.content?.toLowerCase().includes(filters.search.toLowerCase()) &&
      !msg.username?.toLowerCase().includes(filters.search.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  // Group messages by conversation (sessionId or conversationId)
  const groupedMessages = useMemo((): ConversationGroup[] => {
    if (!filteredMessages || filteredMessages.length === 0) {
      return [];
    }

    const groups = new Map<string, AnalyticsMessage[]>();

    for (const msg of filteredMessages) {
      const key = msg.conversationId || msg.sessionId;
      const existing = groups.get(key) || [];
      existing.push(msg);
      groups.set(key, existing);
    }

    return Array.from(groups.entries())
      .map(([id, msgs]) => {
        const sorted = msgs.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
        const firstUser = sorted.find((m) => m.role === 'user');
        const timestamps = sorted.map((m) => m.createdAt ?? 0).filter((t) => t > 0);
        return {
          id,
          messages: sorted,
          platform: sorted[0]?.platform ?? 'unknown',
          username: firstUser?.username,
          firstMessageAt: timestamps.length > 0 ? Math.min(...timestamps) : 0,
          lastMessageAt: timestamps.length > 0 ? Math.max(...timestamps) : 0,
        };
      })
      .sort((a, b) => b.lastMessageAt - a.lastMessageAt); // Most recent first
  }, [filteredMessages]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Filter Bar */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search messages or users..."
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
              className="pl-10 pr-10 border-0 bg-transparent shadow-none focus-visible:ring-0"
            />
            {filters.search && (
              <button
                type="button"
                onClick={() => updateFilter('search', '')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filter Dropdowns */}
          <FilterDropdown
            label="Role"
            value={filters.role}
            options={[
              { value: 'all', label: 'All Roles' },
              { value: 'user', label: 'User' },
              { value: 'assistant', label: 'Assistant' },
              { value: 'system', label: 'System' },
              { value: 'tool', label: 'Tool' },
            ]}
            onChange={(v) => updateFilter('role', v as Role)}
          />

          <FilterDropdown
            label="Platform"
            value={filters.platform}
            options={[
              { value: 'all', label: 'All Platforms' },
              { value: 'telegram', label: 'Telegram' },
              { value: 'github', label: 'GitHub' },
              { value: 'cli', label: 'CLI' },
              { value: 'api', label: 'API' },
            ]}
            onChange={(v) => updateFilter('platform', v as Platform)}
          />

          <FilterDropdown
            label="Visibility"
            value={filters.visibility}
            options={[
              { value: 'all', label: 'All' },
              { value: 'public', label: 'Public' },
              { value: 'private', label: 'Private' },
              { value: 'unlisted', label: 'Unlisted' },
            ]}
            onChange={(v) => updateFilter('visibility', v as Visibility)}
          />
        </div>

        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5 text-xs">
              <X className="h-3 w-3" />
              Clear
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => refetch()} className="gap-1.5">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Messages List */}
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 pb-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageSquare className="h-5 w-5 text-primary" />
              Messages
            </CardTitle>
            <CardDescription>
              {isLoading
                ? 'Loading messages...'
                : groupedMessages.length > 0
                  ? `${groupedMessages.length} conversations · ${filteredMessages?.length ?? 0} messages`
                  : 'No messages match your filters'}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {hasActiveFilters && filteredMessages && (
              <Badge variant="outline" className="gap-1">
                <Filter className="h-3 w-3" />
                Filtered
              </Badge>
            )}
            {groupedMessages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleExpandAll}
                className="gap-1.5 text-xs"
              >
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${allExpanded ? 'rotate-180' : ''}`}
                />
                {allExpanded ? 'Collapse All' : 'Expand All'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border/50">
            {isLoading ? (
              <div className="space-y-4 p-4">
                <MessageItemSkeleton />
                <MessageItemSkeleton />
                <MessageItemSkeleton />
                <MessageItemSkeleton />
                <MessageItemSkeleton />
              </div>
            ) : groupedMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                  <MessageSquare className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">No messages found</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {hasActiveFilters
                    ? 'Try adjusting your filters'
                    : 'Start a conversation to see messages here'}
                </p>
                {hasActiveFilters && (
                  <Button variant="outline" size="sm" onClick={clearFilters} className="mt-4">
                    Clear Filters
                  </Button>
                )}
              </div>
            ) : // Smart switching: use virtual scrolling for large datasets
            groupedMessages.length >= VIRTUAL_SCROLL_THRESHOLD ||
              (filteredMessages?.length ?? 0) >= VIRTUAL_MESSAGE_THRESHOLD ? (
              <VirtualizedMessagesContent
                groupedMessages={groupedMessages}
                allExpanded={allExpanded}
                expandedMessage={expandedMessage}
                onToggleExpand={setExpandedMessage}
              />
            ) : (
              // Regular rendering for smaller datasets
              groupedMessages.map((group, groupIndex) => {
                const messagePairs = createMessagePairs(group.messages);
                const systemMessages = group.messages.filter(
                  (m) => m.role === 'system' || m.role === 'tool'
                );

                return (
                  <div
                    key={group.id}
                    className="p-4 transition-all duration-200 hover:bg-secondary/10"
                    style={{ animationDelay: `${Math.min(groupIndex, 10) * 50}ms` }}
                  >
                    {/* Conversation Header */}
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-border/30 pb-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs capitalize">
                          {group.platform}
                        </Badge>
                        {group.username && (
                          <span className="text-sm font-medium">@{group.username}</span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {messagePairs.length} exchanges
                        </span>
                        {systemMessages.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            · {systemMessages.length} system
                          </span>
                        )}
                      </div>
                      <span
                        className="flex items-center gap-1 text-xs text-muted-foreground"
                        title={formatFullTimestamp(group.lastMessageAt)}
                      >
                        <Calendar className="h-3 w-3" />
                        {formatTimestamp(group.lastMessageAt)}
                      </span>
                    </div>

                    {/* Paired Row Layout: User | Assistant per row */}
                    <div className="divide-y divide-border/30">
                      <MessagePairHeader />
                      {messagePairs.map((pair) => {
                        const userKey =
                          pair.user?.messageId || `user-orphan-${pair.assistant?.messageId}`;
                        const assistantKey =
                          pair.assistant?.messageId || `assistant-orphan-${pair.user?.messageId}`;
                        const pairKey = `${userKey}-${assistantKey}`;

                        return (
                          <MessagePairRow
                            key={pairKey}
                            pair={pair}
                            allExpanded={allExpanded}
                            expandedMessage={expandedMessage}
                            onToggleExpand={(id) => setExpandedMessage(id)}
                          />
                        );
                      })}
                    </div>

                    {/* System/Tool Messages (Full Width) */}
                    {systemMessages.length > 0 && (
                      <div className="mt-4 space-y-2 border-t border-border/30 pt-3">
                        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                          <Zap className="h-4 w-4" />
                          System/Tool ({systemMessages.length})
                        </div>
                        {systemMessages.map((msg) => {
                          const messageKey = msg.messageId || String(msg.id);
                          return (
                            <div
                              key={messageKey}
                              className="rounded-lg border border-border/50 bg-muted/30 p-3 text-xs"
                            >
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Badge variant="outline" className="text-[10px]">
                                  {msg.role}
                                </Badge>
                                <span title={formatFullTimestamp(msg.createdAt)}>
                                  {formatTimestamp(msg.createdAt)}
                                </span>
                              </div>
                              <pre className="mt-1 line-clamp-2 whitespace-pre-wrap font-sans text-muted-foreground">
                                {msg.content}
                              </pre>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
