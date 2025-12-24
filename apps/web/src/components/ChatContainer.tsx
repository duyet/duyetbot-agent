/**
 * ChatContainer Component
 *
 * Main chat interface using @ai-sdk/react useChat hook.
 * Provides message input, send button, and connects to /api/chat endpoint.
 */

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Loader2, Send } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useProgressStream } from '../hooks/useProgressStream';
import { MessageList } from './MessageList';
import { ProgressBar } from './ProgressBar';

/**
 * Props for ChatContainer component
 */
interface ChatContainerProps {
  /** Current session ID */
  sessionId: string;
  /** Optional CSS class name */
  className?: string;
}

/**
 * Main chat container with input and message display.
 *
 * Uses @ai-sdk/react useChat hook for streaming responses and
 * useProgressStream for real-time execution progress.
 *
 * @example
 * ```tsx
 * <ChatContainer
 *   sessionId="session-123"
 * />
 * ```
 */
export function ChatContainer({ sessionId, className = '' }: ChatContainerProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');

  // Chat hook from @ai-sdk/react
  const {
    messages,
    status,
    sendMessage,
    error: chatError,
  } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
    }),
  });

  // Progress stream for execution steps
  const { steps, connectionState, isComplete } = useProgressStream(sessionId);

  /**
   * Auto-scroll to bottom when new messages arrive
   */
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  /**
   * Handle form submission
   */
  const onSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!input.trim() || status !== 'ready') {
        return;
      }
      sendMessage({ text: input }, { body: { sessionId } });
      setInput('');
    },
    [input, status, sendMessage, sessionId]
  );

  /**
   * Get current progress state for progress bar
   */
  const getCurrentStep = useCallback((): { label: string; isActive: boolean } | null => {
    if (steps.length === 0) {
      return null;
    }

    const lastStep = steps[steps.length - 1];

    switch (lastStep.type) {
      case 'thinking':
        return { label: 'Thinking...', isActive: true };
      case 'tool_start':
        return { label: `Running ${lastStep.toolName}...`, isActive: true };
      case 'tool_complete':
        return { label: `${lastStep.toolName} completed`, isActive: false };
      case 'tool_error':
        return { label: `${lastStep.toolName} failed`, isActive: false };
      case 'tool_execution':
        return { label: `Executing ${lastStep.toolName}...`, isActive: true };
      case 'preparing':
        return { label: 'Preparing response...', isActive: true };
      case 'responding':
        return { label: 'Sending response...', isActive: true };
      default:
        return null;
    }
  }, [steps]);

  const currentStep = getCurrentStep();
  const isChatLoading = status === 'streaming' || status === 'submitted';

  return (
    <div className={`flex flex-col h-full bg-white dark:bg-gray-950 ${className}`}>
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        <MessageList
          messages={messages.map((msg) => ({
            role: msg.role as 'user' | 'assistant' | 'system',
            content: msg.parts
              .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
              .map((part) => part.text)
              .join(''),
          }))}
        />

        {/* Progress indicator during tool execution */}
        {isChatLoading && currentStep && (
          <div className="px-4 py-2">
            <ProgressBar currentStep={currentStep.label} isActive={currentStep.isActive} />
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Error Display */}
      {chatError && (
        <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400">Error: {chatError.message}</p>
        </div>
      )}

      {/* Input Form */}
      <div className="border-t border-gray-200 dark:border-gray-800 p-4">
        <form onSubmit={onSubmit} className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={isChatLoading}
            className="
              flex-1 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700
              bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100
              placeholder:text-gray-400 dark:placeholder:text-gray-500
              focus:outline-none focus:ring-2 focus:ring-blue-500
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-shadow
            "
          />

          <button
            type="submit"
            disabled={!input.trim() || isChatLoading}
            className="
              px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white
              disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center gap-2 font-medium
              transition-colors
            "
            aria-label="Send message"
          >
            {isChatLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>

        {/* Connection Status */}
        <div className="mt-2 text-xs text-gray-400 dark:text-gray-500">
          {connectionState === 'connecting' && 'Connecting to progress stream...'}
          {connectionState === 'connected' && 'Live progress connected'}
          {connectionState === 'disconnected' && isComplete && 'Response complete'}
          {connectionState === 'error' && 'Progress connection error'}
        </div>
      </div>
    </div>
  );
}
