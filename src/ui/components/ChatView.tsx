/**
 * Chat View Component
 *
 * Displays conversation messages
 */

import type { LLMMessage } from '@/providers/types';
import { Box, Text } from 'ink';
import type React from 'react';

interface ChatViewProps {
  messages: LLMMessage[];
  isStreaming: boolean;
  appName: string;
}

export const ChatView: React.FC<ChatViewProps> = ({ messages, isStreaming, appName }) => {
  if (messages.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text dimColor>No messages yet. Type your message below to start.</Text>
        <Text dimColor></Text>
        <Text dimColor>Example: "Write a haiku about coding"</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={1} paddingY={0}>
      {messages.map((message, index) => (
        <Box key={index} flexDirection="column" marginY={1}>
          {/* Message Header */}
          <Box>
            <Text bold color={message.role === 'user' ? 'green' : 'blue'}>
              {message.role === 'user' ? 'You' : appName}
            </Text>
          </Box>

          {/* Message Content */}
          <Box paddingLeft={2}>
            <Text>{message.content}</Text>
          </Box>
        </Box>
      ))}

      {/* Streaming indicator */}
      {isStreaming && (
        <Box paddingLeft={2}>
          <Text dimColor>▊</Text>
        </Box>
      )}
    </Box>
  );
};
