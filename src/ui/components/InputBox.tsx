/**
 * Input Box Component
 *
 * User input field with submit handling
 */

import { Box, Text, useInput } from 'ink';
import React, { useState } from 'react';

interface InputBoxProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  isStreaming: boolean;
}

export const InputBox: React.FC<InputBoxProps> = ({ value, onChange, onSubmit, isStreaming }) => {
  const [cursorPosition, setCursorPosition] = useState(0);

  useInput(
    (input, key) => {
      // Don't accept input while streaming
      if (isStreaming) {
        return;
      }

      if (key.return) {
        // Submit on Enter
        if (value.trim()) {
          onSubmit(value);
          setCursorPosition(0);
        }
      } else if (key.backspace || key.delete) {
        // Handle backspace
        if (cursorPosition > 0) {
          const newValue = value.slice(0, cursorPosition - 1) + value.slice(cursorPosition);
          onChange(newValue);
          setCursorPosition(cursorPosition - 1);
        }
      } else if (key.leftArrow) {
        // Move cursor left
        setCursorPosition(Math.max(0, cursorPosition - 1));
      } else if (key.rightArrow) {
        // Move cursor right
        setCursorPosition(Math.min(value.length, cursorPosition + 1));
      } else if (!key.ctrl && !key.meta && input) {
        // Add character
        const newValue = value.slice(0, cursorPosition) + input + value.slice(cursorPosition);
        onChange(newValue);
        setCursorPosition(cursorPosition + 1);
      }
    },
    { isActive: !isStreaming }
  );

  return (
    <Box paddingX={1} borderStyle="single" borderTop={true} borderBottom={false}>
      <Text color="gray">{'> '}</Text>
      <Text>
        {value.slice(0, cursorPosition)}
        {!isStreaming && <Text inverse>{value[cursorPosition] || ' '}</Text>}
        {value.slice(cursorPosition + 1)}
      </Text>
      {isStreaming && <Text dimColor> (waiting for response...)</Text>}
    </Box>
  );
};
