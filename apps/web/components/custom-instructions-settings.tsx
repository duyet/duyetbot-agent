"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  SparklesIcon,
  Code2Icon,
  PenToolIcon,
  BrainIcon,
  GraduationCapIcon,
  FileSearchIcon,
  Settings2Icon,
  InfoIcon,
} from "@/components/icons";
import {
  useCustomInstructions,
  INSTRUCTION_TEMPLATES,
  DEFAULT_AI_SETTINGS,
  type InstructionTemplate,
} from "@/lib/custom-instructions";

/**
 * Custom Instructions Settings Dialog
 *
 * Provides UI for:
 * - Enabling/disabling custom instructions
 * - Editing global instructions
 * - Selecting instruction templates
 * - Configuring AI generation settings
 */
export function CustomInstructionsSettings({ chatId }: { chatId?: string }) {
  const {
    instructions,
    aiSettings,
    updateGlobal,
    updateChat,
    setEnabled,
    setActiveTemplate,
    updateAISettings,
    resetSettings,
  } = useCustomInstructions();

  const [open, setOpen] = useState(false);
  const [globalInput, setGlobalInput] = useState(instructions.global);
  const [chatInput, setChatInput] = useState(
    chatId ? instructions.chatSpecific[chatId] || "" : ""
  );
  const [selectedTemplate, setSelectedTemplate] = useState<
    string | undefined
  >(instructions.activeTemplate);

  const handleSave = () => {
    updateGlobal(globalInput);
    if (chatId) {
      updateChat(chatId, chatInput);
    }
    setActiveTemplate(selectedTemplate);
    setOpen(false);
  };

  const handleTemplateSelect = (template: InstructionTemplate) => {
    setSelectedTemplate(template.id);
    // Optionally append template to global instructions
    if (!globalInput.includes(template.instruction)) {
      setGlobalInput(
        globalInput
          ? `${globalInput}\n\n${template.instruction}`
          : template.instruction
      );
    }
  };

  const getCategoryIcon = (category: InstructionTemplate["category"]) => {
    const iconProps = { size: 16 };
    switch (category) {
      case "coding":
        return <span className="w-4 h-4 flex"><Code2Icon {...iconProps} /></span>;
      case "writing":
        return <span className="w-4 h-4 flex"><PenToolIcon {...iconProps} /></span>;
      case "analysis":
        return <span className="w-4 h-4 flex"><BrainIcon {...iconProps} /></span>;
      case "general":
        return <span className="w-4 h-4 flex"><GraduationCapIcon {...iconProps} /></span>;
      default:
        return <span className="w-4 h-4 flex"><SparklesIcon {...iconProps} /></span>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <span className="w-4 h-4 flex"><SparklesIcon size={16} /></span>
          Custom Instructions
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="w-5 h-5 flex"><SparklesIcon size={20} /></span>
            Custom Instructions & AI Settings
          </DialogTitle>
          <DialogDescription>
            Customize how the AI responds by setting instructions and
            generation parameters.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="instructions" className="flex-1 overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="instructions">Instructions</TabsTrigger>
            <TabsTrigger value="settings">AI Settings</TabsTrigger>
          </TabsList>

          <TabsContent
            value="instructions"
            className="flex-1 overflow-hidden flex flex-col"
          >
            <ScrollArea className="flex-1 px-1">
              <div className="space-y-6 pr-4">
                {/* Enable Toggle */}
                <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                  <div className="space-y-0.5">
                    <Label htmlFor="enable-instructions" className="text-base">
                      Enable Custom Instructions
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Apply your instructions to all conversations
                    </p>
                  </div>
                  <Switch
                    id="enable-instructions"
                    checked={instructions.enabled}
                    onCheckedChange={setEnabled}
                  />
                </div>

                {/* Global Instructions */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="global-instructions" className="text-base">
                      Global Instructions
                    </Label>
                    <Badge variant="outline" className="text-xs">
                      Applied to all chats
                    </Badge>
                  </div>
                  <Textarea
                    id="global-instructions"
                    placeholder="Enter instructions that apply to all conversations...&#10;&#10;Example:&#10;- Always provide code examples&#10;- Explain technical concepts simply&#10;- Include error handling in code"
                    value={globalInput}
                    onChange={(e) => setGlobalInput(e.target.value)}
                    rows={8}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    These instructions will be included in the system prompt for
                    every chat.
                  </p>
                </div>

                {/* Chat-Specific Instructions */}
                {chatId && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="chat-instructions" className="text-base">
                        Chat-Specific Instructions
                      </Label>
                      <Badge variant="outline" className="text-xs">
                        This chat only
                      </Badge>
                    </div>
                    <Textarea
                      id="chat-instructions"
                      placeholder="Enter instructions specific to this conversation..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      rows={4}
                      className="font-mono text-sm"
                    />
                  </div>
                )}

                {/* Template Library */}
                <div className="space-y-3">
                  <Label className="text-base flex items-center gap-2">
                    <span className="w-4 h-4 flex"><FileSearchIcon size={16} /></span>
                    Instruction Templates
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Quick-start with pre-built instruction sets
                  </p>
                  <div className="grid gap-3">
                    {INSTRUCTION_TEMPLATES.map((template) => (
                      <div
                        key={template.id}
                        className={`p-4 border rounded-lg cursor-pointer transition-all hover:bg-accent ${
                          selectedTemplate === template.id
                            ? "border-primary bg-primary/5"
                            : ""
                        }`}
                        onClick={() => handleTemplateSelect(template)}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 text-primary">
                            {getCategoryIcon(template.category)}
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium">{template.name}</h4>
                              <Badge variant="secondary" className="text-xs">
                                {template.category}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {template.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent
            value="settings"
            className="flex-1 overflow-hidden flex flex-col"
          >
            <ScrollArea className="flex-1 px-1">
              <div className="space-y-6 pr-4">
                <div className="flex items-start gap-3 p-4 border rounded-lg bg-muted/30">
                  <span className="w-5 h-5 text-muted-foreground mt-0.5 flex"><InfoIcon size={20} /></span>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">About AI Settings</p>
                    <p className="text-xs text-muted-foreground">
                      These parameters control how the AI generates responses.
                      Changes apply to all new messages.
                    </p>
                  </div>
                </div>

                {/* Temperature */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="temperature" className="text-base">
                      Temperature
                    </Label>
                    <Badge variant="outline" className="text-xs font-mono">
                      {aiSettings.temperature.toFixed(1)}
                    </Badge>
                  </div>
                  <Slider
                    id="temperature"
                    min={0}
                    max={2}
                    step={0.1}
                    value={[aiSettings.temperature]}
                    onValueChange={([value]) =>
                      updateAISettings({ temperature: value })
                    }
                    className="py-4"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Precise (0.0)</span>
                    <span>Balanced (1.0)</span>
                    <span>Creative (2.0)</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Lower values produce more focused responses, higher values
                    produce more varied and creative outputs.
                  </p>
                </div>

                {/* Max Tokens */}
                <div className="space-y-2">
                  <Label htmlFor="maxTokens" className="text-base">
                    Maximum Response Length
                  </Label>
                  <div className="flex items-center gap-4">
                    <Slider
                      id="maxTokens"
                      min={256}
                      max={8192}
                      step={256}
                      value={[aiSettings.maxTokens || 4096]}
                      onValueChange={([value]) =>
                        updateAISettings({ maxTokens: value })
                      }
                      className="flex-1"
                    />
                    <span className="text-sm font-mono min-w-[80px] text-right">
                      {aiSettings.maxTokens || 4096}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Maximum number of tokens in the AI response. Leave empty
                    for model default.
                  </p>
                </div>

                {/* Top P */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="topP" className="text-base">
                      Top P (Nucleus Sampling)
                    </Label>
                    <Badge variant="outline" className="text-xs font-mono">
                      {aiSettings.topP?.toFixed(2) || "default"}
                    </Badge>
                  </div>
                  <Slider
                    id="topP"
                    min={0}
                    max={1}
                    step={0.05}
                    value={[aiSettings.topP || 1]}
                    onValueChange={([value]) => updateAISettings({ topP: value })}
                    className="py-4"
                  />
                  <p className="text-xs text-muted-foreground">
                    Controls diversity by limiting to the most likely tokens
                    that sum to probability P.
                  </p>
                </div>

                {/* Frequency Penalty */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="frequencyPenalty" className="text-base">
                      Frequency Penalty
                    </Label>
                    <Badge variant="outline" className="text-xs font-mono">
                      {aiSettings.frequencyPenalty?.toFixed(1) || "0.0"}
                    </Badge>
                  </div>
                  <Slider
                    id="frequencyPenalty"
                    min={-2}
                    max={2}
                    step={0.1}
                    value={[aiSettings.frequencyPenalty || 0]}
                    onValueChange={([value]) =>
                      updateAISettings({ frequencyPenalty: value })
                    }
                    className="py-4"
                  />
                  <p className="text-xs text-muted-foreground">
                    Reduces repetition of frequently used tokens. Positive
                    values decrease repetition.
                  </p>
                </div>

                {/* Presence Penalty */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="presencePenalty" className="text-base">
                      Presence Penalty
                    </Label>
                    <Badge variant="outline" className="text-xs font-mono">
                      {aiSettings.presencePenalty?.toFixed(1) || "0.0"}
                    </Badge>
                  </div>
                  <Slider
                    id="presencePenalty"
                    min={-2}
                    max={2}
                    step={0.1}
                    value={[aiSettings.presencePenalty || 0]}
                    onValueChange={([value]) =>
                      updateAISettings({ presencePenalty: value })
                    }
                    className="py-4"
                  />
                  <p className="text-xs text-muted-foreground">
                    Encourages talking about new topics. Positive values
                    increase topic diversity.
                  </p>
                </div>

                {/* Reset Button */}
                <div className="flex justify-end pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => resetSettings()}
                  >
                    <span className="w-4 h-4 mr-2 flex"><Settings2Icon size={16} /></span>
                    Reset to Defaults
                  </Button>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
