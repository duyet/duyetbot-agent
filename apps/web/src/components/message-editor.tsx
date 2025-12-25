'use client';

import type { UIMessage } from 'ai';
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';

export interface MessageEditorProps {
  message: UIMessage;
  setMode: Dispatch<SetStateAction<'view' | 'edit'>>;
  setMessages: (updater: (messages: UIMessage[]) => UIMessage[]) => void;
  regenerate: () => void;
}

/**
 * Extract text content from a UIMessage's parts
 */
function getTextFromMessage(message: UIMessage): string {
  return (
    message.parts
      ?.filter((p) => p.type === 'text')
      .map((p) => (p as { text: string }).text)
      .join('\n')
      .trim() || ''
  );
}

/**
 * MessageEditor component - allows editing a message and regenerating the response
 *
 * When a user edits a message:
 * 1. All messages after the edited message are removed
 * 2. The message content is updated with the new text
 * 3. The response is regenerated from that point
 */
export function MessageEditor({ message, setMode, setMessages, regenerate }: MessageEditorProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draftContent, setDraftContent] = useState(getTextFromMessage(message));
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight + 2}px`;
    }
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight();
    }
  }, [adjustHeight]);

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraftContent(event.target.value);
    adjustHeight();
  };

  const handleCancel = () => {
    setMode('view');
  };

  const handleSend = async () => {
    setIsSubmitting(true);

    // Remove all messages after the edited message and update the content
    setMessages((messages) => {
      const index = messages.findIndex((m) => m.id === message.id);

      if (index !== -1) {
        // Create updated message with new text content
        const updatedMessage: UIMessage = {
          ...message,
          parts: [{ type: 'text', text: draftContent }],
        };

        // Keep messages up to and including the edited message
        return [...messages.slice(0, index), updatedMessage];
      }

      return messages;
    });

    setMode('view');
    regenerate();
  };

  return (
    <div className="flex w-full flex-col gap-2">
      <Textarea
        className={cn(
          'w-full resize-none overflow-hidden rounded-xl bg-transparent text-base outline-hidden'
        )}
        data-testid="message-editor"
        onChange={handleInput}
        ref={textareaRef}
        value={draftContent}
      />

      <div className="flex flex-row justify-end gap-2">
        <Button className="h-fit px-3 py-2" onClick={handleCancel} variant="outline">
          Cancel
        </Button>
        <Button
          className="h-fit px-3 py-2"
          data-testid="message-editor-send-button"
          disabled={isSubmitting}
          onClick={handleSend}
          variant="default"
        >
          {isSubmitting ? 'Sending...' : 'Send'}
        </Button>
      </div>
    </div>
  );
}
