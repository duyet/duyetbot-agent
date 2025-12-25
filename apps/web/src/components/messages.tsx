'use client';

import type { UseChatHelpers } from '@ai-sdk/react';
import type { UIMessage } from 'ai';
import { ArrowDownIcon } from 'lucide-react';
import { type HTMLAttributes, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Message, MessageContent, type MessageProps } from './ai-elements/message';
import { ThinkingMessage } from './thinking';

export interface MessagesProps extends HTMLAttributes<HTMLDivElement> {
  messages: UIMessage[];
  status: UseChatHelpers<UIMessage>['status'];
  addToolApprovalResponse: UseChatHelpers<UIMessage>['addToolApprovalResponse'];
  isEmpty?: boolean;
}

/**
 * Messages component with auto-scroll and message rendering
 * Reuses existing Message and MessageContent components from ai-elements
 */
export function Messages({
  messages,
  status,
  isEmpty = false,
  className,
  ...props
}: MessagesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasSentMessage, setHasSentMessage] = useState(false);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0 && !hasSentMessage) {
      setHasSentMessage(true);
    }
    if (hasSentMessage || messages.length > 0) {
      endRef.current?.scrollIntoView({ behavior: 'instant' });
    }
  }, [messages.length, hasSentMessage]);

  // Track scroll position
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const threshold = 100;
      const isBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
      setIsAtBottom(isBottom);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    endRef.current?.scrollIntoView({ behavior });
  };

  // Check if tool approval is in progress (using correct state names)
  const isWaitingForApproval = messages.some((msg) =>
    msg.parts?.some(
      (part) =>
        'state' in part &&
        (part.state === 'approval-requested' || part.state === 'approval-responded')
    )
  );

  return (
    <div className={cn('relative flex-1 overflow-hidden', className)} {...props}>
      <div ref={containerRef} className="absolute inset-0 overflow-y-auto touch-pan-y">
        <div className="mx-auto flex min-w-0 max-w-3xl flex-col gap-6 px-4 py-6 md:gap-8 md:px-6 md:py-8">
          {/* Greeting shown when no messages */}
          {isEmpty && <Greeting />}

          {/* Messages */}
          {messages.map((message, index) => (
            <MessageComponent
              key={message.id}
              message={message}
              isLast={index === messages.length - 1}
              isStreaming={status === 'streaming' && index === messages.length - 1}
            />
          ))}

          {/* Thinking indicator */}
          {status === 'submitted' && !isWaitingForApproval && <ThinkingMessage />}

          {/* Scroll anchor */}
          <div ref={endRef} className="h-px min-h-6 shrink-0" />
        </div>
      </div>

      {/* Scroll to bottom button */}
      <button
        aria-label="Scroll to bottom"
        className={cn(
          'absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full border bg-background p-2 shadow-lg transition-all',
          'hover:bg-muted',
          isAtBottom
            ? 'pointer-events-none scale-0 opacity-0'
            : 'pointer-events-auto scale-100 opacity-100'
        )}
        onClick={() => scrollToBottom('smooth')}
        type="button"
      >
        <ArrowDownIcon className="size-4" />
      </button>
    </div>
  );
}

interface MessageComponentProps {
  message: UIMessage;
  isLast: boolean;
  isStreaming: boolean;
}

function MessageComponent({ message, isLast, isStreaming }: MessageComponentProps) {
  const isUser = message.role === 'user';

  // Extract text content from parts
  const textContent = message.parts.find((p) => p.type === 'text')?.text ?? '';

  // Extract tool calls
  const toolParts = message.parts.filter((p) => p.type.startsWith('tool-'));

  return (
    <Message from={message.role}>
      <MessageContent>
        {/* Text Content */}
        {textContent && (
          <div className="whitespace-pre-wrap text-sm leading-relaxed">{textContent}</div>
        )}

        {/* Tool Call Indicators */}
        {toolParts.length > 0 && !isUser && (
          <div className="mt-3 space-y-2">
            {toolParts.map((part, index) => {
              if (!part.type.startsWith('tool-')) return null;

              const toolPart = part as { toolName?: string };
              return (
                <div
                  key={index}
                  className="inline-flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-1.5 text-xs font-medium"
                >
                  <span>{toolPart.toolName ?? 'Tool'}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Streaming Indicator */}
        {isStreaming && (
          <div className="flex items-center gap-1.5 mt-3">
            <div
              className="h-1.5 w-1.5 rounded-full bg-accent/60 animate-bounce"
              style={{ animationDelay: '0ms' }}
            />
            <div
              className="h-1.5 w-1.5 rounded-full bg-accent/60 animate-bounce"
              style={{ animationDelay: '150ms' }}
            />
            <div
              className="h-1.5 w-1.5 rounded-full bg-accent/60 animate-bounce"
              style={{ animationDelay: '300ms' }}
            />
          </div>
        )}
      </MessageContent>
    </Message>
  );
}

// Re-export Greeting for messages.tsx
function Greeting() {
  return (
    <div className="mx-auto mt-4 flex size-full max-w-3xl flex-col justify-center px-4 md:mt-16 md:px-8">
      <h2 className="animate-in fade-in slide-in-from-bottom-4 duration-700 font-semibold text-xl md:text-2xl">
        Hello there!
      </h2>
      <p className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100 text-xl text-muted-foreground md:text-2xl">
        How can I help you today?
      </p>
    </div>
  );
}
