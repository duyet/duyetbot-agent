'use client';

import { FileCode, GitBranch, History, MoreVertical, Plus, Save, Search } from 'lucide-react';
import { useState } from 'react';
import { Shell } from '@/components/layout/shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';

// Mock data for prompts
const PROMPTS = [
  {
    id: 'p1',
    name: 'Chat Agent',
    version: 'v1.0.2',
    updated: '2h ago',
    content: 'You are a helpful AI assistant...',
  },
  {
    id: 'p2',
    name: 'Code Expert',
    version: 'v2.1',
    updated: '1d ago',
    content: 'You are an expert software engineer...',
  },
  {
    id: 'p3',
    name: 'Twitter Bot',
    version: 'v0.9',
    updated: '5d ago',
    content: 'You create engaging tweets...',
  },
];

export default function PromptsPage() {
  const [activePrompt, setActivePrompt] = useState(PROMPTS[0]);
  const [editorContent, setEditorContent] = useState(activePrompt.content);

  return (
    <Shell
      title="Prompt Studio"
      description="Manage and iterate on system prompts and personas."
      fullWidth
      headerActions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <History className="h-4 w-4" />
            History
          </Button>
          <Button size="sm" className="gap-2">
            <Save className="h-4 w-4" />
            Save Changes
          </Button>
        </div>
      }
    >
      <div className="flex h-full border-t border-border">
        {/* Sidebar List */}
        <div className="w-64 border-r border-border flex flex-col bg-muted/10">
          <div className="p-4 border-b border-border space-y-3">
            <Button size="sm" className="w-full justify-start gap-2" variant="outline">
              <Plus className="h-4 w-4" />
              New Prompt
            </Button>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-3 w-3 text-muted-foreground" />
              <Input placeholder="Filter prompts..." className="h-8 pl-7 text-xs" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {PROMPTS.map((prompt) => (
              <button
                key={prompt.id}
                type="button"
                onClick={() => {
                  setActivePrompt(prompt);
                  setEditorContent(prompt.content);
                }}
                className={`w-full text-left px-3 py-2.5 rounded-md text-sm transition-colors flex items-start justify-between group ${
                  activePrompt.id === prompt.id
                    ? 'bg-secondary text-foreground'
                    : 'hover:bg-accent/50 text-muted-foreground hover:text-foreground'
                }`}
              >
                <div className="space-y-1">
                  <div className="font-medium flex items-center gap-2">
                    <FileCode className="h-3 w-3 opacity-70" />
                    {prompt.name}
                  </div>
                  <div className="text-[10px] opacity-70 flex items-center gap-1.5">
                    <span className="bg-primary/10 text-primary px-1 rounded text-[9px]">
                      {prompt.version}
                    </span>
                    <span>• {prompt.updated}</span>
                  </div>
                </div>
                <MoreVertical className="h-4 w-4 opacity-0 group-hover:opacity-50" />
              </button>
            ))}
          </div>
        </div>

        {/* Main Editor Area */}
        <div className="flex-1 flex flex-col bg-background min-h-[500px]">
          {/* Editor Toolbar */}
          <div className="h-10 border-b border-border flex items-center justify-between px-4 bg-muted/5">
            <div className="flex items-center gap-4 text-xs">
              <span className="font-medium text-foreground">{activePrompt.name}</span>
              <Separator orientation="vertical" className="h-3" />
              <span className="text-muted-foreground flex items-center gap-1">
                <GitBranch className="h-3 w-3" />
                Current Version ({activePrompt.version})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-7 text-xs">
                Variables
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs">
                Settings
              </Button>
            </div>
          </div>

          {/* Text Editor */}
          <div className="flex-1 p-0 relative">
            <textarea
              value={editorContent}
              onChange={(e) => setEditorContent(e.target.value)}
              className="w-full h-full resize-none p-6 bg-background font-mono text-sm leading-relaxed focus:outline-none text-foreground/90 selection:bg-primary/20"
              spellCheck={false}
            />
            <div className="absolute bottom-4 right-6 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
              {editorContent.length} chars
            </div>
          </div>
        </div>

        {/* Right Panel: Variables & Test (Collapsible - Simplified for now) */}
        <div className="w-72 border-l border-border bg-muted/5 hidden xl:flex flex-col">
          <div className="p-4 border-b border-border">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Variables
            </h3>
          </div>
          <div className="p-4 space-y-4">
            <Card className="bg-background border-border/50 shadow-sm">
              <CardHeader className="p-3 pb-1">
                <CardTitle className="text-xs font-mono text-primary">{'{user_context}'}</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-1 text-xs text-muted-foreground">
                Basic information about the current user interaction context.
              </CardContent>
            </Card>
            <Card className="bg-background border-border/50 shadow-sm">
              <CardHeader className="p-3 pb-1">
                <CardTitle className="text-xs font-mono text-primary">
                  {'{rag_knowledge}'}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-1 text-xs text-muted-foreground">
                Retrieved knowledge chunks from vector memory.
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Shell>
  );
}
