'use client';

import { useChat } from '@ai-sdk/react';
import type { LLMMessage } from '@duyetbot/types';
import type { UIMessage } from 'ai';
import { DefaultChatTransport } from 'ai';
import {
  ArrowDown,
  Bot,
  ChevronLeft,
  ChevronRight,
  Copy,
  MessageSquare,
  Plus,
  RefreshCw,
  Settings,
  Sparkles,
  Wand2,
} from 'lucide-react';
import type { FormEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useArtifact } from '@/hooks/use-artifact';
import { useChatSession } from '@/hooks/use-chat-session';
import { useLandingState } from '@/hooks/use-landing-state';
import {
  AVAILABLE_TOOLS,
  DEFAULT_MODEL,
  getDefaultSubAgent,
  type SubAgentId,
} from '@/lib/constants';
import { useSettings } from '@/lib/use-settings';
import type { SessionUser } from '../lib/session';
import {
  Artifact,
  ArtifactAction,
  ArtifactActions,
  ArtifactClose,
  ArtifactContent,
  ArtifactHeader,
  ArtifactTitle,
} from './ai-elements/artifact';
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from './ai-elements/conversation';
import { Message, MessageAction, MessageActions, MessageContent } from './ai-elements/message';
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
import { LandingState } from './landing';
import { SessionSidebar } from './SessionSidebar';
import { SettingsModal } from './SettingsModal';
import { Button } from './ui/button';

interface ChatInterfaceProps {
  user: SessionUser;
}

// localStorage keys
const STORAGE_KEYS = {
  MODE: 'duyetbot-chat-mode',
  SIDEBAR: 'duyetbot-sidebar-open',
} as const;

