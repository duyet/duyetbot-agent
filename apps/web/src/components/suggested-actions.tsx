'use client';

import type { UseChatHelpers } from '@ai-sdk/react';
import type { UIMessage } from 'ai';
import { motion } from 'framer-motion';
import { memo } from 'react';
import { Suggestion } from './suggestion';

type SuggestedActionsProps = {
  chatId: string;
  sendMessage: UseChatHelpers<UIMessage>['sendMessage'];
};

const suggestedActions = [
  'What are the advantages of using Next.js?',
  "Write code to demonstrate Dijkstra's algorithm",
  'Help me write an essay about Silicon Valley',
  'What is the weather in San Francisco?',
];

function PureSuggestedActions({ chatId, sendMessage }: SuggestedActionsProps) {
  const handleClick = (suggestion: string) => {
    window.history.pushState({}, '', `/chat/${chatId}`);
    sendMessage({
      role: 'user',
      parts: [{ type: 'text', text: suggestion }],
    });
  };

  return (
    <div className="grid w-full gap-2 sm:grid-cols-2" data-testid="suggested-actions">
      {suggestedActions.map((suggestedAction, index) => (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          initial={{ opacity: 0, y: 20 }}
          key={suggestedAction}
          transition={{ delay: 0.05 * index }}
        >
          <Suggestion
            className="h-auto w-full whitespace-normal p-3 text-left"
            onClick={handleClick}
            suggestion={suggestedAction}
          >
            {suggestedAction}
          </Suggestion>
        </motion.div>
      ))}
    </div>
  );
}

export const SuggestedActions = memo(PureSuggestedActions, (prevProps, nextProps) => {
  return prevProps.chatId === nextProps.chatId;
});
