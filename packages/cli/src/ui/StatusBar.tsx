/**
 * StatusBar Component
 *
 * Shows current status and connection info
 */

import { Box, Text } from 'ink';
import React from 'react';

export interface StatusBarProps {
  mode: 'local' | 'cloud';
  connected?: boolean;
  sessionId?: string;
  messageCount?: number;
}

export function StatusBar({
  mode,
  connected = true,
  sessionId,
  messageCount = 0,
}: StatusBarProps): React.ReactElement {
  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1} justifyContent="space-between">
      <Box>
        <Text bold>DuyetBot</Text>
        <Text dimColor> | </Text>
        <Text color={mode === 'cloud' ? 'cyan' : 'yellow'}>{mode}</Text>
      </Box>

      <Box>
        {sessionId && (
          <>
            <Text dimColor>Session: </Text>
            <Text>{sessionId.slice(0, 8)}</Text>
            <Text dimColor> | </Text>
          </>
        )}
        <Text dimColor>Messages: </Text>
        <Text>{messageCount}</Text>
        <Text dimColor> | </Text>
        <Text color={connected ? 'green' : 'red'}>{connected ? '●' : '○'}</Text>
      </Box>
    </Box>
  );
}

export default StatusBar;
