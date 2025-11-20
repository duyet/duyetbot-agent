/**
 * Session List Component
 *
 * Displays a list of sessions with selection capability
 */

import React from 'react';
import { Box, Text } from 'ink';

export interface SessionItem {
  id: string;
  title: string;
  state: 'active' | 'paused' | 'completed' | 'failed';
  messageCount: number;
  updatedAt: number;
}

export interface SessionListProps {
  sessions: SessionItem[];
  selectedIndex?: number;
  onSelect?: (session: SessionItem) => void;
  maxVisible?: number;
}

/**
 * Format relative time
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return new Date(timestamp).toLocaleDateString();
}

/**
 * Get state color
 */
function getStateColor(state: SessionItem['state']): string {
  switch (state) {
    case 'active':
      return 'green';
    case 'paused':
      return 'yellow';
    case 'completed':
      return 'blue';
    case 'failed':
      return 'red';
    default:
      return 'gray';
  }
}

/**
 * Session List Component
 */
export function SessionList({
  sessions,
  selectedIndex = -1,
  onSelect: _onSelect,
  maxVisible = 10,
}: SessionListProps): React.ReactElement {
  if (sessions.length === 0) {
    return (
      <Box paddingY={1}>
        <Text color="gray">No sessions found</Text>
      </Box>
    );
  }

  const visibleSessions = sessions.slice(0, maxVisible);
  const hasMore = sessions.length > maxVisible;

  return (
    <Box flexDirection="column">
      {visibleSessions.map((session, index) => {
        const isSelected = index === selectedIndex;

        return (
          <Box
            key={session.id}
            paddingX={1}
            paddingY={0}
          >
            {isSelected ? (
              <Text color="cyan" bold>{'> '}</Text>
            ) : (
              <Text>{'  '}</Text>
            )}
            <Text color={getStateColor(session.state)}>●</Text>
            <Text> </Text>
            {isSelected ? (
              <Text color="cyan">
                {session.title.slice(0, 30)}
                {session.title.length > 30 ? '...' : ''}
              </Text>
            ) : (
              <Text>
                {session.title.slice(0, 30)}
                {session.title.length > 30 ? '...' : ''}
              </Text>
            )}
            <Text color="gray"> ({session.messageCount} msgs)</Text>
            <Text color="gray"> - {formatRelativeTime(session.updatedAt)}</Text>
          </Box>
        );
      })}

      {hasMore && (
        <Box paddingX={1} paddingTop={1}>
          <Text color="gray">
            ... and {sessions.length - maxVisible} more
          </Text>
        </Box>
      )}
    </Box>
  );
}

/**
 * Session List Header
 */
export function SessionListHeader({ count }: { count: number }): React.ReactElement {
  return (
    <Box paddingY={1}>
      <Text bold>Sessions</Text>
      <Text color="gray"> ({count})</Text>
    </Box>
  );
}

/**
 * Complete SessionList with header
 */
export function SessionListView(props: SessionListProps): React.ReactElement {
  const { sessions } = props;
  return (
    <Box flexDirection="column">
      <SessionListHeader count={sessions.length} />
      <SessionList {...props} />
    </Box>
  );
}

export default SessionList;
