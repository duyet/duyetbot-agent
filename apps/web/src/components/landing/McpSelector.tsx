'use client';

import { Check, Plug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const MCP_SERVERS = [
  { id: 'github-mcp', name: 'GitHub MCP', description: 'Access GitHub repositories and APIs' },
] as const;

interface McpSelectorProps {
  selectedServers: string[];
  onToggleServer: (serverId: string) => void;
  disabled?: boolean;
}

export function McpSelector({ selectedServers, onToggleServer, disabled }: McpSelectorProps) {
  const selectedCount = selectedServers.length;
  const hasSelection = selectedCount > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="default"
          disabled={disabled}
          className={cn('relative', hasSelection && 'bg-accent text-accent-foreground')}
        >
          <Plug className="size-4" />
          <span>MCP</span>
          {hasSelection && (
            <div className="absolute right-1 top-1 flex items-center justify-center">
              <span className="rounded-full bg-primary px-1.5 py-0.5 text-xs font-medium text-primary-foreground">
                {selectedCount}
              </span>
            </div>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Model Context Protocol</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {MCP_SERVERS.map((server) => (
          <DropdownMenuCheckboxItem
            key={server.id}
            checked={selectedServers.includes(server.id)}
            onCheckedChange={() => onToggleServer(server.id)}
          >
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                {selectedServers.includes(server.id) && <Check className="size-4 text-green-600" />}
                <span className="font-medium">{server.name}</span>
              </div>
              <span className="text-xs text-muted-foreground">{server.description}</span>
            </div>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
