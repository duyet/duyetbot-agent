'use client';

import { Bot, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SUB_AGENTS, type SubAgentId } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface SubAgentSelectorProps {
  selectedAgent: SubAgentId;
  onAgentChange: (id: SubAgentId) => void;
  disabled?: boolean;
}

export function SubAgentSelector({
  selectedAgent,
  onAgentChange,
  disabled,
}: SubAgentSelectorProps) {
  // Find the currently selected agent configuration
  const currentAgent = SUB_AGENTS.find((agent) => agent.id === selectedAgent);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2" disabled={disabled}>
          <Bot className="h-4 w-4" />
          <span>Subagent</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {SUB_AGENTS.map((agent) => (
          <DropdownMenuItem
            key={agent.id}
            onClick={() => onAgentChange(agent.id)}
            className={cn('flex cursor-pointer flex-col items-start gap-1', {
              'bg-accent': selectedAgent === agent.id,
            })}
          >
            <div className="flex w-full items-center justify-between">
              <span className="font-medium">{agent.name}</span>
              {selectedAgent === agent.id && <Check className="h-4 w-4" />}
            </div>
            <span className="text-xs text-muted-foreground">{agent.description}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
