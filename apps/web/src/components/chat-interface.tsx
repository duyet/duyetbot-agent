'use client';

import { useChat } from '@ai-sdk/react';
import type { UIMessage } from 'ai';
import { DefaultChatTransport } from 'ai';
import {
  ArrowDown,
  Bot,
  ChevronLeft,
  ChevronRight,
  Copy,
  Globe,
  LogOut,
  MessageSquare,
  Plus,
  RefreshCw,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Type,
  Wand2,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { AVAILABLE_TOOLS, getDefaultSubAgent, DEFAULT_MODEL } from '@/lib/constants';
import type { SessionUser } from '../lib/session';
import { SettingsModal } from './SettingsModal';
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from './ai-elements/conversation';
import {
  Message,
  MessageContent,
  MessageActions,
  MessageAction,
} from './ai-elements/message';
import {
  PromptInput,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputActionAddAttachments,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage,
} from './ai-elements/prompt-input';
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
  SIDEBAR: 'duyetbot-sidebar-open',
} as const;

export function ChatInterface({ user }: ChatInterfaceProps) {
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SIDEBAR);
    return saved !== 'false';
  });
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

  // Save mode to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MODE, mode);
  }, [mode]);

  // Save sidebar state to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SIDEBAR, String(sidebarOpen));
  }, [sidebarOpen]);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen(prev => !prev);
  }, []);

  const { messages, status, sendMessage, setMessages, error, regenerate } = useChat({
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

  const handleSubmit = useCallback(
    (message: PromptInputMessage, _event: FormEvent<HTMLFormElement>) => {
      const hasText = Boolean(message.text);
      const hasAttachments = Boolean(message.files?.length);

      if (!(hasText || hasAttachments)) {
        return;
      }

      sendMessage(
        {
          text: message.text || 'Sent with attachments',
          files: message.files,
        },
        { body: { sessionId: currentSessionId } }
      );
    },
    [sendMessage, currentSessionId]
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

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
  }, []);

  const isStreaming = status === 'streaming' || status === 'submitted';
  const hasMessages = messages.length > 0;

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar - Collapsible on desktop, slide-over on mobile */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 transition-all duration-300 ease-in-out
          lg:relative lg:z-auto
          ${sidebarOpen ? 'w-72 translate-x-0' : 'w-16 -translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="flex h-full flex-col border-r border-border bg-card">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            {sidebarOpen ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent/80 shadow-lg shadow-accent/20">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <h2 className="text-sm font-semibold tracking-tight">duyetbot</h2>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleNewChat}
                  className="hidden lg:flex"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New
                </Button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleNewChat}
                className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent/80 shadow-lg shadow-accent/20 hover:shadow-accent/30 transition-shadow"
                title="New conversation"
              >
                <Plus className="h-4 w-4 text-white" />
              </button>
            )}
          </div>

          {/* Sessions List */}
          <div className="flex-1 overflow-y-auto p-3">
            <div className="space-y-1">
              {sidebarOpen ? (
                <button
                  type="button"
                  onClick={handleNewChat}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors text-left group"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/50 group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium">New Conversation</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleNewChat}
                  className="w-full flex items-center justify-center p-2 rounded-xl hover:bg-muted/50 transition-colors"
                  title="New conversation"
                >
                  <MessageSquare className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>

          {/* Sidebar Footer */}
          <div className="p-3 border-t border-border">
            {sidebarOpen ? (
              <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/30 transition-colors">
                {user.avatarUrl && (
                  <div
                    style={{ backgroundImage: `url(${user.avatarUrl})` }}
                    className="h-9 w-9 rounded-full bg-cover bg-center ring-2 ring-border/50"
                    role="img"
                    aria-label={user.login}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user.name ?? user.login}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleLogout}
                  title="Log out"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {user.avatarUrl && (
                  <div
                    style={{ backgroundImage: `url(${user.avatarUrl})` }}
                    className="mx-auto h-9 w-9 rounded-full bg-cover bg-center ring-2 ring-border/50"
                    role="img"
                    aria-label={user.login}
                  />
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleLogout}
                  className="mx-auto"
                  title="Log out"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Sidebar Overlay (mobile) */}
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-foreground/10 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
        />
      )}

      {/* Main Content */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-border bg-card/80 backdrop-blur-sm px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={toggleSidebar}
              className="hidden lg:flex"
              title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              {sidebarOpen ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={toggleSidebar}
              className="lg:hidden"
            >
              {sidebarOpen ? <ArrowDown className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
            </Button>
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent/80">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <h1 className="text-sm font-semibold tracking-tight">duyetbot</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mode Toggle */}
            <div className="hidden sm:flex items-center gap-1 p-1 rounded-xl bg-muted/40 border border-border/50">
              <button
                type="button"
                onClick={() => handleModeChange('chat')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                  mode === 'chat'
                    ? 'bg-background shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Chat</span>
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('agent')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                  mode === 'agent'
                    ? 'bg-background shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Bot className="h-3.5 w-3.5" />
                <span>Agent</span>
              </button>
            </div>

            {/* Mobile Mode Toggle - Icons only */}
            <div className="sm:hidden flex items-center gap-1 p-1 rounded-xl bg-muted/40 border border-border/50">
              <button
                type="button"
                onClick={() => handleModeChange('chat')}
                className={`flex items-center justify-center p-2 rounded-lg transition-all duration-200 ${
                  mode === 'chat'
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Chat mode"
              >
                <MessageSquare className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('agent')}
                className={`flex items-center justify-center p-2 rounded-lg transition-all duration-200 ${
                  mode === 'agent'
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Agent mode"
              >
                <Bot className="h-4 w-4" />
              </button>
            </div>

            <div className="w-px h-6 bg-border/50 mx-1" />

            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setSettingsOpen(true)}
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Error Display */}
        {error && (
          <div className="mx-auto max-w-4xl px-4 py-3">
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/50">
              <p className="text-sm text-red-800 dark:text-red-400">{error.message}</p>
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

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden">
          <Conversation className="h-full">
            <ConversationContent>
              {hasMessages ? (
                messages.map((message, index) => (
                  <MessageComponent
                    key={message.id}
                    message={message}
                    isLast={index === messages.length - 1}
                    onCopy={handleCopy}
                    onRegenerate={regenerate}
                    showRegenerate={index === messages.length - 1 && message.role === 'assistant' && status === 'ready'}
                    isStreaming={status === 'streaming' && index === messages.length - 1}
                  />
                ))
              ) : (
                <WelcomeState
                  mode={mode}
                  enabledToolsCount={enabledTools.length}
                  onOpenSettings={() => setSettingsOpen(true)}
                />
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>
        </div>

        {/* Input Area */}
        <div className="border-t border-border/50 bg-background/95 backdrop-blur-sm px-4 py-4 lg:px-6">
          <div className="mx-auto max-w-3xl">
            {hasMessages && mode === 'agent' && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 px-1">
                <Wand2 className="h-3 w-3" />
                <span>{enabledTools.length} tools enabled</span>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="text-accent hover:underline"
                >
                  Configure
                </button>
              </div>
            )}

            <PromptInput
              onSubmit={handleSubmit}
              className="relative"
              multiple
              globalDrop
            >
              <PromptInputBody>
                <PromptInputTextarea
                  placeholder={
                    mode === 'chat'
                      ? 'Ask me anything...'
                      : 'Describe a task and I will help you complete it...'
                  }
                />
              </PromptInputBody>

              <PromptInputFooter>
                <PromptInputTools>
                  <PromptInputActionMenu>
                    <PromptInputActionMenuTrigger>
                      <Plus className="size-4" />
                    </PromptInputActionMenuTrigger>
                    <PromptInputActionMenuContent>
                      <PromptInputActionAddAttachments />
                    </PromptInputActionMenuContent>
                  </PromptInputActionMenu>
                </PromptInputTools>

                <PromptInputSubmit
                  status={status}
                  className="shrink-0"
                />
              </PromptInputFooter>
            </PromptInput>
          </div>
        </div>
      </div>
    </div>
  );
}

// Welcome / Landing State Component
function WelcomeState({
  mode,
  enabledToolsCount,
  onOpenSettings,
}: {
  mode: 'chat' | 'agent';
  enabledToolsCount: number;
  onOpenSettings: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center animate-fade-in">
      {/* Hero Icon */}
      <div className="relative mb-10">
        <div className="absolute inset-0 bg-accent/10 blur-3xl rounded-full animate-pulse" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-accent via-accent/90 to-accent/70 shadow-xl shadow-accent/20">
          <Sparkles className="h-10 w-10 text-white" />
        </div>
      </div>

      {/* Welcome Message */}
      <h2 className="text-2xl font-semibold mb-3 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
        Welcome to duyetbot
      </h2>
      <p className="text-sm text-muted-foreground max-w-md mb-10 leading-relaxed">
        {mode === 'chat'
          ? 'Start a conversation and ask me anything. I provide detailed explanations and thoughtful responses.'
          : 'Describe a task and I will help you complete it proactively using available tools and capabilities.'}
      </p>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl w-full mb-10">
        <FeatureCard
          icon={<Type className="h-5 w-5" />}
          title="Natural Conversations"
          description="Chat naturally with detailed, contextual responses"
        />
        <FeatureCard
          icon={<Zap className="h-5 w-5" />}
          title="Smart Agent Mode"
          description="Proactive task execution with powerful tools"
        />
        <FeatureCard
          icon={<SlidersHorizontal className="h-5 w-5" />}
          title="Fully Customizable"
          description="Configure models, tools, and behavior to your needs"
        />
      </div>

      {/* Agent Mode Info */}
      {mode === 'agent' && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/40 border border-border/50">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
            <Wand2 className="h-5 w-5 text-accent" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium">{enabledToolsCount} tools enabled</p>
            <p className="text-xs text-muted-foreground">
              Customize which tools the agent can use
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenSettings}
            className="ml-auto"
          >
            Configure
          </Button>
        </div>
      )}

      {/* Quick Start Suggestions */}
      <div className="mt-10">
        <p className="text-xs text-muted-foreground/80 mb-4 font-medium tracking-wide uppercase">Try asking about</p>
        <div className="flex flex-wrap justify-center gap-2">
          <SuggestionChip icon={<Globe className="h-3 w-3" />} text="Latest tech news" />
          <SuggestionChip icon={<Zap className="h-3 w-3" />} text="Code review" />
          <SuggestionChip icon={<Type className="h-3 w-3" />} text="Write documentation" />
        </div>
      </div>
    </div>
  );
}

// Feature Card Component
function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center p-5 rounded-2xl border border-border/50 bg-card/50 hover:bg-card hover:border-border/70 transition-all duration-300 hover-lift">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-accent/10 to-accent/5 mb-4">
        <div className="text-accent">{icon}</div>
      </div>
      <h3 className="text-sm font-semibold mb-2">{title}</h3>
      <p className="text-xs text-muted-foreground text-center leading-relaxed">{description}</p>
    </div>
  );
}

// Suggestion Chip Component
function SuggestionChip({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <button
      type="button"
      className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium border border-border/50 bg-muted/30 hover:bg-muted hover:border-border transition-all duration-200 hover-lift"
    >
      {icon}
      {text}
    </button>
  );
}

interface MessageComponentProps {
  message: UIMessage;
  isLast: boolean;
  onCopy: (text: string) => void;
  onRegenerate: () => void;
  showRegenerate: boolean;
  isStreaming: boolean;
}

function MessageComponent({
  message,
  isLast,
  onCopy,
  onRegenerate,
  showRegenerate,
  isStreaming,
}: MessageComponentProps) {
  const isUser = message.role === 'user';
  const textContent =
    message.parts.find((p) => p.type === 'text')?.text ?? '';

  const toolCalls = message.parts.filter((p) => p.type.startsWith('tool-'));

  return (
    <Message from={message.role}>
      <MessageContent>
        {/* Text Content */}
        {textContent && (
          <div className="whitespace-pre-wrap text-sm leading-relaxed">
            {textContent}
          </div>
        )}

        {/* Tool Calls */}
        {toolCalls.length > 0 && (
          <div className="mt-3 space-y-2">
            {toolCalls.map((part, index) => {
              if (!part.type.startsWith('tool-')) return null;

              const toolPart = part as {
                toolName?: string;
                args?: unknown;
              };

              return (
                <div
                  key={index}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted/60 border border-border/60 text-xs font-medium"
                >
                  <Wand2 className="h-3.5 w-3.5 text-accent" />
                  <span>{toolPart.toolName ?? 'Tool'}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Streaming Indicator */}
        {isStreaming && (
          <div className="flex items-center gap-1.5 mt-3">
            <div className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        )}
      </MessageContent>

      {/* Message Actions */}
      {isLast && !isUser && !isStreaming && (
        <MessageActions className="mt-2">
          {showRegenerate && (
            <MessageAction
              onClick={onRegenerate}
              label="Regenerate"
              tooltip="Regenerate response"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </MessageAction>
          )}
          {textContent && (
            <MessageAction
              onClick={() => onCopy(textContent)}
              label="Copy"
              tooltip="Copy to clipboard"
            >
              <Copy className="h-3.5 w-3.5" />
            </MessageAction>
          )}
        </MessageActions>
      )}
    </Message>
  );
}
