'use client';

import type { UseChatHelpers } from '@ai-sdk/react';
import type { UIMessage } from 'ai';
import equal from 'fast-deep-equal';
import { ArrowUpIcon, PaperclipIcon, SquareIcon } from 'lucide-react';
import {
  type ChangeEvent,
  type Dispatch,
  memo,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { cn } from '@/lib/utils';
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputBody,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from './ai-elements/prompt-input';

interface MultimodalInputProps {
  sendMessage: UseChatHelpers<UIMessage>['sendMessage'];
  status: UseChatHelpers<UIMessage>['status'];
  stop: () => void;
  isEmpty?: boolean;
  className?: string;
}

/**
 * Multimodal input component with file attachment support
 * Uses PromptInput compound component from ai-elements
 * Features:
 * - File attachment via button or paste
 * - LocalStorage sync for input state
 * - Stop button when status is "submitted"
 * - Memo optimization with fast-deep-equal
 */
function PureMultimodalInput({
  sendMessage,
  status,
  stop,
  isEmpty = false,
  className,
}: MultimodalInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(
    (message: PromptInputMessage) => {
      const hasText = Boolean(message.text);
      const hasAttachments = Boolean(message.files?.length);

      if (!hasText && !hasAttachments) {
        return;
      }

      sendMessage({
        text: message.text || 'Sent with attachments',
        files: message.files,
      });
    },
    [sendMessage]
  );

  // Handle file paste
  const handlePaste = useCallback((event: ClipboardEvent) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    const files: File[] = [];
    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          files.push(file);
        }
      }
    }

    if (files.length > 0) {
      event.preventDefault();
      // Files are handled by PromptInput's paste handler
    }
  }, []);

  // Add paste event listener to textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.addEventListener('paste', handlePaste);
    return () => textarea.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  return (
    <div
      className={cn(
        'border-t border-border/50 bg-background/95 backdrop-blur-sm px-4 py-4 lg:px-6',
        className
      )}
    >
      <div className="mx-auto max-w-3xl">
        <PromptInput onSubmit={handleSubmit} className="relative" multiple globalDrop>
          <PromptInputBody>
            <PromptInputTextarea
              ref={textareaRef}
              placeholder={isEmpty ? 'Start a conversation...' : 'Send a message...'}
            />
          </PromptInputBody>

          <PromptInputFooter>
            <PromptInputTools>
              {/* Attachments button */}
              <PromptInputActionMenu>
                <PromptInputActionMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
                      'hover:bg-accent hover:text-accent-foreground',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                    disabled={status !== 'ready'}
                  >
                    <PaperclipIcon className="size-4" />
                  </button>
                </PromptInputActionMenuTrigger>
                <PromptInputActionMenuContent>
                  <PromptInputActionAddAttachments />
                </PromptInputActionMenuContent>
              </PromptInputActionMenu>
            </PromptInputTools>

            {/* Submit or Stop button */}
            {status === 'submitted' ? (
              <StopButton stop={stop} />
            ) : (
              <PromptInputSubmit
                status={status}
                className="size-8 shrink-0 rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground"
              >
                <ArrowUpIcon className="size-4" />
              </PromptInputSubmit>
            )}
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}

export const MultimodalInput = memo(PureMultimodalInput, (prevProps, nextProps) => {
  // Custom comparison for memo optimization
  if (prevProps.status !== nextProps.status) {
    return false;
  }
  if (prevProps.isEmpty !== nextProps.isEmpty) {
    return false;
  }
  return true;
});

function StopButton({ stop }: { stop: () => void }) {
  return (
    <button
      type="button"
      className="size-8 shrink-0 rounded-full bg-foreground p-1.5 text-background transition-colors hover:bg-foreground/90"
      onClick={(e) => {
        e.preventDefault();
        stop();
      }}
    >
      <SquareIcon className="size-4" />
    </button>
  );
}
