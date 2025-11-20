/**
 * Main App Component
 *
 * Ink-based chat application
 */

import type { LLMMessage } from '@duyetbot/types';
import { Box } from 'ink';
import React, { useState, useCallback } from 'react';
import { FileSessionManager } from '../sessions.js';
import { ChatView } from './ChatView.js';
import { StatusBar } from './StatusBar.js';

export interface AppProps {
  sessionId?: string;
  mode: 'local' | 'cloud';
  sessionsDir: string;
  mcpServerUrl?: string;
}

export function App({
  sessionId: initialSessionId,
  mode,
  sessionsDir,
}: AppProps): React.ReactElement {
  const [messages, setMessages] = useState<LLMMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const [sessionManager] = useState(() => new FileSessionManager(sessionsDir));

  // Initialize session
  React.useEffect(() => {
    const initSession = async (): Promise<void> => {
      if (initialSessionId) {
        const session = await sessionManager.getSession(initialSessionId);
        if (session) {
          setMessages(session.messages);
          setSessionId(session.id);
        }
      } else {
        const session = await sessionManager.createSession({
          title: `Chat ${new Date().toISOString()}`,
        });
        setSessionId(session.id);
      }
    };
    initSession();
  }, [initialSessionId, sessionManager]);

  const handleSendMessage = useCallback(
    async (content: string): Promise<void> => {
      if (!sessionId) {
        return;
      }

      // Add user message
      const userMessage: LLMMessage = { role: 'user', content };
      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setIsLoading(true);

      try {
        // Generate response (placeholder - would call LLM)
        await new Promise((resolve) => setTimeout(resolve, 500));
        const response = `[Echo] ${content}`;

        // Add assistant message
        const assistantMessage: LLMMessage = { role: 'assistant', content: response };
        const finalMessages = [...updatedMessages, assistantMessage];
        setMessages(finalMessages);

        // Save to session
        await sessionManager.updateSession(sessionId, {
          messages: finalMessages,
        });
      } finally {
        setIsLoading(false);
      }
    },
    [messages, sessionId, sessionManager]
  );

  const statusBarProps = {
    mode,
    messageCount: messages.length,
    connected: true as const,
    ...(sessionId ? { sessionId } : {}),
  };

  const chatViewProps = {
    messages,
    onSendMessage: handleSendMessage,
    isLoading,
    mode,
    ...(sessionId ? { sessionId } : {}),
  };

  return (
    <Box flexDirection="column">
      <StatusBar {...statusBarProps} />
      <ChatView {...chatViewProps} />
    </Box>
  );
}

export default App;
