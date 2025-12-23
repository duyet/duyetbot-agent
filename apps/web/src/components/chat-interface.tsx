'use client';

import type { Message } from '@ai-sdk/react';
import { useChat } from '@ai-sdk/react';
import { LogOut, MessageSquare, Plus, Send, Settings, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { SessionUser } from '../lib/session';
import { Button } from './ui/button';

interface ChatInterfaceProps {
  user: SessionUser;
}

export function ChatInterface({ user }: ChatInterfaceProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [model, setModel] = useState('anthropic/claude-3.5-sonnet');
  const [currentSessionId, setCurrentSessionId] = useState(() => {
    const sessionMatch = window.location.hash.match(/#session=([^&]+)/);
    return sessionMatch ? sessionMatch[1] : crypto.randomUUID();
  });

  const { messages, input, setInput, stop, status, append, setMessages, error } = useChat({
    api: '/api/chat',
    body: {
      model,
      userId: user.id,
      sessionId: currentSessionId,
    },
    experimental_throttle: 50,
  });

  const handleSendMessage = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || status !== 'ready') {
        return;
      }

      await append({ content: input.trim(), role: 'user' });
    },
    [input, append, status]
  );

  const handleNewChat = useCallback(() => {
    const newSessionId = crypto.randomUUID();
    setCurrentSessionId(newSessionId);
    window.location.hash = `#session=${newSessionId}`;
    setMessages([]);
  }, [setMessages]);

  const handleLogout = useCallback(() => {
    window.location.href = '/api/auth/logout';
  }, []);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 transform border-r border-gray-200 bg-white transition-transform duration-200 ease-in-out lg:relative lg:transform-none ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Chat History</h2>
            <Button variant="ghost" size="sm" onClick={handleNewChat} className="hidden lg:flex">
              <Plus className="h-4 w-4 mr-2" />
              New Chat
            </Button>
          </div>

          {/* Sessions List */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleNewChat}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleNewChat();
                  }
                }}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 transition-colors text-left"
              >
                <MessageSquare className="h-5 w-5 text-gray-400" />
                <span className="text-sm text-gray-700">New Chat</span>
              </button>
            </div>
          </div>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center gap-3">
              {user.avatarUrl && (
                <div
                  style={{ backgroundImage: `url(${user.avatarUrl})` }}
                  className="h-8 w-8 rounded-full bg-cover bg-center"
                  role="img"
                  aria-label={user.login}
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user.name ?? user.login}
                </p>
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Sidebar Overlay (mobile) */}
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => {
            setSidebarOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setSidebarOpen(false);
            }
          }}
          aria-label="Close sidebar"
        />
      )}

      {/* Main Content */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden"
            >
              <MessageSquare className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold text-gray-900">DuyetBot Chat</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(!settingsOpen)}>
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Error Display */}
        {error && (
          <div className="mx-auto max-w-4xl p-4">
            <div className="rounded-lg border border-red-300 bg-red-50 p-4">
              <p className="text-sm text-red-800">{error.message}</p>
            </div>
          </div>
        )}

        {/* Settings Panel */}
        {settingsOpen && (
          <div className="border-b border-gray-200 bg-white px-4 py-4 lg:px-6">
            <div className="max-w-xl">
              <label htmlFor="model" className="block text-sm font-medium text-gray-700 mb-2">
                Model ID
              </label>
              <input
                id="model"
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Enter OpenRouter model ID (e.g., anthropic/claude-3.5-sonnet)"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Any OpenRouter model ID (e.g., anthropic/claude-3.5-sonnet, openai/gpt-4o,
                google/gemini-pro)
              </p>
            </div>
          </div>
        )}

        {/* Status Indicator */}
        {!error && (
          <div className="px-4 py-2 lg:px-6">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                status === 'ready'
                  ? 'bg-green-100 text-green-800'
                  : status === 'submitted'
                    ? 'bg-blue-100 text-blue-800'
                    : status === 'streaming'
                      ? 'bg-purple-100 text-purple-800'
                      : status === 'error'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-800'
              }`}
            >
              {status === 'ready' && 'Ready'}
              {status === 'submitted' && 'Processing'}
              {status === 'streaming' && 'Streaming'}
              {status === 'error' && 'Error'}
            </span>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 lg:px-6">
          <div className="mx-auto max-w-4xl space-y-6">
            {messages.length === 0 ? (
              <div className="flex h-[calc(100vh-20rem)] items-center justify-center">
                <div className="text-center">
                  <MessageSquare className="mx-auto mb-4 h-16 w-16 text-gray-300" />
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">Start a conversation</h2>
                  <p className="text-sm text-gray-500">
                    Ask me anything and I'll help you with your tasks
                  </p>
                </div>
              </div>
            ) : (
              messages.map((message) => <MessageItem key={message.id} message={message} />)
            )}
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-200 bg-white px-4 py-4 lg:px-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSendMessage(e);
            }}
            className="mx-auto max-w-4xl"
          >
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e);
                    }
                  }}
                  placeholder="Type your message..."
                  rows={1}
                  disabled={status !== 'ready'}
                  className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 pr-12 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              <div className="flex gap-2">
                {status === 'streaming' || status === 'submitted' ? (
                  <Button type="button" onClick={stop} size="lg">
                    <X className="h-5 w-5" />
                  </Button>
                ) : (
                  <Button type="submit" disabled={!input.trim() || status !== 'ready'} size="lg">
                    <Send className="h-5 w-5" />
                  </Button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

interface MessageItemProps {
  message: Message;
}

function MessageItem({ message }: MessageItemProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-gray-900 text-white'
            : 'bg-white border border-gray-200 text-gray-900 shadow-sm'
        }`}
      >
        {/* Message Content */}
        <div className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</div>

        {/* Tool Calls (for assistant messages) */}
        {message.parts?.map((part, index) => {
          if (part.type === 'tool-invocation') {
            return (
              <div key={index} className="mt-2 rounded-lg bg-blue-50 border border-blue-100 p-3">
                <div className="flex items-center gap-2 text-xs font-medium text-blue-700 mb-1">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-label="Tool call icon"
                  >
                    <title>Tool Call</title>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 00-1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.065 2.573c.94 1.543-.826 3.31 2.37 2.37a1.724 1.724 0 00-1.065 2.572c1.756-.426 1.756 2.924 0 3.35a1.724 1.724 0 00-2.572 1.066c-.94 1.543-.826 3.31 2.37 2.37a1.724 1.724 0 00-1.065 2.572c1.756.426 1.756 2.924 0 3.35 0a1.724 1.724 0 001.065 2.573c.94 1.543-.826 3.31 2.37 2.37a1.724 1.724 0 00-1.065 2.572c.94 1.543-.826 3.31 2.37a1.724 1.724 0 00-1.066 2.572c1.756-.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.065 2.572c.94 1.543-.826 3.31 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-2.572 1.066c1.543.94 3.31-.826 2.37 2.37a1.724 1.724 0 00-1.066 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.065 2.572c1.756-.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.065 2.572c.94 1.543-.826 3.31 2.37 2.37 2.37a1.724 1.724 0 00-2.573 1.065z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  {(part as any).toolName}
                </div>
                <pre className="text-xs text-gray-600 overflow-x-auto">
                  {typeof (part as any).args === 'string'
                    ? (part as any).args
                    : JSON.stringify((part as any).args, null, 2)}
                </pre>
              </div>
            );
          }
          return null;
        })}

        {/* Usage Display */}
        {message.annotations && message.annotations.length > 0 && (
          <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
            <span>Prompt: {(message.annotations[0] as any).promptTokens} tokens</span>
            <span>•</span>
            <span>Completion: {(message.annotations[0] as any).completionTokens} tokens</span>
            <span>•</span>
            <span>Total: {(message.annotations[0] as any).totalTokens} tokens</span>
          </div>
        )}
      </div>
    </div>
  );
}
