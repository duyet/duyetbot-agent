'use client';

import {
  Bot,
  Calculator,
  Calendar,
  ChevronRight,
  Clock,
  CloudSun,
  Globe,
  Plus,
  Search,
} from 'lucide-react';
import { useState } from 'react';
import { SUB_AGENTS, type SubAgentConfig } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface SubAgentSelectorProps {
  value: string;
  onChange: (subAgentId: string) => void;
  className?: string;
}

const TOOL_ICONS: Record<string, React.ElementType> = {
  webSearch: Search,
  calculator: Calculator,
  dateMath: Calendar,
  currentTime: Clock,
  weather: CloudSun,
};

const CATEGORY_ICONS: Record<SubAgentConfig['category'], React.ElementType> = {
  research: Globe,
  analysis: Calculator,
  custom: Bot,
};

export function SubAgentSelector({ value, onChange, className }: SubAgentSelectorProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);

  return (
    <div className={cn('space-y-3', className)}>
      <div className="text-sm font-medium text-foreground">Agent Type</div>
      <div className="space-y-2">
        {SUB_AGENTS.map((agent) => {
          const Icon = CATEGORY_ICONS[agent.category];
          const isSelected = value === agent.id;

          return (
            <button
              key={agent.id}
              type="button"
              onClick={() => onChange(agent.id)}
              className={cn(
                'w-full flex items-start gap-3 p-3 rounded-lg border transition-all text-left',
                isSelected
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border hover:bg-muted hover:border-muted-foreground/50'
              )}
            >
              <Icon className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate">{agent.name}</span>
                  {isSelected && <ChevronRight className="h-4 w-4 shrink-0" />}
                </div>
                <p
                  className={cn(
                    'text-xs truncate',
                    isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'
                  )}
                >
                  {agent.description}
                </p>
                <div className="flex flex-wrap gap-1">
                  {agent.tools.map((toolId) => {
                    const ToolIcon = TOOL_ICONS[toolId];
                    if (!ToolIcon) {
                      return null;
                    }
                    return (
                      <ToolIcon
                        key={toolId}
                        className={cn(
                          'h-3 w-3',
                          isSelected ? 'text-primary-foreground/60' : 'text-muted-foreground'
                        )}
                        title={toolId}
                      />
                    );
                  })}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Create Custom Agent Button - for future implementation */}
      <button
        type="button"
        onClick={() => setShowCreateForm(true)}
        className="w-full flex items-center gap-2 p-2 rounded-md border border-dashed border-muted-foreground/50 text-muted-foreground hover:text-foreground hover:border-muted-foreground transition-colors text-sm"
      >
        <Plus className="h-4 w-4" />
        Create Custom Agent
      </button>

      {/* Custom Agent Form - to be implemented */}
      {showCreateForm && (
        <div className="p-4 bg-muted rounded-lg text-sm">
          <p className="font-medium mb-2">Custom Agent Creation</p>
          <p className="text-muted-foreground text-xs mb-3">
            Create your own agent with custom system prompt and tool selection.
          </p>
          <p className="text-xs text-muted-foreground italic">
            Coming soon! For now, use the predefined agent types.
          </p>
          <button
            type="button"
            onClick={() => setShowCreateForm(false)}
            className="mt-3 text-xs underline text-muted-foreground hover:text-foreground"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
