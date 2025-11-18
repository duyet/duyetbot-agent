/**
 * Status Bar Component
 *
 * Shows session title, model, and streaming status
 */

import { Box, Text } from 'ink';
import React from 'react';


interface StatusBarProps {
  appName: string;
  sessionTitle: string;
  model: string;
  isStreaming: boolean;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  appName,
  sessionTitle,
  model,
  isStreaming,
}) => {
  return (
    <Box
      paddingX={1}
      borderStyle="single"
      borderBottom={false}
      justifyContent="space-between"
    >
      {/* Left side: Session title */}
      <Box>
        <Text bold color="cyan">
          {appName}
        </Text>
        <Text dimColor> | </Text>
        <Text>{sessionTitle}</Text>
      </Box>

      {/* Right side: Model and status */}
      <Box>
        {isStreaming && (
          <>
            <Text color="yellow">●</Text>
            <Text dimColor> streaming... </Text>
          </>
        )}
        <Text dimColor>{model}</Text>
      </Box>
    </Box>
  );
};
