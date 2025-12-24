'use client';

import { useMemo, useState } from 'react';
import { COMMON_MODELS, DEFAULT_MODEL, isFreeModel } from '@/app/api/models/route';
import { SubAgentSelector } from '@/components/SubAgentSelector';
import { ToolSelector } from '@/components/ToolSelector';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface SettingsModalProps {
  model: string;
  onModelChange: (model: string) => void;
  mode: 'chat' | 'agent';
  enabledTools: string[];
  onEnabledToolsChange: (tools: string[]) => void;
  subAgentId: string;
  onSubAgentIdChange: (subAgentId: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsModal({
  model,
  onModelChange,
  mode,
  enabledTools,
  onEnabledToolsChange,
  subAgentId,
  onSubAgentIdChange,
  open,
  onOpenChange,
}: SettingsModalProps) {
  // Local state for unsaved changes
  const [localModel, setLocalModel] = useState(model);
  const [localEnabledTools, setLocalEnabledTools] = useState(enabledTools);
  const [localSubAgentId, setLocalSubAgentId] = useState(subAgentId);

  // Group models by provider
  const groupedModels = useMemo(() => {
    const groups: Record<string, typeof COMMON_MODELS> = {};
    COMMON_MODELS.forEach((model) => {
      if (!groups[model.provider]) {
        groups[model.provider] = [];
      }
      groups[model.provider].push(model);
    });
    return groups;
  }, []);

  const hasChanges =
    localModel !== model ||
    JSON.stringify(localEnabledTools.sort()) !== JSON.stringify(enabledTools.sort()) ||
    localSubAgentId !== subAgentId;

  const handleSave = () => {
    onModelChange(localModel);
    onEnabledToolsChange(localEnabledTools);
    onSubAgentIdChange(localSubAgentId);

    // Save to localStorage
    localStorage.setItem('duyetbot-chat-model', localModel);
    localStorage.setItem('duyetbot-enabled-tools', JSON.stringify(localEnabledTools));
    localStorage.setItem('duyetbot-sub-agent', localSubAgentId);

    onOpenChange(false);
  };

  const handleCancel = () => {
    // Reset local state
    setLocalModel(model);
    setLocalEnabledTools(enabledTools);
    setLocalSubAgentId(subAgentId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure your chat experience with model selection and agent settings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Model Selection */}
          <div className="space-y-2">
            <Label htmlFor="model-select">Model</Label>
            <Select value={localModel} onValueChange={setLocalModel}>
              <SelectTrigger id="model-select">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(groupedModels).map(([provider, models]) => (
                  <div key={provider}>
                    {provider !== Object.keys(groupedModels)[0] && <SelectSeparator />}
                    {models.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        <div className="flex items-center justify-between gap-2 w-full">
                          <div className="flex flex-col">
                            <span className="font-medium">{m.name}</span>
                            <span className="text-xs text-muted-foreground">{m.provider}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {m.isDefault && (
                              <Badge variant="secondary" className="text-xs">
                                Default
                              </Badge>
                            )}
                            {isFreeModel(m.id) && (
                              <Badge variant="outline" className="text-xs">
                                Free
                              </Badge>
                            )}
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Select the AI model to use for conversations. Default: {DEFAULT_MODEL}
            </p>
          </div>

          {/* Agent Mode Settings */}
          {mode === 'agent' && (
            <>
              {/* Sub-Agent Selection */}
              <div className="space-y-2">
                <SubAgentSelector value={localSubAgentId} onChange={setLocalSubAgentId} />
                <p className="text-xs text-muted-foreground">
                  Choose a specialized agent type for specific tasks.
                </p>
              </div>

              {/* Tool Selection */}
              <div className="space-y-2">
                <ToolSelector enabledTools={localEnabledTools} onChange={setLocalEnabledTools} />
              </div>
            </>
          )}

          {mode === 'chat' && (
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-1">Chat Mode</p>
              <p className="text-xs text-muted-foreground">
                In Chat mode, tool selection is managed automatically. Switch to Agent mode for
                custom tool configuration.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
