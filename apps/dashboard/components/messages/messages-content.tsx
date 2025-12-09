'use client';

import type { AnalyticsMessage } from '@duyetbot/analytics';
import {
  Bot,
  Calendar,
  ChevronDown,
  Download,
  Eye,
  EyeOff,
  Filter,
  MessageSquare,
  RefreshCw,
  Search,
  Users,
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

interface MessagePair {
  user: AnalyticsMessage | null;
  assistant: AnalyticsMessage | null;
}

/**
 * Detect if a message content indicates an error response
 */
function isErrorResponse(msg: AnalyticsMessage | null): boolean {
  if (!msg) {
    return false;
  }

  // Check metadata for error indicators
  const metadata = msg.metadata as Record<string, unknown> | undefined;
  if (metadata?.error || metadata?.lastToolError || metadata?.errorMessage) {
    return true;
  }

  // Check content for common error patterns
  const content = msg.content?.toLowerCase() ?? '';
  const errorPatterns = [
    /^error:/i,
    /^failed:/i,
    /\[error\]/i,
    /exception occurred/i,
    /internal server error/i,
    /timeout exceeded/i,
    /rate limit/i,
  ];

  return errorPatterns.some((pattern) => pattern.test(content));
}

/**
 * Pairs user messages with their corresponding assistant responses.
 * Uses hybrid approach:
 * 1. First tries to match via triggerMessageId (explicit FK relationship)
 * 2. Falls back to sequential matching for legacy data
 */
function createMessagePairs(messages: AnalyticsMessage[]): MessagePair[] {
  const pairs: MessagePair[] = [];
  const sorted = [...messages].sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));

  // Build lookup: triggerMessageId → assistant message (for explicit pairing)
  const assistantByTrigger = new Map<string, AnalyticsMessage>();
  for (const msg of sorted) {
    if (msg.role === 'assistant' && msg.triggerMessageId) {
      assistantByTrigger.set(msg.triggerMessageId, msg);
    }
  }

  // Track which assistant messages have been paired (to avoid duplicates)
  const pairedAssistants = new Set<string>();

  // First pass: pair user messages with their responses
  for (const msg of sorted) {
    if (msg.role === 'user') {
      // Try explicit pairing via triggerMessageId first
      const explicitResponse = assistantByTrigger.get(msg.messageId);
      if (explicitResponse) {
        pairs.push({ user: msg, assistant: explicitResponse });
        pairedAssistants.add(explicitResponse.messageId);
      } else {
        // Fallback: find next unpaired assistant message in sequence
        const msgIndex = sorted.indexOf(msg);
        let foundResponse: AnalyticsMessage | null = null;

        for (let j = msgIndex + 1; j < sorted.length; j++) {
          const candidate = sorted[j];
          if (candidate.role === 'user') {
            break; // Stop at next user message
          }
          if (candidate.role === 'assistant' && !pairedAssistants.has(candidate.messageId)) {
            foundResponse = candidate;
            pairedAssistants.add(candidate.messageId);
            break;
          }
        }

        pairs.push({ user: msg, assistant: foundResponse });
      }
    }
  }

  // Second pass: add any orphan assistant messages (rare)
  for (const msg of sorted) {
    if (msg.role === 'assistant' && !pairedAssistants.has(msg.messageId)) {
      pairs.push({ user: null, assistant: msg });
    }
  }

  return pairs;
}

