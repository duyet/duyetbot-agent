/**
 * ChatView Component
 *
 * Ink-based chat interface
 */

import type { LLMMessage } from '@duyetbot/types';
import { Box, Text, useApp, useInput } from 'ink';
import Spinner from 'ink-spinner';
import TextInput from 'ink-text-input';
import React, { useState } from 'react';

export interface ChatViewProps {
  messages: LLMMessage[];
  onSendMessage: (message: string) => Promise<void>;
  isLoading?: boolean;
  sessionId?: string;
  mode: 'local' | 'cloud';
}

export function ChatView({
  messages,
  onSendMessage,
  isLoading = false,
  sessionId,
  mode,
}: ChatViewProps): React.ReactElement {
  const { exit } = useApp();
  const [input, setInput] = useState('');

  // Handle Ctrl+C to exit
  useInput((inputKey, key) => {
    if (key.ctrl && inputKey === 'c') {
      exit();
    }
  });

  const handleSubmit = async (value: string): Promise<void> => {
    if (!value.trim() || isLoading) {
      return;
    }

    setInput('');
    await onSendMessage(value.trim());
  };

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">
          duyetbot
        </Text>
        <Text dimColor> | </Text>
        <Text color="gray">Mode: {mode}</Text>
        {sessionId && (
          <>
            <Text dimColor> | </Text>
            <Text color="gray">Session: {sessionId.slice(0, 8)}...</Text>
          </>
        )}
      </Box>

      {/* Messages */}
      <Box flexDirection="column" marginBottom={1}>
        {messages.length === 0 ? (
          <Text dimColor>No messages yet. Type something to start!</Text>
        ) : (
          messages.map((msg, i) => (
            <Box key={`${msg.role}-${i}-${msg.content.slice(0, 10)}`} marginBottom={1}>
              <Text bold color={msg.role === 'user' ? 'green' : 'blue'}>
                {msg.role === 'user' ? 'You' : 'Assistant'}:{' '}
              </Text>
              <Text wrap="wrap">{msg.content}</Text>
            </Box>
          ))
        )}
      </Box>

      {/* Loading indicator */}
      {isLoading && (
        <Box marginBottom={1}>
          <Text color="yellow">
            <Spinner type="dots" />
          </Text>
          <Text> Thinking...</Text>
        </Box>
      )}

      {/* Input */}
      <Box>
        <Text bold color="green">
          {'> '}
        </Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          placeholder={isLoading ? 'Please wait...' : 'Type a message...'}
        />
      </Box>

      {/* Footer */}
      <Box marginTop={1}>
        <Text dimColor>Press Ctrl+C to exit</Text>
      </Box>
    </Box>
  );
}

export default ChatView;
