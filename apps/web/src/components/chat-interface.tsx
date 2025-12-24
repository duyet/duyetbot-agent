'use client';

import { useChat } from '@ai-sdk/react';
import type { UIMessage } from 'ai';
import { DefaultChatTransport } from 'ai';
import { Bot, LogOut, MessageSquare, Plus, Send, Settings, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { AVAILABLE_TOOLS, getDefaultSubAgent } from '@/app/api/lib/sub-agents';
import { DEFAULT_MODEL } from '@/app/api/models/route';
import type { SessionUser } from '../lib/session';
import { SettingsModal } from './SettingsModal';
import { Button } from './ui/button';

interface ChatInterfaceProps {
  user: SessionUser;
}

// localStorage keys
const STORAGE_KEYS = {
  MODEL: 'duyetbot-chat-model',
  MODE: 'duyetbot-chat-mode',
  TOOLS: 'duyetbot-enabled-tools',
  SUB_AGENT: 'duyetbot-sub-agent',
} as const;

export function ChatInterface({ user }: ChatInterfaceProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Initialize state from localStorage or defaults
  const [mode, setMode] = useState<'chat' | 'agent'>(() => {
    return (localStorage.getItem(STORAGE_KEYS.MODE) as 'chat' | 'agent') || 'chat';
  });

  const [model, setModel] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.MODEL) || DEFAULT_MODEL;
  });

  const [enabledTools, setEnabledTools] = useState<string[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.TOOLS);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return AVAILABLE_TOOLS.map((t) => t.id);
      }
    }
    return AVAILABLE_TOOLS.map((t) => t.id);
  });

  const [subAgentId, setSubAgentId] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.SUB_AGENT) || getDefaultSubAgent().id;
  });

  const [currentSessionId, setCurrentSessionId] = useState(() => {
    const sessionMatch = window.location.hash.match(/#session=([^&]+)/);
    return sessionMatch ? sessionMatch[1] : crypto.randomUUID();
  });
  const [input, setInput] = useState('');

  // Save mode to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MODE, mode);
  }, [mode]);

  const { messages, status, sendMessage, setMessages, error } = useChat({
    transport: new DefaultChatTransport({
      api: mode === 'agent' ? '/api/agent' : '/api/chat',
      body: {
        model,
        userId: user.id,
        mode,
        enabledTools: mode === 'agent' ? enabledTools : [],
        subAgentId: mode === 'agent' ? subAgentId : undefined,
      },
    }),
  });

  const handleSendMessage = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || status !== 'ready') {
        return;
      }

      sendMessage({ text: input.trim() }, { body: { sessionId: currentSessionId } });
      setInput('');
    },
    [input, sendMessage, status, currentSessionId]
  );

  const handleNewChat = useCallback(() => {
    const newSessionId = crypto.randomUUID();
    setCurrentSessionId(newSessionId);
    window.location.hash = `#session=${newSessionId}`;
    setMessages([]);
  }, [setMessages]);

  const handleModeChange = useCallback(
    (newMode: 'chat' | 'agent') => {
      if (newMode === mode) {
        return;
      }

      // Clear messages and create new session when switching modes
      setMode(newMode);
      setMessages([]);
      const newSessionId = crypto.randomUUID();
      setCurrentSessionId(newSessionId);
      window.location.hash = `#session=${newSessionId}`;
    },
    [mode, setMessages]
  );

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
            <h1 className="text-lg font-semibold text-gray-900">duyetbot</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => handleModeChange('chat')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    mode === 'chat'
                      ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-gray-100'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}
                >
                  <MessageSquare className="h-4 w-4" />
                  Chat
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange('agent')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    mode === 'agent'
                      ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-gray-100'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}
                >
                  <Bot className="h-4 w-4" />
                  Agent
                </button>
              </div>
              <div className="text-xs text-gray-500 text-right">
                {mode === 'chat'
                  ? 'Dialogue mode - detailed explanations'
                  : 'Agent mode - proactive task execution'}
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(true)}>
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

        {/* Settings Modal */}
        <SettingsModal
          model={model}
          onModelChange={setModel}
          mode={mode}
          enabledTools={enabledTools}
          onEnabledToolsChange={setEnabledTools}
          subAgentId={subAgentId}
          onSubAgentIdChange={setSubAgentId}
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
        />

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
            {mode === 'agent' && (
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                <span>{enabledTools.length} tools enabled</span>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="underline hover:text-gray-700"
                >
                  Configure
                </button>
              </div>
            )}
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
                  <Button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      // TODO: implement stop
                    }}
                    size="lg"
                  >
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
  message: UIMessage;
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
        {message.parts.map((part, index) => {
          if (part.type === 'text') {
            return (
              <div key={index} className="whitespace-pre-wrap text-sm leading-relaxed">
                {part.text}
              </div>
            );
          }
          return null;
        })}

        {/* Tool Calls (for assistant messages) */}
        {message.parts?.map((part, index) => {
          if (part.type.startsWith('tool-')) {
            const toolPart = part as { toolCallId?: string; toolName?: string; args?: unknown };
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
                  {toolPart.toolName ?? 'Tool'}
                </div>
                <pre className="text-xs text-gray-600 overflow-x-auto">
                  {typeof toolPart.args === 'string'
                    ? toolPart.args
                    : JSON.stringify(toolPart.args, null, 2)}
                </pre>
              </div>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}
