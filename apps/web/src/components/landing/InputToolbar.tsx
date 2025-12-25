'use client';

import type { ChatStatus } from 'ai';
import { Plus, Search, Settings, Sparkles } from 'lucide-react';
import type { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { ToggleChip } from '@/components/ui/toggle-chip';
import type { SubAgentId, ThinkingMode } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { McpSelector } from './McpSelector';
import { SubAgentSelector } from './SubAgentSelector';
import { ThinkingModeSelector } from './ThinkingModeSelector';

interface InputToolbarProps {
  mode: 'chat' | 'agent';
  status: ChatStatus;

  // Chat mode state
  webSearchEnabled: boolean;
  onToggleWebSearch: () => void;
  deepThinkEnabled: boolean;
  onToggleDeepThink: () => void;

  // Agent mode state
  selectedAgent: SubAgentId;
  onAgentChange: (id: SubAgentId) => void;
  selectedMcpServers: string[];
  onToggleMcpServer: (serverId: string) => void;
  thinkingMode: ThinkingMode;
  onThinkingModeChange: (mode: ThinkingMode) => void;

  // Actions
  onOpenAttachments: () => void;
  onOpenSettings: () => void;

  className?: string;
}

export function InputToolbar({
  mode,
  status,
  webSearchEnabled,
  onToggleWebSearch,
  deepThinkEnabled,
  onToggleDeepThink,
  selectedAgent,
  onAgentChange,
  selectedMcpServers,
  onToggleMcpServer,
  thinkingMode,
  onThinkingModeChange,
  onOpenAttachments,
  onOpenSettings,
  className,
}: InputToolbarProps) {
  const isStreaming = status === 'streaming' || status === 'submitted';

  if (mode === 'chat') {
    return (
      <div className={cn('flex items-center justify-between gap-2', className)}>
        {/* Left side: Attachment + Toggles */}
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onOpenAttachments}
            disabled={isStreaming}
            className="text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-4 w-4" />
          </Button>

          <ToggleChip
            label="Search"
            icon={<Search className="h-3 w-3" />}
            active={webSearchEnabled}
            onToggle={onToggleWebSearch}
            disabled={isStreaming}
          />

          <ToggleChip
            label="Deep Think"
            icon={<Sparkles className="h-3 w-3" />}
            active={deepThinkEnabled}
            onToggle={onToggleDeepThink}
            variant="accent"
            disabled={isStreaming}
          />
        </div>

        {/* Right side: Submit button is handled by PromptInput */}
        <div />
      </div>
    );
  }

  // Agent mode
  return (
    <div className={cn('flex items-center justify-between gap-2', className)}>
      {/* Left side: Attachment + Agent selectors */}
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onOpenAttachments}
          disabled={isStreaming}
          className="text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
        </Button>

        <SubAgentSelector
          selectedAgent={selectedAgent}
          onAgentChange={onAgentChange}
          disabled={isStreaming}
        />

        <McpSelector
          selectedServers={selectedMcpServers}
          onToggleServer={onToggleMcpServer}
          disabled={isStreaming}
        />

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onOpenSettings}
          disabled={isStreaming}
          className="text-muted-foreground hover:text-foreground"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      {/* Right side: Auto label + Thinking modes */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Auto</span>
        <ThinkingModeSelector
          mode={thinkingMode}
          onModeChange={onThinkingModeChange}
          disabled={isStreaming}
        />
      </div>
    </div>
  );
}
