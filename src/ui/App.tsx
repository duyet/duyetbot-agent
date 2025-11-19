/**
 * Main Terminal UI Application
 *
 * Interactive CLI similar to Claude Code
 */

import type { Agent } from '@/agent/core';
import type { Session } from '@/agent/session';
import type { LLMMessage } from '@/providers/types';
import { Box, Text, useApp, useInput } from 'ink';
import React, { useEffect, useState } from 'react';
import { ChatView } from './components/ChatView';
import { InputBox } from './components/InputBox';
import { StatusBar } from './components/StatusBar';
import type { UIConfig } from './config';
import { defaultConfig } from './config';

interface AppProps {
  agent: Agent;
  config?: Partial<UIConfig>;
}

export const App: React.FC<AppProps> = ({ agent, config: userConfig }) => {
  const { exit } = useApp();
  const config = { ...defaultConfig, ...userConfig };

  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<LLMMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize session
  useEffect(() => {
    const initSession = async () => {
      try {
        const newSession = await agent.createSession({
          metadata: {
            title: config.defaultSessionTitle,
            createdAt: new Date().toISOString(),
          },
        });

        setSession(newSession);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create session');
      }
    };

    initSession();
  }, [agent, config.defaultSessionTitle]);

  // Handle keyboard shortcuts
  useInput((input, key) => {
    // Ctrl+C to exit
    if (key.ctrl && input === 'c') {
      exit();
    }

    // Ctrl+L to clear messages
    if (key.ctrl && input === 'l') {
      setMessages([]);
    }

    // Ctrl+N to create new session
    if (key.ctrl && input === 'n') {
      handleNewSession();
    }
  });

  const handleNewSession = async () => {
    try {
      const newSession = await agent.createSession({
        metadata: {
          title: config.defaultSessionTitle,
          createdAt: new Date().toISOString(),
        },
      });

      setSession(newSession);
      setMessages([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session');
    }
  };

  const handleSubmit = async (message: string) => {
    if (!session || !message.trim() || isStreaming) {
      return;
    }

    setInput('');
    setIsStreaming(true);

    // Add user message
    const userMessage: LLMMessage = { role: 'user', content: message };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);

    // Save user message
    await agent.addMessage(session.id, userMessage);

    try {
      // Stream assistant response
      let assistantContent = '';
      const assistantMessage: LLMMessage = { role: 'assistant', content: '' };

      for await (const chunk of agent.sendMessage(session.id, newMessages)) {
        if (chunk.content) {
          assistantContent += chunk.content;
          assistantMessage.content = assistantContent;
          setMessages([...newMessages, assistantMessage]);
        }
      }

      // Save assistant message
      if (assistantContent) {
        await agent.addMessage(session.id, {
          role: 'assistant',
          content: assistantContent,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsStreaming(false);
    }
  };

  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red" bold>
          Error: {error}
        </Text>
        <Text dimColor>Press {config.shortcuts.exit} to exit</Text>
      </Box>
    );
  }

  if (!session) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text>Initializing {config.appName}...</Text>
      </Box>
    );
  }

  const sessionTitle = (session.metadata?.title as string) || session.id;
  const modelName = config.defaultModel;

  return (
    <Box flexDirection="column" height="100%">
      {/* Status Bar */}
      <StatusBar
        appName={config.appName}
        sessionTitle={sessionTitle}
        model={modelName}
        isStreaming={isStreaming}
      />

      {/* Chat View */}
      <Box flexGrow={1} flexDirection="column">
        <ChatView messages={messages} isStreaming={isStreaming} appName={config.appName} />
      </Box>

      {/* Input Box */}
      <InputBox
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        isStreaming={isStreaming}
      />

      {/* Help Text */}
      <Box paddingX={1} borderStyle="single" borderTop={false}>
        <Text dimColor>
          {config.shortcuts.exit}: exit | {config.shortcuts.clear}: clear |{' '}
          {config.shortcuts.newSession}: new session
        </Text>
      </Box>
    </Box>
  );
};
