'use client';

import type { UseChatHelpers } from '@ai-sdk/react';
import type { UIMessage } from 'ai';
import { Code, HelpCircle, MessageSquare, Search } from 'lucide-react';
import { motion } from 'motion/react';
import { memo } from 'react';
import { Button } from './ui/button';

export interface SuggestedActionsProps {
  sendMessage: UseChatHelpers<UIMessage>['sendMessage'];
}

/**
 * Simple suggested actions component
 * Shows generic suggestion chips when messages.length === 0
 */
const suggestedActions = [
  {
    text: 'Help me write code',
    icon: Code,
    label: 'Write code',
  },
  {
    text: 'Answer a question',
    icon: HelpCircle,
    label: 'Ask a question',
  },
  {
    text: 'Start a conversation',
    icon: MessageSquare,
    label: 'Chat',
  },
  {
    text: 'Research something',
    icon: Search,
    label: 'Research',
  },
];

function PureSuggestedActions({ sendMessage }: SuggestedActionsProps) {
  const handleClick = (suggestion: string) => {
    sendMessage({
      role: 'user',
      parts: [{ type: 'text', text: suggestion }],
    });
  };

  return (
    <div className="grid w-full gap-2 sm:grid-cols-2" data-testid="suggested-actions">
      {suggestedActions.map((action, index) => (
        <motion.div
          key={action.text}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          initial={{ opacity: 0, y: 20 }}
          transition={{ delay: 0.05 * index }}
        >
          <Button
            variant="outline"
            className="h-auto w-full whitespace-normal p-3 text-start justify-start gap-3"
            onClick={() => handleClick(action.text)}
          >
            <action.icon className="size-4 shrink-0 text-muted-foreground" />
            <span className="font-medium">{action.label}</span>
          </Button>
        </motion.div>
      ))}
    </div>
  );
}

export const SuggestedActions = memo(PureSuggestedActions, (prevProps, nextProps) => {
  // Only re-render if sendMessage changes
  return prevProps.sendMessage === nextProps.sendMessage;
});
