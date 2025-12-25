'use client';

import type { ChatStatus } from 'ai';
import { useLandingState } from '@/hooks/use-landing-state';
import type { SubAgentId } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { InputToolbar } from './InputToolbar';
import { LandingHero } from './LandingHero';
import { ModeSelector } from './ModeSelector';
import { QuickActions } from './QuickActions';

interface LandingStateProps {
  mode: 'chat' | 'agent';
  userName: string;
  status: ChatStatus;

  // Authentication
  isAuthenticated: boolean;

  // Mode change
  onModeChange: (mode: 'chat' | 'agent') => void;

  // Agent mode props
  selectedAgent: SubAgentId;
  onAgentChange: (id: SubAgentId) => void;

  // Actions
  onOpenAttachments: () => void;
  onOpenSettings: () => void;
  onInsertPrompt: (prompt: string) => void;

  className?: string;
}

export function LandingState({
  mode,
  userName,
  status,
  isAuthenticated,
  onModeChange,
  selectedAgent,
  onAgentChange,
  onOpenAttachments,
  onOpenSettings,
  onInsertPrompt,
  className,
}: LandingStateProps) {
  // Landing-specific state (search, deep think, thinking mode, MCP servers)
  const {
    webSearchEnabled,
    toggleWebSearch,
    deepThinkEnabled,
    toggleDeepThink,
    thinkingMode,
    setThinkingMode,
    selectedMcpServers,
    toggleMcpServer,
  } = useLandingState();

  return (
    <div
      className={cn(
        'flex h-full flex-col items-center justify-center p-4 md:p-8 text-center',
        className
      )}
    >
      {/* Hero Section */}
      <div className="mb-4 md:mb-6">
        <LandingHero userName={userName} mode={mode} />
      </div>

      {/* Mode Selector */}
      <div className="w-full max-w-2xl mb-3 md:mb-4">
        <ModeSelector mode={mode} onModeChange={onModeChange} />
      </div>

      {/* Input Toolbar */}
      <div className="w-full max-w-2xl mb-4">
        <InputToolbar
          mode={mode}
          status={status}
          isAuthenticated={isAuthenticated}
          // Chat mode
          webSearchEnabled={webSearchEnabled}
          onToggleWebSearch={toggleWebSearch}
          deepThinkEnabled={deepThinkEnabled}
          onToggleDeepThink={toggleDeepThink}
          // Agent mode
          selectedAgent={selectedAgent}
          onAgentChange={onAgentChange}
          selectedMcpServers={selectedMcpServers}
          onToggleMcpServer={toggleMcpServer}
          thinkingMode={thinkingMode}
          onThinkingModeChange={setThinkingMode}
          // Actions
          onOpenAttachments={onOpenAttachments}
          onOpenSettings={onOpenSettings}
        />
      </div>

      {/* Quick Actions */}
      <div className="w-full max-w-3xl">
        <QuickActions
          mode={mode}
          subAgentId={mode === 'agent' ? selectedAgent : undefined}
          onActionClick={onInsertPrompt}
        />
      </div>
    </div>
  );
}

export type { LandingStateActions, LandingStateValues } from '@/hooks/use-landing-state';
// Re-export the landing state hook values for use in parent components
export { useLandingState } from '@/hooks/use-landing-state';
