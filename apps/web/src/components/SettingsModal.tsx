'use client';

import {
  BadgeCheck,
  Bell,
  Bot,
  Code2,
  Cog,
  Globe,
  Layers,
  MessageSquare,
  Moon,
  Palette,
  Settings2,
  Shield,
  Sliders,
  Sparkles,
  Sun,
  Timer,
  Wand2,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getThemeSync, setTheme } from '@/components/theme-provider';
import {
  AVAILABLE_TOOLS,
  COMMON_MODELS,
  DEFAULT_MODEL,
  getDefaultSubAgent,
  isFreeModel,
  type ModelConfig,
  SUB_AGENTS,
} from '@/lib/constants';
import { useSettings } from '@/lib/use-settings';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Slider } from './ui/slider';
import { Switch } from './ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Textarea } from './ui/textarea';

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  // Settings from API
  const {
    settings,
    isLoading: isLoadingSettings,
    error: settingsError,
    updateSettings,
  } = useSettings();

  // Local state for unsaved changes
  const [localModel, setLocalModel] = useState(DEFAULT_MODEL);
  const [localEnabledTools, setLocalEnabledTools] = useState<string[]>([]);
  const [localSubAgentId, setLocalSubAgentId] = useState(getDefaultSubAgent().id);
  const [activeTab, setActiveTab] = useState('general');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Sync local state when settings are loaded
  useEffect(() => {
    if (settings) {
      setLocalModel(settings.defaultModel || DEFAULT_MODEL);
      setLocalEnabledTools(settings.enabledTools || []);
      // Using theme field for sub-agent temporarily - validate the value
      const validSubAgentIds: Array<'default' | 'researcher' | 'analyst'> = [
        'default',
        'researcher',
        'analyst',
      ];
      const subAgentId = validSubAgentIds.includes(
        settings.theme as 'default' | 'researcher' | 'analyst'
      )
        ? (settings.theme as 'default' | 'researcher' | 'analyst')
        : getDefaultSubAgent().id;
      setLocalSubAgentId(subAgentId);
    }
  }, [settings]);

  // Group models by provider
  const groupedModels = useMemo(() => {
    const groups: Record<string, ModelConfig[]> = {};
    COMMON_MODELS.forEach((model) => {
      const provider = model.provider;
      if (!groups[provider]) {
        groups[provider] = [];
      }
      groups[provider].push(model);
    });
    return groups;
  }, []);

  const currentSubAgent = SUB_AGENTS.find((a) => a.id === localSubAgentId) || getDefaultSubAgent();

  // Check if there are unsaved changes
  const hasChanges = useMemo(() => {
    if (!settings) {
      return false;
    }
    return (
      localModel !== settings.defaultModel ||
      JSON.stringify(localEnabledTools.sort()) !==
        JSON.stringify((settings.enabledTools || []).sort()) ||
      localSubAgentId !== (settings.theme || getDefaultSubAgent().id)
    );
  }, [localModel, localEnabledTools, localSubAgentId, settings]);

  const handleSave = useCallback(async () => {
    if (!settings || isSaving) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      await updateSettings({
        defaultModel: localModel,
        enabledTools: localEnabledTools,
        theme: localSubAgentId, // Using theme field for sub-agent temporarily
      });
      onOpenChange(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save settings';
      setSaveError(errorMessage);
      console.error('[SettingsModal] Save error:', err);
    } finally {
      setIsSaving(false);
    }
  }, [
    settings,
    isSaving,
    localModel,
    localEnabledTools,
    localSubAgentId,
    updateSettings,
    onOpenChange,
  ]);

  const handleCancel = useCallback(() => {
    // Reset local state to current settings
    if (settings) {
      setLocalModel(settings.defaultModel || DEFAULT_MODEL);
      setLocalEnabledTools(settings.enabledTools || []);
      // Validate the subAgentId value
      const validSubAgentIds: Array<'default' | 'researcher' | 'analyst'> = [
        'default',
        'researcher',
        'analyst',
      ];
      const subAgentId = validSubAgentIds.includes(
        settings.theme as 'default' | 'researcher' | 'analyst'
      )
        ? (settings.theme as 'default' | 'researcher' | 'analyst')
        : getDefaultSubAgent().id;
      setLocalSubAgentId(subAgentId);
    }
    setSaveError(null);
    onOpenChange(false);
  }, [settings, onOpenChange]);

  // Show loading state
  if (isLoadingSettings) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] p-6">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="h-8 w-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">Loading settings...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Show error state
  if (settingsError) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] p-6">
          <div className="flex items-center justify-center py-12">
            <div className="text-center max-w-md">
              <p className="text-sm text-destructive mb-2">Failed to load settings</p>
              <p className="text-xs text-muted-foreground mb-4">{settingsError}</p>
              <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                Retry
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent/80">
              <Settings2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-lg">Settings</DialogTitle>
              <DialogDescription className="text-xs">
                Configure your chat experience
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden">
          {/* Tab List */}
          <TabsList className="w-full justify-start rounded-none border-b border-border/50 px-6 bg-transparent gap-0 h-auto">
            <TabsTrigger
              value="general"
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-accent rounded-none px-4 py-3 text-sm"
            >
              <Sliders className="h-4 w-4 mr-2" />
              General
            </TabsTrigger>
            <TabsTrigger
              value="agent"
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-accent rounded-none px-4 py-3 text-sm"
            >
              <Bot className="h-4 w-4 mr-2" />
              Agent
            </TabsTrigger>
            <TabsTrigger
              value="prompts"
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-accent rounded-none px-4 py-3 text-sm"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Prompts
            </TabsTrigger>
            <TabsTrigger
              value="appearance"
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-accent rounded-none px-4 py-3 text-sm"
            >
              <Palette className="h-4 w-4 mr-2" />
              Appearance
            </TabsTrigger>
            <TabsTrigger
              value="advanced"
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-accent rounded-none px-4 py-3 text-sm"
            >
              <Cog className="h-4 w-4 mr-2" />
              Advanced
            </TabsTrigger>
          </TabsList>

          {/* Tab Content */}
          <div className="overflow-y-auto px-6 py-4 max-h-[calc(85vh-140px)]">
            {/* General Tab */}
            <TabsContent value="general" className="space-y-6 mt-0">
              <Section
                title="Model Selection"
                description="Choose the AI model for conversations"
                icon={<Sparkles className="h-4 w-4" />}
              >
                <Select value={localModel} onValueChange={setLocalModel}>
                  <SelectTrigger id="model-select">
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(groupedModels).map(([provider, models]) => (
                      <div key={provider}>
                        {provider !== Object.keys(groupedModels)[0] && <SelectSeparator />}
                        {models.map((model) => {
                          return (
                            <SelectItem key={model.id} value={model.id}>
                              <div className="flex items-center justify-between gap-2 w-full">
                                <div className="flex flex-col">
                                  <span className="font-medium text-sm">{model.name}</span>
                                  <span className="text-xs text-muted-foreground">{provider}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {model.id === DEFAULT_MODEL && (
                                    <Badge variant="secondary" className="text-xs">
                                      Default
                                    </Badge>
                                  )}
                                  {isFreeModel(model.id) && (
                                    <Badge variant="outline" className="text-xs">
                                      Free
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </Section>

              <Section
                title="Response Style"
                description="Customize how responses are formatted"
                icon={<Palette className="h-4 w-4" />}
              >
                <div className="space-y-4">
                  <SettingRow label="Response Length" description="Preferred detail level">
                    <Select defaultValue="medium">
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="concise">Concise</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="detailed">Detailed</SelectItem>
                        <SelectItem value="comprehensive">Comprehensive</SelectItem>
                      </SelectContent>
                    </Select>
                  </SettingRow>
                  <SettingRow label="Tone" description="Personality style">
                    <Select defaultValue="balanced">
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="balanced">Balanced</SelectItem>
                        <SelectItem value="casual">Casual</SelectItem>
                        <SelectItem value="creative">Creative</SelectItem>
                      </SelectContent>
                    </Select>
                  </SettingRow>
                </div>
              </Section>

              <Section
                title="Notifications"
                description="Control alert preferences"
                icon={<Bell className="h-4 w-4" />}
              >
                <div className="space-y-3">
                  <SwitchRow label="Sound alerts" description="Play sounds for events" />
                  <SwitchRow
                    label="Desktop notifications"
                    description="Show system notifications"
                  />
                </div>
              </Section>
            </TabsContent>

            {/* Agent Tab */}
            <TabsContent value="agent" className="space-y-6 mt-0">
              <Section
                title="Sub-Agent Type"
                description="Choose a specialized agent for specific tasks"
                icon={<BadgeCheck className="h-4 w-4" />}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {SUB_AGENTS.map((agent) => (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => setLocalSubAgentId(agent.id)}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        localSubAgentId === agent.id
                          ? 'border-accent bg-accent/5'
                          : 'border-border/50 hover:border-border'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-sm font-medium">{agent.name}</h4>
                            <Badge variant="secondary" className="text-[10px]">
                              {agent.category}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {agent.description}
                          </p>
                          {agent.tools && agent.tools.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {agent.tools.slice(0, 3).map((tool) => (
                                <Badge key={tool} variant="outline" className="text-[10px]">
                                  {tool}
                                </Badge>
                              ))}
                              {agent.tools.length > 3 && (
                                <Badge variant="outline" className="text-[10px]">
                                  +{agent.tools.length - 3}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </Section>

              <Section
                title="Available Tools"
                description="Select which tools the agent can use"
                icon={<Wand2 className="h-4 w-4" />}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {AVAILABLE_TOOLS.map((tool) => {
                    const isEnabled = localEnabledTools.includes(tool.id);
                    return (
                      <button
                        key={tool.id}
                        type="button"
                        onClick={() => {
                          setLocalEnabledTools((prev) =>
                            prev.includes(tool.id)
                              ? prev.filter((t) => t !== tool.id)
                              : [...prev, tool.id]
                          );
                        }}
                        className={`p-3 rounded-lg border-2 text-left transition-all ${
                          isEnabled
                            ? 'border-accent bg-accent/5'
                            : 'border-border/50 hover:border-border'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium">{tool.name}</h4>
                            <p className="text-xs text-muted-foreground truncate">
                              {tool.description}
                            </p>
                          </div>
                          <div
                            className={`h-5 w-5 rounded border-2 flex items-center justify-center transition-all ${
                              isEnabled ? 'border-accent bg-accent text-white' : 'border-border'
                            }`}
                          >
                            {isEnabled && <Zap className="h-3 w-3" />}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 p-3 rounded-lg bg-muted/50 border border-border/50">
                  <p className="text-xs text-muted-foreground">
                    <strong>{localEnabledTools.length}</strong> of{' '}
                    <strong>{AVAILABLE_TOOLS.length}</strong> tools enabled
                  </p>
                </div>
              </Section>

              <Section
                title="Tool Parameters"
                description="Configure default behavior for tools"
                icon={<Cog className="h-4 w-4" />}
              >
                <div className="space-y-4">
                  <SettingRow
                    label="Max tool iterations"
                    description="Limit tool calls per request"
                  >
                    <Select defaultValue="5">
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3</SelectItem>
                        <SelectItem value="5">5</SelectItem>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="15">15</SelectItem>
                        <SelectItem value="unlimited">Unlimited</SelectItem>
                      </SelectContent>
                    </Select>
                  </SettingRow>
                  <SettingRow label="Tool timeout" description="Max wait time for tools">
                    <Select defaultValue="30">
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15s</SelectItem>
                        <SelectItem value="30">30s</SelectItem>
                        <SelectItem value="60">60s</SelectItem>
                        <SelectItem value="120">2m</SelectItem>
                      </SelectContent>
                    </Select>
                  </SettingRow>
                </div>
              </Section>
            </TabsContent>

            {/* Prompts Tab */}
            <TabsContent value="prompts" className="space-y-6 mt-0">
              <Section
                title="System Prompt"
                description="Custom instructions for the AI"
                icon={<Code2 className="h-4 w-4" />}
              >
                <div className="space-y-4">
                  <Textarea
                    placeholder="Enter custom system instructions..."
                    className="min-h-[120px] resize-none font-mono text-sm"
                    defaultValue={currentSubAgent.systemPrompt}
                  />
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-muted-foreground">
                      This overrides the default system prompt for the selected agent type.
                    </p>
                    <Button variant="outline" size="sm">
                      Reset to Default
                    </Button>
                  </div>
                </div>
              </Section>

              <Section
                title="Response Format"
                description="Control output structure and style"
                icon={<Layers className="h-4 w-4" />}
              >
                <div className="space-y-4">
                  <SettingRow label="Format" description="Output format preference">
                    <Select defaultValue="auto">
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto</SelectItem>
                        <SelectItem value="markdown">Markdown</SelectItem>
                        <SelectItem value="plain">Plain Text</SelectItem>
                        <SelectItem value="json">JSON</SelectItem>
                      </SelectContent>
                    </Select>
                  </SettingRow>
                  <SettingRow label="Code blocks" description="Syntax highlighting style">
                    <Select defaultValue="github">
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="github">GitHub Dark</SelectItem>
                        <SelectItem value="monokai">Monokai</SelectItem>
                        <SelectItem value="nord">Nord</SelectItem>
                        <SelectItem value="dracula">Dracula</SelectItem>
                      </SelectContent>
                    </Select>
                  </SettingRow>
                </div>
              </Section>

              <Section
                title="Knowledge & Context"
                description="Additional context for responses"
                icon={<Globe className="h-4 w-4" />}
              >
                <div className="space-y-4">
                  <SwitchRow
                    label="Web search"
                    description="Allow agent to search the web for current information"
                  />
                  <SwitchRow
                    label="Use previous context"
                    description="Include conversation history in prompts"
                  />
                  <SettingRow label="Context window" description="Amount of history to include">
                    <Select defaultValue="medium">
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="short">Short (last 5)</SelectItem>
                        <SelectItem value="medium">Medium (last 10)</SelectItem>
                        <SelectItem value="long">Long (last 20)</SelectItem>
                        <SelectItem value="full">Full session</SelectItem>
                      </SelectContent>
                    </Select>
                  </SettingRow>
                </div>
              </Section>
            </TabsContent>

            {/* Appearance Tab */}
            <TabsContent value="appearance" className="space-y-6 mt-0">
              <Section
                title="Theme"
                description="Customize the visual appearance"
                icon={<Palette className="h-4 w-4" />}
              >
                <div className="space-y-4">
                  <SettingRow label="Color scheme" description="App appearance">
                    <Select
                      value={getThemeSync()}
                      onValueChange={(value: 'light' | 'dark' | 'system') => {
                        setTheme(value);
                      }}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select theme" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="system">
                          <div className="flex items-center gap-2">
                            <Settings2 className="h-4 w-4" />
                            <span>System</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="light">
                          <div className="flex items-center gap-2">
                            <Sun className="h-4 w-4" />
                            <span>Light</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="dark">
                          <div className="flex items-center gap-2">
                            <Moon className="h-4 w-4" />
                            <span>Dark</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </SettingRow>
                  <SettingRow label="Accent color" description="Primary color theme">
                    <Select defaultValue="orange">
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="orange">Terracotta</SelectItem>
                        <SelectItem value="blue">Ocean Blue</SelectItem>
                        <SelectItem value="green">Forest Green</SelectItem>
                        <SelectItem value="purple">Royal Purple</SelectItem>
                        <SelectItem value="pink">Rose Pink</SelectItem>
                      </SelectContent>
                    </Select>
                  </SettingRow>
                </div>
              </Section>

              <Section
                title="Message Display"
                description="Control how messages appear"
                icon={<MessageSquare className="h-4 w-4" />}
              >
                <div className="space-y-4">
                  <SwitchRow label="Show timestamps" description="Display time on each message" />
                  <SwitchRow
                    label="Animate messages"
                    description="Smooth animations for new messages"
                  />
                  <SettingRow label="Message density" description="Spacing between messages">
                    <Select defaultValue="comfortable">
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="compact">Compact</SelectItem>
                        <SelectItem value="comfortable">Comfortable</SelectItem>
                        <SelectItem value="spacious">Spacious</SelectItem>
                      </SelectContent>
                    </Select>
                  </SettingRow>
                </div>
              </Section>

              <Section
                title="Layout"
                description="Interface layout preferences"
                icon={<Layers className="h-4 w-4" />}
              >
                <div className="space-y-4">
                  <SettingRow label="Sidebar position" description="Where sidebar appears">
                    <Select defaultValue="left">
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">Left</SelectItem>
                        <SelectItem value="right">Right</SelectItem>
                      </SelectContent>
                    </Select>
                  </SettingRow>
                  <SettingRow label="Input bar style" description="How input area looks">
                    <Select defaultValue="floating">
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="floating">Floating</SelectItem>
                        <SelectItem value="fixed">Fixed</SelectItem>
                        <SelectItem value="minimal">Minimal</SelectItem>
                      </SelectContent>
                    </Select>
                  </SettingRow>
                </div>
              </Section>
            </TabsContent>

            {/* Advanced Tab */}
            <TabsContent value="advanced" className="space-y-6 mt-0">
              <Section
                title="Token Tracking"
                description="Monitor token usage and costs"
                icon={<Zap className="h-4 w-4" />}
              >
                <div className="p-4 rounded-lg bg-muted/50 border border-border/50 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Session tokens</span>
                    <span className="text-sm font-mono">--</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Estimated cost</span>
                    <span className="text-sm font-mono">--</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Token tracking will be available after the first message.
                  </p>
                </div>
                <SwitchRow
                  label="Show token counter"
                  description="Display token usage in real-time"
                />
                <SwitchRow
                  label="Budget alerts"
                  description="Notify when approaching token limits"
                />
              </Section>

              <Section
                title="Performance"
                description="Optimize for speed or quality"
                icon={<Timer className="h-4 w-4" />}
              >
                <div className="space-y-4">
                  <SettingRow label="Streaming speed" description="Token streaming rate">
                    <Slider defaultValue={[50]} max={100} step={10} className="w-[180px]" />
                  </SettingRow>
                  <SwitchRow
                    label="Parallel tool execution"
                    description="Run multiple tools simultaneously"
                  />
                  <SwitchRow
                    label="Cache responses"
                    description="Store responses for faster access"
                  />
                </div>
              </Section>

              <Section
                title="Developer Options"
                description="Advanced configuration options"
                icon={<Code2 className="h-4 w-4" />}
              >
                <div className="space-y-4">
                  <SwitchRow label="Debug mode" description="Show detailed logging and metadata" />
                  <SwitchRow
                    label="Show tool results"
                    description="Display raw tool outputs in chat"
                  />
                  <SettingRow label="Temperature" description="Response creativity (0.0-1.0)">
                    <Slider defaultValue={[70]} max={100} step={5} className="w-[180px]" />
                  </SettingRow>
                </div>
              </Section>

              <Section
                title="Data & Privacy"
                description="Control your data"
                icon={<Shield className="h-4 w-4" />}
              >
                <div className="space-y-4">
                  <SwitchRow
                    label="Save conversation history"
                    description="Store chats for future reference"
                  />
                  <Button variant="outline" size="sm" className="w-full">
                    Clear All History
                  </Button>
                  <Button variant="outline" size="sm" className="w-full">
                    Export Data
                  </Button>
                </div>
              </Section>
            </TabsContent>
          </div>
        </Tabs>

        {/* Footer */}
        <div className="flex flex-col gap-3 px-6 py-4 border-t border-border/50 bg-muted/30">
          {saveError && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <Zap className="h-4 w-4" />
              <span>{saveError}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={handleCancel} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="min-w-[100px]"
            >
              {isSaving ? (
                <>
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Helper Components
function Section({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent/10 text-accent">
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

function SwitchRow({ label, description }: { label: string; description: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch />
    </div>
  );
}
