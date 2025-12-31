'use client';

import type { AnalyticsMessage } from '@duyetbot/analytics';
import { Calendar } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { GroupedVirtuoso } from 'react-virtuoso';
import { Badge } from '@/components/ui/badge';
import {
  createMessagePairs,
  formatFullTimestamp,
  formatTimestamp,
  type MessagePair,
  MessagePairHeader,
  MessagePairRow,
} from './message-pair-row';

interface ConversationGroup {
  id: string;
  messages: AnalyticsMessage[];
  platform: string;
  username?: string;
  firstMessageAt: number;
  lastMessageAt: number;
}

interface VirtualizedMessagesContentProps {
  groupedMessages: ConversationGroup[];
  allExpanded: boolean;
  expandedMessage: string | null;
  onToggleExpand: (messageId: string | null) => void;
}

/**
 * Virtualized message list using GroupedVirtuoso for efficient rendering
 * of large message lists with conversation grouping.
 */
export function VirtualizedMessagesContent({
  groupedMessages,
  allExpanded,
  expandedMessage,
  onToggleExpand,
}: VirtualizedMessagesContentProps) {
  // Flatten groups into message pairs with group tracking
  const { allPairs, groupCounts, groupData } = useMemo(() => {
    const pairs: Array<{ pair: MessagePair; groupIndex: number }> = [];
    const counts: number[] = [];
    const data: ConversationGroup[] = [];

    for (let groupIndex = 0; groupIndex < groupedMessages.length; groupIndex++) {
      const group = groupedMessages[groupIndex];
      const messagePairs = createMessagePairs(group.messages);

      // Filter out system/tool messages for the main pairs
      const regularPairs = messagePairs;

      for (const pair of regularPairs) {
        pairs.push({ pair, groupIndex });
      }

      counts.push(regularPairs.length);
      data.push(group);
    }

    return { allPairs: pairs, groupCounts: counts, groupData: data };
  }, [groupedMessages]);

  // Render group header (conversation header)
  const groupContent = useCallback(
    (groupIndex: number) => {
      const group = groupData[groupIndex];
      if (!group) {
        return null;
      }

      const messagePairs = createMessagePairs(group.messages);
      const systemMessages = group.messages.filter((m) => m.role === 'system' || m.role === 'tool');

      return (
        <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm">
          {/* Conversation Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/30 px-4 py-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs capitalize">
                {group.platform}
              </Badge>
              {group.username && <span className="text-sm font-medium">@{group.username}</span>}
              <span className="text-xs text-muted-foreground">{messagePairs.length} exchanges</span>
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

          {/* Message Pair Header */}
          <div className="border-b border-border/20 px-4 py-2">
            <MessagePairHeader />
          </div>
        </div>
      );
    },
    [groupData]
  );

  // Render individual message pair row
  const itemContent = useCallback(
    (index: number) => {
      const item = allPairs[index];
      if (!item) {
        return null;
      }

      return (
        <div className="px-4">
          <MessagePairRow
            pair={item.pair}
            allExpanded={allExpanded}
            expandedMessage={expandedMessage}
            onToggleExpand={onToggleExpand}
          />
        </div>
      );
    },
    [allPairs, allExpanded, expandedMessage, onToggleExpand]
  );

  // Handle empty state
  if (groupedMessages.length === 0) {
    return null;
  }

  return (
    <div className="h-[600px] w-full">
      <GroupedVirtuoso
        groupCounts={groupCounts}
        groupContent={groupContent}
        itemContent={itemContent}
        overscan={100}
        defaultItemHeight={150}
        increaseViewportBy={{ top: 50, bottom: 200 }}
        style={{ height: '100%' }}
      />
    </div>
  );
}
