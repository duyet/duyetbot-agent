/**
 * MessageList Component
 *
 * Renders chat messages with role-based styling.
 * Shows streaming indicators for in-progress messages.
 * Supports both legacy content format and new parts array format.
 */

import type { DynamicToolUIPart, ModelMessage, ReasoningUIPart, TextUIPart } from 'ai';
import { Bot, User } from 'lucide-react';
import { useMemo } from 'react';
import { MessagePartRenderer } from './MessagePartRenderer';

/**
 * Extended message with UI-specific properties
 */
type _DisplayMessage = ModelMessage & {
  /** Unique message ID */
  id?: string;
  /** Whether message is currently streaming */
  isStreaming?: boolean;
};

/**
 * Union type of all UI parts we support rendering
 * Uses a flexible approach to handle various tool part types
 */
type SupportedUIPart = TextUIPart | ReasoningUIPart | DynamicToolUIPart | Record<string, unknown>;

/**
 * Props for MessageList component
 */
interface MessageListProps {
  /** Messages to display */
  messages: Array<
    | { role: 'user' | 'assistant' | 'system'; content: string }
    | { role: 'user' | 'assistant' | 'system'; parts: readonly SupportedUIPart[] }
  >;
  /** Optional CSS class name */
  className?: string;
}

/**
 * Message component for individual message display
 */
function Message({
  role,
  content,
  parts,
  isStreaming,
}: {
  role: 'user' | 'assistant' | 'system';
  content?: string;
  parts?: readonly SupportedUIPart[];
  isStreaming?: boolean;
}) {
  const isUser = role === 'user';
  const isSystem = role === 'system';

  // System messages are typically hidden or shown differently
  if (isSystem) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-2">
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-1.5">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            {content || (parts ? 'System message with parts' : 'System message')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`
        flex w-full mb-6 animate-in fade-in slide-in-from-bottom-2 duration-300
        ${isUser ? 'justify-end' : 'justify-start'}
      `}
    >
      <div
        className={`
          flex gap-3 max-w-[85%] sm:max-w-[75%]
          ${isUser ? 'flex-row-reverse' : 'flex-row'}
        `}
      >
        {/* Avatar */}
        <div
          className={`
            flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
            ${
              isUser
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
            }
          `}
        >
          {isUser ? <User size={16} /> : <Bot size={16} />}
        </div>

        {/* Message Content */}
        <div
          className={`
            rounded-2xl px-4 py-3
            ${
              isUser
                ? 'bg-blue-600 text-white rounded-br-sm'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-sm'
            }
          `}
        >
          {/* Content with parts renderer or fallback to content */}
          {parts && parts.length > 0 ? (
            <MessagePartRenderer parts={parts} />
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {isStreaming ? (
                <>
                  {content}
                  <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />
                </>
              ) : (
                content
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Empty state when no messages exist
 */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <Bot className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
        Start a conversation
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">
        Ask me anything. I can help with code, research, GitHub operations, and more.
      </p>
    </div>
  );
}

/**
 * Renders a list of chat messages with role-based styling.
 *
 * @example
 * ```tsx
 * <MessageList messages={messages} />
 * ```
 */
export function MessageList({ messages, className = '' }: MessageListProps) {
  const displayMessages = useMemo(() => {
    return messages.map((msg, idx) => ({
      ...msg,
      id: `${msg.role}-${idx}`,
      isStreaming:
        idx === messages.length - 1 &&
        (('content' in msg && msg.content === '') || ('parts' in msg && msg.parts.length === 0)),
    }));
  }, [messages]);

  if (displayMessages.length === 0) {
    return (
      <div className={`flex-1 flex items-center justify-center ${className}`}>
        <EmptyState />
      </div>
    );
  }

  return (
    <div className={`px-4 py-6 ${className}`}>
      {displayMessages.map((msg) => (
        <Message
          key={msg.id}
          role={msg.role as 'user' | 'assistant'}
          content={'content' in msg ? msg.content : undefined}
          parts={'parts' in msg ? msg.parts : undefined}
          isStreaming={msg.isStreaming}
        />
      ))}
    </div>
  );
}
