'use client';

import { useChat } from '@ai-sdk/react';
import type { UIMessage } from 'ai';
import { DefaultChatTransport } from 'ai';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { SessionUser } from '../lib/session';
import { Messages } from './messages';
import { MultimodalInput } from './multimodal-input';
import { SuggestedActions } from './suggested-actions';

export interface ChatProps {
  id: string;
  initialMessages: UIMessage[];
  initialChatModel?: string;
  user?: SessionUser | undefined;
}

/**
 * Core Chat component using @ai-sdk/react's useChat hook
 * Handles tool approval workflow and URL query param initialization
 */
export function Chat({ id, initialMessages, initialChatModel = 'gpt-4o-mini', user }: ChatProps) {
  const searchParams = useSearchParams();
  const [hasAppendedQuery, setHasAppendedQuery] = useState(false);
  const currentModelRef = useRef(initialChatModel);

  const { messages, sendMessage, status, stop, addToolApprovalResponse } = useChat<UIMessage>({
    id,
    messages: initialMessages,
    // Auto-continue after tool approval (only for APPROVED tools)
    sendAutomaticallyWhen: ({ messages: currentMessages }) => {
      const lastMessage = currentMessages.at(-1);
      const shouldContinue =
        lastMessage?.parts?.some(
          (part) =>
            'state' in part &&
            part.state === 'approval-responded' &&
            'approval' in part &&
            (part.approval as { approved?: boolean })?.approved === true
        ) ?? false;
      return shouldContinue;
    },
    transport: new DefaultChatTransport({
      api: '/api/v1/chat',
      prepareSendMessagesRequest(request) {
        const lastMessage = request.messages.at(-1);

        // Check if this is a tool approval continuation:
        // - Last message is NOT a user message (meaning no new user input)
        // - OR any message has tool parts that were responded to (approved or denied)
        const isToolApprovalContinuation =
          lastMessage?.role !== 'user' ||
          request.messages.some((msg) =>
            msg.parts?.some((part) => {
              const state = (part as { state?: string }).state;
              return state === 'approval-responded' || state === 'output-denied';
            })
          );

        return {
          body: {
            id: request.id,
            // Send all messages for tool approval continuation, otherwise just the last user message
            ...(isToolApprovalContinuation
              ? { messages: request.messages }
              : { message: lastMessage }),
            model: currentModelRef.current,
            userId: user?.id,
            ...request.body,
          },
        };
      },
    }),
  });

  // Handle ?query= URL param for initial message
  const query = searchParams.get('query');
  useEffect(() => {
    if (query && !hasAppendedQuery) {
      sendMessage({
        role: 'user',
        parts: [{ type: 'text', text: query }],
      });
      setHasAppendedQuery(true);
      // Remove query from URL without triggering navigation
      const url = new URL(window.location.href);
      url.searchParams.delete('query');
      window.history.replaceState({}, '', url.toString());
    }
  }, [query, sendMessage, hasAppendedQuery]);

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-dvh flex-col bg-background">
      <Messages
        addToolApprovalResponse={addToolApprovalResponse}
        isEmpty={isEmpty}
        messages={messages}
        status={status}
      />
      <MultimodalInput isEmpty={isEmpty} sendMessage={sendMessage} status={status} stop={stop} />
      {/* Suggested actions shown when chat is empty */}
      {isEmpty && (
        <div className="mx-auto mb-6 max-w-2xl px-4">
          <SuggestedActions sendMessage={sendMessage} />
        </div>
      )}
    </div>
  );
}