function formatTimestamp(ts: number | null | undefined): string {
  if (ts == null) {
    return 'Unknown';
  }
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (minutes < 1) {
    return 'Just now';
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatFullTimestamp(ts: number | null | undefined): string {
  if (ts == null) {
    return 'Unknown';
  }
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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
          <div
            role="presentation"
            className="fixed inset-0 z-40"
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
  const { data: messages, isLoading, refetch } = useRecentMessages(50);
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
              className="pl-10 pr-10"
              variant="ghost"
            />
            {filters.search && (
              <button
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
            ) : (
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
                      {/* Header Row */}
                      <div className="grid grid-cols-2 gap-4 pb-2 text-xs font-medium">
                        <div className="flex items-center gap-2 text-primary">
                          <Users className="h-4 w-4" />
                          User
                        </div>
                        <div className="flex items-center gap-2 text-success">
                          <Bot className="h-4 w-4" />
                          Assistant
                        </div>
                      </div>

                      {/* Message Pair Rows */}
                      {messagePairs.map((pair, pairIndex) => {
                        const userKey = pair.user?.messageId || `user-${pairIndex}`;
                        const assistantKey = pair.assistant?.messageId || `assistant-${pairIndex}`;
                        const isUserExpanded = allExpanded || expandedMessage === userKey;
                        const isAssistantExpanded = allExpanded || expandedMessage === assistantKey;
                        const hasError = isErrorResponse(pair.assistant);

                        return (
                          <div key={`pair-${pairIndex}`} className="grid grid-cols-2 gap-4 py-3">
                            {/* User Cell */}
                            <div
                              className={
                                pair.user
                                  ? 'rounded-lg border border-primary/20 bg-primary/5 p-3'
                                  : 'flex items-center justify-center rounded-lg border border-dashed border-border/30 p-3 text-muted-foreground italic'
                              }
                            >
                              {pair.user ? (
                                <>
                                  <div
                                    className={`text-sm leading-relaxed ${isUserExpanded ? '' : 'line-clamp-4'}`}
                                  >
                                    <pre className="whitespace-pre-wrap font-sans">
                                      {pair.user.content}
                                    </pre>
                                  </div>
                                  {!allExpanded &&
                                    pair.user.content &&
                                    pair.user.content.length > 200 && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setExpandedMessage(isUserExpanded ? null : userKey)
                                        }
                                        className="mt-1 text-xs font-medium text-primary hover:underline"
                                      >
                                        {isUserExpanded ? 'Show less' : 'Show more'}
                                      </button>
                                    )}
                                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                                    <span title={formatFullTimestamp(pair.user.createdAt)}>
                                      {formatTimestamp(pair.user.createdAt)}
                                    </span>
                                    {pair.user.visibility && (
                                      <>
                                        <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                                        <span className="flex items-center gap-0.5">
                                          {pair.user.visibility === 'public' ? (
                                            <Eye className="h-3 w-3" />
                                          ) : (
                                            <EyeOff className="h-3 w-3" />
                                          )}
                                          {pair.user.visibility}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </>
                              ) : (
                                <span className="text-xs">—</span>
                              )}
                            </div>

                            {/* Assistant Cell */}
                            <div
                              className={
                                pair.assistant
                                  ? hasError
                                    ? 'rounded-lg border border-destructive/30 bg-destructive/5 p-3'
                                    : 'rounded-lg border border-success/20 bg-success/5 p-3'
                                  : 'flex items-center justify-center rounded-lg border border-dashed border-border/30 p-3 text-muted-foreground italic'
                              }
                            >
                              {pair.assistant ? (
                                <>
                                  <div className="mb-1 flex items-center gap-2">
                                    {hasError && (
                                      <Badge variant="destructive" className="text-[10px]">
                                        Error
                                      </Badge>
                                    )}
                                    {pair.assistant.model && (
                                      <span className="text-xs text-muted-foreground opacity-70">
                                        {pair.assistant.model}
                                      </span>
                                    )}
                                  </div>
                                  <div
                                    className={`text-sm leading-relaxed ${isAssistantExpanded ? '' : 'line-clamp-4'}`}
                                  >
                                    <pre className="whitespace-pre-wrap font-sans">
                                      {pair.assistant.content}
                                    </pre>
                                  </div>
                                  {!allExpanded &&
                                    pair.assistant.content &&
                                    pair.assistant.content.length > 200 && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setExpandedMessage(
                                            isAssistantExpanded ? null : assistantKey
                                          )
                                        }
                                        className={`mt-1 text-xs font-medium hover:underline ${hasError ? 'text-destructive' : 'text-success'}`}
                                      >
                                        {isAssistantExpanded ? 'Show less' : 'Show more'}
                                      </button>
                                    )}
                                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                    <span title={formatFullTimestamp(pair.assistant.createdAt)}>
                                      {formatTimestamp(pair.assistant.createdAt)}
                                    </span>
                                    {(pair.assistant.inputTokens > 0 ||
                                      pair.assistant.outputTokens > 0) && (
                                      <>
                                        <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                                        <span className="flex items-center gap-1">
                                          <Zap className="h-3 w-3" />
                                          {pair.assistant.inputTokens > 0 &&
                                            `${pair.assistant.inputTokens} in`}
                                          {pair.assistant.inputTokens > 0 &&
                                            pair.assistant.outputTokens > 0 &&
                                            ' / '}
                                          {pair.assistant.outputTokens > 0 &&
                                            `${pair.assistant.outputTokens} out`}
                                        </span>
                                      </>
                                    )}
                                    {pair.assistant.cachedTokens > 0 && (
                                      <>
                                        <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                                        <span className="text-success">
                                          {pair.assistant.cachedTokens} cached
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </>
                              ) : (
                                <span className="text-xs">no response</span>
                              )}
                            </div>
                          </div>
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