export function ChatInterface({ user }: ChatInterfaceProps) {
  // Settings from API
  const { settings } = useSettings();

  // Artifact state
  const { artifact, resetArtifact } = useArtifact();

  // Session management with URL sync
  const {
    sessionId: currentSessionId,
    isLoadingSession,
    sessionMessages,
    sessionTitle,
    setSessionId,
    createNewSession,
    error: sessionError,
  } = useChatSession();

  // Track if we need to update URL after first message
  const hasUpdatedUrlRef = useRef(false);
  // Track pending session ID for new chats
  const pendingSessionIdRef = useRef<string | null>(null);

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SIDEBAR);
    return saved !== 'false';
  });
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Initialize mode from localStorage or defaults
  const [mode, setMode] = useState<'chat' | 'agent'>(() => {
    return (localStorage.getItem(STORAGE_KEYS.MODE) as 'chat' | 'agent') || 'chat';
  });

  // Sessions list state (for sidebar - kept separate from current session)
  const [sessions, setSessions] = useState<
    Array<{
      id: string;
      chatId: string;
      title?: string;
      createdAt: number;
      updatedAt: number;
      messageCount: number;
      preview?: string;
      state: 'active' | 'paused' | 'completed' | 'expired';
      messages: LLMMessage[];
      metadata: Record<string, unknown>;
    }>
  >([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);

  // Derived state from settings
  const model = settings?.defaultModel ?? DEFAULT_MODEL;
  const enabledTools = settings?.enabledTools ?? AVAILABLE_TOOLS.map((t) => t.id);

  // Selected agent state (controlled locally, syncs with settings)
  const [selectedAgent, setSelectedAgent] = useState<SubAgentId>(
    () => (settings?.theme as SubAgentId) ?? getDefaultSubAgent().id
  );

  // Ref for prompt input to support prompt insertion from quick actions
  const [pendingPrompt, setPendingPrompt] = useState<string>('');

  // Landing state for search/deep think/MCP toggles
  const landingState = useLandingState();

  // Save mode to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MODE, mode);
  }, [mode]);

  // Save sidebar state to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SIDEBAR, String(sidebarOpen));
  }, [sidebarOpen]);

  // Chat hook - must be defined before handlers that use setMessages
  const { messages, status, sendMessage, setMessages, error, regenerate } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/v1/chat',
      body: {
        model,
        userId: user.id,
        enabledTools: mode === 'agent' ? enabledTools : [],
        subAgentId: mode === 'agent' ? selectedAgent : undefined,
        // New landing state parameters
        webSearchEnabled: mode === 'chat' ? landingState.webSearchEnabled : false,
        deepThinkEnabled: mode === 'chat' ? landingState.deepThinkEnabled : false,
        thinkingMode: mode === 'agent' ? landingState.thinkingMode : undefined,
        mcpServers: mode === 'agent' ? landingState.selectedMcpServers : undefined,
      },
    }),
  });

  // Load sessions list on mount (for sidebar display)
  useEffect(() => {
    async function loadSessionsList() {
      try {
        setIsLoadingSessions(true);
        const response = await fetch(`/api/v1/history?limit=50`);
        if (response.ok) {
          const data = (await response.json()) as {
            chats: Array<{
              sessionId: string;
              userId: string;
              chatId: string;
              title: string;
              messageCount: number;
              createdAt: number;
              updatedAt: number;
              visibility: string;
            }>;
            hasMore: boolean;
          };
          // Map backend response to frontend format
          const formattedSessions = data.chats.map((chat) => ({
            id: chat.sessionId,
            chatId: chat.chatId,
            createdAt: chat.createdAt,
            updatedAt: chat.updatedAt,
            messageCount: chat.messageCount,
            state: 'active' as const,
            preview: undefined,
            messages: [],
            metadata: { title: chat.title },
          }));
          setSessions(formattedSessions);
        }
      } catch {
        // Silently fail - sessions list is optional
      } finally {
        setIsLoadingSessions(false);
      }
    }
    void loadSessionsList();
  }, [user.id]);

  // Sync loaded session messages to useChat
  useEffect(() => {
    if (sessionMessages) {
      setMessages(sessionMessages);
      hasUpdatedUrlRef.current = true; // Session already has URL
    }
  }, [sessionMessages, setMessages]);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const handleSessionSelect = useCallback(
    (sessionId: string) => {
      // Clear current messages and load new session
      setMessages([]);
      setSessionId(sessionId);
    },
    [setMessages, setSessionId]
  );

  const handleSubmit = useCallback(
    (message: PromptInputMessage, _event: FormEvent<HTMLFormElement>) => {
      const hasText = Boolean(message.text);
      const hasAttachments = Boolean(message.files?.length);

      if (!(hasText || hasAttachments)) {
        return;
      }

      // Generate session ID for new chats
      let sessionIdToUse = currentSessionId;
      if (!currentSessionId) {
        sessionIdToUse = crypto.randomUUID();
        pendingSessionIdRef.current = sessionIdToUse;
      }

      sendMessage(
        {
          text: message.text || 'Sent with attachments',
          files: message.files,
        },
        {
          body: {
            sessionId: sessionIdToUse,
            enabledTools: mode === 'agent' ? enabledTools : [],
            subAgentId: mode === 'agent' ? selectedAgent : undefined,
            webSearchEnabled: mode === 'chat' ? landingState.webSearchEnabled : false,
            deepThinkEnabled: mode === 'chat' ? landingState.deepThinkEnabled : false,
            thinkingMode: mode === 'agent' ? landingState.thinkingMode : undefined,
            mcpServers: mode === 'agent' ? landingState.selectedMcpServers : undefined,
          },
        }
      );

      // Update URL with new session ID after first message
      if (!currentSessionId && pendingSessionIdRef.current) {
        // Use replaceState for first message to avoid double history entry
        const url = new URL(window.location.href);
        url.searchParams.set('id', pendingSessionIdRef.current);
        url.hash = '';
        window.history.replaceState({ sessionId: pendingSessionIdRef.current }, '', url.toString());
        hasUpdatedUrlRef.current = true;
      }
    },
    [sendMessage, currentSessionId, mode, enabledTools, selectedAgent, landingState]
  );

  const handleNewChat = useCallback(() => {
    createNewSession();
    setMessages([]);
    hasUpdatedUrlRef.current = false;
    pendingSessionIdRef.current = null;
  }, [createNewSession, setMessages]);

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      try {
        const response = await fetch(`/api/v1/history/${sessionId}`, {
          method: 'DELETE',
        });
        if (response.ok) {
          setSessions((prev) => prev.filter((s) => s.id !== sessionId));
          if (sessionId === currentSessionId) {
            handleNewChat();
          }
        }
      } catch {
        // Silently fail
      }
    },
    [user.id, currentSessionId, handleNewChat]
  );

  const handleModeChange = useCallback(
    (newMode: 'chat' | 'agent') => {
      if (newMode === mode) {
        return;
      }

      // Clear messages and create new session when switching modes
      setMode(newMode);
      setMessages([]);
      createNewSession();
      hasUpdatedUrlRef.current = false;
      pendingSessionIdRef.current = null;
    },
    [mode, setMessages, createNewSession]
  );

  const handleLogout = useCallback(() => {
    window.location.href = '/api/auth/logout';
  }, []);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
  }, []);

  const _isStreaming = status === 'streaming' || status === 'submitted';
  const hasMessages = messages.length > 0;

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar - SessionSidebar Component */}
      {sidebarOpen ? (
        <SessionSidebar
          sessions={sessions}
          activeSessionId={currentSessionId}
          onSelectSession={handleSessionSelect}
          onCreateSession={handleNewChat}
          onDeleteSession={handleDeleteSession}
          isLoading={isLoadingSessions}
          className="w-72"
        />
      ) : (
        // Collapsed sidebar
        <aside className="hidden lg:flex w-16 flex-col border-r border-border bg-card items-center py-4 gap-2">
          <button
            type="button"
            onClick={handleNewChat}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent/80 shadow-lg shadow-accent/20 hover:shadow-accent/30 transition-shadow"
            title="New conversation"
          >
            <Plus className="h-5 w-5 text-white" />
          </button>
          {user.avatarUrl && (
            <button
              type="button"
              style={{ backgroundImage: `url(${user.avatarUrl})` }}
              className="mt-auto h-9 w-9 rounded-full bg-cover bg-center ring-2 ring-border/50 hover:ring-accent/50 transition-all"
              aria-label={`${user.name ?? user.login} - Logout`}
              title={`${user.name ?? user.login} - Logout`}
              onClick={handleLogout}
            />
          )}
        </aside>
      )}

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
              title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              {sidebarOpen ? (
                <ChevronLeft className="h-5 w-5" />
              ) : (
                <ChevronRight className="h-5 w-5" />
              )}
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={toggleSidebar} className="lg:hidden">
              {sidebarOpen ? (
                <ArrowDown className="h-5 w-5" />
              ) : (
                <ChevronLeft className="h-5 w-5" />
              )}
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
        {(error || sessionError) && (
          <div className="mx-auto max-w-4xl px-4 py-3">
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/50">
              <p className="text-sm text-red-800 dark:text-red-400">
                {error?.message || sessionError}
              </p>
            </div>
          </div>
        )}

        {/* Settings Modal */}
        <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />

        {/* Main Content Area - with optional artifact panel */}
        <div className="flex-1 flex overflow-hidden">
          {/* Conversation area */}
          <div
            className={`flex-1 overflow-hidden ${artifact.isVisible ? 'max-w-[60%] border-r border-border/50' : ''}`}
          >
            <Conversation className="h-full">
              <ConversationContent>
                {isLoadingSession ? (
                  <div className="flex h-full flex-col items-center justify-center p-8">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                      <span className="text-sm">Loading conversation...</span>
                    </div>
                  </div>
                ) : hasMessages ? (
                  messages.map((message, index) => (
                    <MessageComponent
                      key={message.id}
                      message={message}
                      isLast={index === messages.length - 1}
                      onCopy={handleCopy}
                      onRegenerate={regenerate}
                      showRegenerate={
                        index === messages.length - 1 &&
                        message.role === 'assistant' &&
                        status === 'ready'
                      }
                      isStreaming={status === 'streaming' && index === messages.length - 1}
                    />
                  ))
                ) : (
                  <LandingState
                    mode={mode}
                    userName={user.name ?? user.login ?? 'there'}
                    status={status}
                    selectedAgent={selectedAgent}
                    onAgentChange={setSelectedAgent}
                    onOpenAttachments={() => {
                      // Trigger the attachment file dialog
                      // This will be handled by the PromptInput ref
                    }}
                    onOpenSettings={() => setSettingsOpen(true)}
                    onInsertPrompt={setPendingPrompt}
                  />
                )}
              </ConversationContent>
              <ConversationScrollButton />
            </Conversation>
          </div>

          {/* Artifact Panel */}
          {artifact.isVisible && (
            <div className="w-[40%] min-w-[320px] max-w-[600px] bg-muted/30">
              <Artifact>
                <ArtifactHeader>
                  <ArtifactTitle>{artifact.title || 'Artifact'}</ArtifactTitle>
                  <ArtifactActions>
                    <ArtifactAction
                      tooltip="Copy"
                      label="Copy"
                      icon={Copy}
                      onClick={() => {
                        navigator.clipboard.writeText(artifact.content);
                      }}
                    />
                    <ArtifactClose onClick={resetArtifact} />
                  </ArtifactActions>
                </ArtifactHeader>
                <ArtifactContent>
                  <pre className="whitespace-pre-wrap text-sm font-mono">{artifact.content}</pre>
                </ArtifactContent>
              </Artifact>
            </div>
          )}
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

            <PromptInput onSubmit={handleSubmit} className="relative" multiple globalDrop>
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

                <PromptInputSubmit status={status} className="shrink-0" />
              </PromptInputFooter>
            </PromptInput>
          </div>
        </div>
      </div>
    </div>
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
  const textContent = message.parts.find((p) => p.type === 'text')?.text ?? '';

  const toolCalls = message.parts.filter((p) => p.type.startsWith('tool-'));

  return (
    <Message from={message.role}>
      <MessageContent>
        {/* Text Content */}
        {textContent && (
          <div className="whitespace-pre-wrap text-sm leading-relaxed">{textContent}</div>
        )}

        {/* Tool Calls */}
        {toolCalls.length > 0 && (
          <div className="mt-3 space-y-2">
            {toolCalls.map((part, index) => {
              if (!part.type.startsWith('tool-')) {
                return null;
              }

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
            <div
              className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-bounce"
              style={{ animationDelay: '0ms' }}
            />
            <div
              className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-bounce"
              style={{ animationDelay: '150ms' }}
            />
            <div
              className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-bounce"
              style={{ animationDelay: '300ms' }}
            />
          </div>
        )}
      </MessageContent>

      {/* Message Actions */}
      {isLast && !isUser && !isStreaming && (
        <MessageActions className="mt-2">
          {showRegenerate && (
            <MessageAction onClick={onRegenerate} label="Regenerate" tooltip="Regenerate response">
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
