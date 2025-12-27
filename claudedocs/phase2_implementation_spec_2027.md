# Phase 2 Implementation Specification: Intelligence & Collaboration (2027-2030)

**Status**: Future Implementation
**Duration**: 36 months
**Total Effort**: ~46 weeks of development
**Dependencies**: Phase 1 completion

---

## 1. Multi-Agent Architecture

**Timeline**: 2027 (12 weeks)
**Priority**: CRITICAL
**Dependencies**: Session management from Phase 1

### 1.1 Agent Types & Interfaces

**File**: `apps/web/lib/agents/types.ts`

```typescript
export interface Agent {
  id: string;
  name: string;
  description: string;
  avatar?: string;
  capabilities: AgentCapability[];
  model: string;
  provider: 'openai' | 'anthropic' | 'openrouter' | 'custom';
  temperature?: number;
  maxTokens?: number;
  tools: Tool[];
  systemPrompt?: string;
  memory: boolean;
  createdAt: number;
  updatedAt: number;
}

export type AgentCapability =
  | 'chat'
  | 'code'
  | 'research'
  | 'analysis'
  | 'writing'
  | 'math'
  | 'image-generation'
  | 'file-analysis'
  | 'web-search'
  | 'database-query';

export interface Tool {
  id: string;
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler: (params: Record<string, unknown>) => Promise<unknown>;
}

export interface AgentMessage {
  id: string;
  agentId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface AgentConversation {
  id: string;
  agents: Agent[];
  messages: AgentMessage[];
  status: 'active' | 'paused' | 'completed' | 'error';
  createdAt: number;
  updatedAt: number;
}

export interface AgentHandoff {
  from: string;
  to: string;
  reason: string;
  context: Record<string, unknown>;
  timestamp: number;
}
```

### 1.2 Agent Registry Store

**File**: `apps/web/lib/agents/registry-store.ts`

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Agent } from './types';

interface AgentRegistryState {
  agents: Agent[];
  activeAgents: Set<string>;
  customAgents: Set<string>;

  registerAgent: (agent: Agent) => void;
  unregisterAgent: (id: string) => void;
  getAgent: (id: string) => Agent | undefined;
  getAgentsByCapability: (capability: string) => Agent[];
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  createCustomAgent: (config: Partial<Agent>) => Agent;
  deleteCustomAgent: (id: string) => void;
}

export const useAgentRegistry = create<AgentRegistryState>()(
  persist(
    (set, get) => ({
      agents: [],
      activeAgents: new Set(),
      customAgents: new Set(),

      registerAgent: (agent) =>
        set((state) => ({
          agents: [...state.agents, agent],
          activeAgents: new Set([...state.activeAgents, agent.id]),
        })),

      unregisterAgent: (id) =>
        set((state) => {
          const activeAgents = new Set(state.activeAgents);
          activeAgents.delete(id);
          return {
            agents: state.agents.filter((a) => a.id !== id),
            activeAgents,
          };
        }),

      getAgent: (id) => get().agents.find((a) => a.id === id),

      getAgentsByCapability: (capability) =>
        get().agents.filter((a) => a.capabilities.includes(capability as any)),

      updateAgent: (id, updates) =>
        set((state) => ({
          agents: state.agents.map((a) =>
            a.id === id ? { ...a, ...updates, updatedAt: Date.now() } : a
          ),
        })),

      createCustomAgent: (config) => {
        const agent: Agent = {
          id: `custom-${Date.now()}`,
          name: config.name || 'Custom Agent',
          description: config.description || '',
          capabilities: config.capabilities || ['chat'],
          model: config.model || 'gpt-4',
          provider: config.provider || 'openai',
          tools: config.tools || [],
          memory: config.memory ?? true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          ...config,
        };

        set((state) => {
          const customAgents = new Set(state.customAgents);
          customAgents.add(agent.id);
          return {
            agents: [...state.agents, agent],
            customAgents,
          };
        });

        return agent;
      },

      deleteCustomAgent: (id) =>
        set((state) => {
          if (!state.customAgents.has(id)) return state;

          const customAgents = new Set(state.customAgents);
          customAgents.delete(id);

          return {
            agents: state.agents.filter((a) => a.id !== id),
            customAgents,
          };
        }),
    }),
    {
      name: 'agent-registry',
      partialize: (state) => ({
        agents: state.agents,
        customAgents: Array.from(state.customAgents),
      }),
    }
  )
);
```

### 1.3 Built-in Agents Configuration

**File**: `apps/web/lib/agents/builtin-agents.ts`

```typescript
import type { Agent } from './types';

export const BUILTIN_AGENTS: Agent[] = [
  {
    id: 'agent-coder',
    name: 'Code Assistant',
    description: 'Expert in writing, reviewing, and debugging code',
    avatar: '/agents/coder.svg',
    capabilities: ['code', 'analysis', 'chat'],
    model: 'claude-sonnet-4-20250514',
    provider: 'anthropic',
    temperature: 0.1,
    maxTokens: 8192,
    tools: [],
    systemPrompt: `You are an expert coding assistant. You help users write clean, efficient, and well-documented code. You analyze code for bugs, suggest improvements, and explain complex concepts clearly.

When writing code:
- Follow best practices for the language/framework
- Include helpful comments
- Consider edge cases and error handling
- Optimize for readability and maintainability

When reviewing code:
- Identify potential bugs and security issues
- Suggest performance improvements
- Check for consistent style and patterns`,
    memory: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'agent-researcher',
    name: 'Research Assistant',
    description: 'Helps find and synthesize information from multiple sources',
    avatar: '/agents/researcher.svg',
    capabilities: ['research', 'web-search', 'analysis', 'chat'],
    model: 'gpt-4-turbo',
    provider: 'openai',
    temperature: 0.3,
    maxTokens: 4096,
    tools: ['web-search', 'web-scrape'],
    systemPrompt: `You are a research assistant. You help users find, analyze, and synthesize information from credible sources.

When conducting research:
- Search across multiple sources
- Verify claims and cite sources
- Present balanced perspectives
- Distinguish facts from opinions
- Highlight uncertainties and limitations

When synthesizing information:
- Organize findings logically
- Draw connections between sources
- Identify consensus and disagreement
- Provide actionable insights`,
    memory: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'agent-writer',
    name: 'Writing Assistant',
    description: 'Helps with writing, editing, and content creation',
    avatar: '/agents/writer.svg',
    capabilities: ['writing', 'chat'],
    model: 'claude-sonnet-4-20250514',
    provider: 'anthropic',
    temperature: 0.7,
    maxTokens: 4096,
    tools: [],
    systemPrompt: `You are a writing assistant. You help users create, edit, and improve written content across various genres and formats.

When writing:
- Match the intended tone and style
- Structure content clearly
- Use precise and engaging language
- Adapt to the target audience

When editing:
- Preserve the author's voice
- Fix grammar and clarity issues
- Suggest structural improvements
- Explain your changes

Specialties:
- Articles and essays
- Marketing copy
- Technical documentation
- Creative writing
- Business communications`,
    memory: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'agent-analyst',
    name: 'Data Analyst',
    description: 'Analyzes data, creates visualizations, and provides insights',
    avatar: '/agents/analyst.svg',
    capabilities: ['analysis', 'math', 'database-query', 'chat'],
    model: 'gpt-4-turbo',
    provider: 'openai',
    temperature: 0.2,
    maxTokens: 4096,
    tools: ['code-interpreter', 'chart-generator'],
    systemPrompt: `You are a data analyst. You help users analyze data, create visualizations, and derive actionable insights.

When analyzing data:
- Understand the context and questions
- Choose appropriate statistical methods
- Validate assumptions
- Consider limitations and uncertainties

When creating visualizations:
- Select the right chart type
- Ensure clarity and accuracy
- Use proper labeling and scales
- Highlight key insights

When interpreting results:
- Explain findings clearly
- Note confidence levels
- Suggest follow-up analyses
- Recommend actions based on data`,
    memory: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

// Initialize built-in agents
export function initializeBuiltinAgents() {
  const { registerAgent } = useAgentRegistry.getState();

  for (const agent of BUILTIN_AGENTS) {
    registerAgent(agent);
  }
}
```

### 1.4 Multi-Agent Conversation Manager

**File**: `apps/web/lib/agents/conversation-manager.ts`

```typescript
import type {
  Agent,
  AgentMessage,
  AgentConversation,
  AgentHandoff,
} from './types';
import { useAgentRegistry } from './registry-store';

export class ConversationManager {
  private conversations: Map<string, AgentConversation> = new Map();
  private handoffs: AgentHandoff[] = [];

  createConversation(agentIds: string[]): AgentConversation {
    const { getAgent } = useAgentRegistry.getState();

    const agents = agentIds
      .map((id) => getAgent(id))
      .filter((a): a is Agent => a !== undefined);

    if (agents.length === 0) {
      throw new Error('No valid agents found');
    }

    const conversation: AgentConversation = {
      id: `conv-${Date.now()}`,
      agents,
      messages: [],
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.conversations.set(conversation.id, conversation);
    return conversation;
  }

  async processMessage(
    conversationId: string,
    content: string,
    userId?: string
  ): Promise<AgentMessage> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Add user message
    const userMessage: AgentMessage = {
      id: `msg-${Date.now()}-user`,
      agentId: 'user',
      role: 'user',
      content,
      timestamp: Date.now(),
      metadata: { userId },
    };

    conversation.messages.push(userMessage);
    conversation.updatedAt = Date.now();

    // Determine which agent should respond
    const agentId = await this.selectAgent(conversation, content);
    const agent = conversation.agents.find((a) => a.id === agentId);

    if (!agent) {
      throw new Error('No suitable agent found');
    }

    // Generate response
    const response = await this.generateResponse(agent, conversation.messages);

    const assistantMessage: AgentMessage = {
      id: `msg-${Date.now()}-assistant`,
      agentId: agent.id,
      role: 'assistant',
      content: response.content,
      timestamp: Date.now(),
      metadata: response.metadata,
    };

    conversation.messages.push(assistantMessage);
    conversation.updatedAt = Date.now();

    return assistantMessage;
  }

  private async selectAgent(
    conversation: AgentConversation,
    userMessage: string
  ): Promise<string> {
    // Simple routing logic - can be enhanced with ML
    const message = userMessage.toLowerCase();

    // Check for code-related keywords
    if (
      message.includes('code') ||
      message.includes('function') ||
      message.includes('bug') ||
      message.includes('debug')
    ) {
      const coder = conversation.agents.find((a) =>
        a.capabilities.includes('code')
      );
      if (coder) return coder.id;
    }

    // Check for research keywords
    if (
      message.includes('find') ||
      message.includes('search') ||
      message.includes('look up') ||
      message.includes('research')
    ) {
      const researcher = conversation.agents.find((a) =>
        a.capabilities.includes('research')
      );
      if (researcher) return researcher.id;
    }

    // Check for writing keywords
    if (
      message.includes('write') ||
      message.includes('edit') ||
      message.includes('draft') ||
      message.includes('content')
    ) {
      const writer = conversation.agents.find((a) =>
        a.capabilities.includes('writing')
      );
      if (writer) return writer.id;
    }

    // Check for analysis keywords
    if (
      message.includes('analyze') ||
      message.includes('data') ||
      message.includes('statistics') ||
      message.includes('chart')
    ) {
      const analyst = conversation.agents.find((a) =>
        a.capabilities.includes('analysis')
      );
      if (analyst) return analyst.id;
    }

    // Default to first agent
    return conversation.agents[0].id;
  }

  private async generateResponse(
    agent: Agent,
    history: AgentMessage[]
  ): Promise<{ content: string; metadata?: Record<string, unknown> }> {
    // This would call the AI provider
    // Implementation depends on your AI SDK integration
    const messages = history
      .filter((m) => m.agentId !== 'user' || m.role === 'user')
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    if (agent.systemPrompt) {
      messages.unshift({
        role: 'system',
        content: agent.systemPrompt,
      });
    }

    // Call AI provider
    // const response = await callAIProvider(agent, messages);
    // return { content: response.content, metadata: response.metadata };

    return {
      content: 'Response from agent',
      metadata: { agentId: agent.id, model: agent.model },
    };
  }

  async handoff(
    conversationId: string,
    fromAgentId: string,
    toAgentId: string,
    reason: string
  ): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const handoff: AgentHandoff = {
      from: fromAgentId,
      to: toAgentId,
      reason,
      context: {
        conversationId,
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
    };

    this.handoffs.push(handoff);

    // Notify agents of handoff
    // This would trigger context transfer logic
  }

  getConversation(id: string): AgentConversation | undefined {
    return this.conversations.get(id);
  }

  getHandoffs(conversationId?: string): AgentHandoff[] {
    if (conversationId) {
      return this.handoffs.filter(
        (h) => h.context?.conversationId === conversationId
      );
    }
    return this.handoffs;
  }
}

export const conversationManager = new ConversationManager();
```

### 1.5 Agent Selection UI Component

**File**: `apps/web/components/agents/agent-selector.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useAgentRegistry } from '@/lib/agents/registry-store';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Bot, Plus, Settings } from 'lucide-react';
import type { Agent } from '@/lib/agents/types';

interface AgentSelectorProps {
  selectedAgentIds: string[];
  onSelectionChange: (agentIds: string[]) => void;
  maxSelections?: number;
}

export function AgentSelector({
  selectedAgentIds,
  onSelectionChange,
  maxSelections = 3,
}: AgentSelectorProps) {
  const { agents, activeAgents } = useAgentRegistry();
  const [open, setOpen] = useState(false);

  const availableAgents = agents.filter((a) => activeAgents.has(a.id));

  const handleToggle = (agentId: string) => {
    if (selectedAgentIds.includes(agentId)) {
      onSelectionChange(selectedAgentIds.filter((id) => id !== agentId));
    } else if (selectedAgentIds.length < maxSelections) {
      onSelectionChange([...selectedAgentIds, agentId]);
    }
  };

  const selectedAgents = selectedAgentIds
    .map((id) => agents.find((a) => a.id === id))
    .filter((a): a is Agent => a !== undefined);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Bot className="h-4 w-4" />
          {selectedAgents.length > 0 ? (
            <span>{selectedAgents.length} agent{selectedAgents.length > 1 ? 's' : ''} selected</span>
          ) : (
            <span>Select Agents</span>
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select Agents</DialogTitle>
          <DialogDescription>
            Choose up to {maxSelections} agents for this conversation.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-96 pr-4">
          <div className="space-y-3">
            {availableAgents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                selected={selectedAgentIds.includes(agent.id)}
                onToggle={() => handleToggle(agent.id)}
                disabled={
                  !selectedAgentIds.includes(agent.id) &&
                  selectedAgentIds.length >= maxSelections
                }
              />
            ))}
          </div>
        </ScrollArea>

        <div className="flex items-center justify-between pt-4 border-t">
          <span className="text-sm text-muted-foreground">
            {selectedAgentIds.length} / {maxSelections} selected
          </span>
          <Button onClick={() => setOpen(false)}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface AgentCardProps {
  agent: Agent;
  selected: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

function AgentCard({ agent, selected, onToggle, disabled }: AgentCardProps) {
  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
        selected ? 'bg-primary/10 border-primary' : 'hover:bg-muted'
      }`}
    >
      <Checkbox
        checked={selected}
        onCheckedChange={onToggle}
        disabled={disabled}
      />

      <Avatar className="h-10 w-10">
        {agent.avatar ? (
          <img src={agent.avatar} alt={agent.name} />
        ) : (
          <Bot className="h-6 w-6" />
        )}
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{agent.name}</span>
          {agent.id.startsWith('custom-') && (
            <Badge variant="secondary" className="text-xs">
              Custom
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {agent.description}
        </p>
        <div className="flex flex-wrap gap-1 mt-2">
          {agent.capabilities.slice(0, 3).map((cap) => (
            <Badge key={cap} variant="outline" className="text-xs">
              {cap}
            </Badge>
          ))}
          {agent.capabilities.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{agent.capabilities.length - 3}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
```

### 1.6 Custom Agent Builder

**File**: `apps/web/components/agents/agent-builder.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useAgentRegistry } from '@/lib/agents/registry-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from 'lucide-react';
import type { AgentCapability } from '@/lib/agents/types';
import { toast } from 'sonner';

const CAPABILITIES: AgentCapability[] = [
  'chat',
  'code',
  'research',
  'analysis',
  'writing',
  'math',
  'image-generation',
  'file-analysis',
  'web-search',
  'database-query',
];

export function AgentBuilder() {
  const { createCustomAgent } = useAgentRegistry();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [model, setModel] = useState('gpt-4');
  const [provider, setProvider] = useState('openai' as const);
  const [temperature, setTemperature] = useState(0.7);
  const [capabilities, setCapabilities] = useState<AgentCapability[]>(['chat']);
  const [systemPrompt, setSystemPrompt] = useState('');

  const handleToggleCapability = (cap: AgentCapability) => {
    setCapabilities((prev) =>
      prev.includes(cap)
        ? prev.filter((c) => c !== cap)
        : [...prev, cap]
    );
  };

  const handleCreate = () => {
    if (!name.trim()) {
      toast.error('Please enter an agent name');
      return;
    }

    const agent = createCustomAgent({
      name: name.trim(),
      description: description.trim(),
      model,
      provider,
      temperature,
      capabilities,
      systemPrompt: systemPrompt.trim() || undefined,
    });

    toast.success(`Agent "${agent.name}" created successfully`);

    // Reset form
    setName('');
    setDescription('');
    setModel('gpt-4');
    setTemperature(0.7);
    setCapabilities(['chat']);
    setSystemPrompt('');
  };

  return (
    <div className="space-y-6">
      <div>
        <Label htmlFor="name">Agent Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Marketing Assistant"
        />
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what this agent does..."
          rows={2}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="provider">Provider</Label>
          <Select value={provider} onValueChange={(v: any) => setProvider(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="openai">OpenAI</SelectItem>
              <SelectItem value="anthropic">Anthropic</SelectItem>
              <SelectItem value="openrouter">OpenRouter</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="model">Model</Label>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gpt-4">GPT-4</SelectItem>
              <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
              <SelectItem value="claude-opus-4">Claude Opus 4</SelectItem>
              <SelectItem value="claude-sonnet-4">Claude Sonnet 4</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="temperature">Temperature: {temperature}</Label>
        <input
          id="temperature"
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={temperature}
          onChange={(e) => setTemperature(parseFloat(e.target.value))}
          className="w-full"
        />
      </div>

      <div>
        <Label>Capabilities</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {CAPABILITIES.map((cap) => (
            <Badge
              key={cap}
              variant={capabilities.includes(cap) ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => handleToggleCapability(cap)}
            >
              {cap}
            </Badge>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="system-prompt">System Prompt (Optional)</Label>
        <Textarea
          id="system-prompt"
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="Define the agent's behavior and personality..."
          rows={4}
        />
      </div>

      <Button onClick={handleCreate} className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        Create Agent
      </Button>
    </div>
  );
}
```

---

## 2. Real-Time Collaboration

**Timeline**: 2028 (10 weeks)
**Priority**: MEDIUM
**Dependencies**: Session management, Artifact system

### 2.1 Collaboration Types

**File**: `apps/web/lib/collaboration/types.ts`

```typescript
export interface CollaborationSession {
  id: string;
  documentId: string;
  documentType: 'chat' | 'artifact' | 'document';
  participants: Participant[];
  status: 'active' | 'ended';
  createdAt: number;
  updatedAt: number;
}

export interface Participant {
  userId: string;
  name: string;
  avatar?: string;
  color: string;
  cursor?: CursorPosition;
  selection?: SelectionRange;
  role: 'owner' | 'editor' | 'viewer';
  joinedAt: number;
  lastSeenAt: number;
}

export interface CursorPosition {
  x: number;
  y: number;
  line?: number;
  column?: number;
}

export interface SelectionRange {
  start: { line: number; column: number };
  end: { line: number; column: number };
}

export interface CollaborationEvent {
  id: string;
  sessionId: string;
  userId: string;
  type:
    | 'cursor-move'
    | 'selection-change'
    | 'text-edit'
    | 'presence-update'
    | 'message-add'
    | 'artifact-update';
  data: unknown;
  timestamp: number;
}

export interface TextEdit {
  position: number;
  deleteLength?: number;
  insertText?: string;
}
```

### 2.2 Collaboration Manager (WebRTC/WebSocket)

**File**: `apps/web/lib/collaboration/manager.ts`

```typescript
import type {
  CollaborationSession,
  CollaborationEvent,
  Participant,
  TextEdit,
} from './types';

export class CollaborationManager {
  private sessions: Map<string, CollaborationSession> = new Map();
  private peers: Map<string, RTCPeerConnection> = new Map();
  private dataChannels: Map<string, RTCDataChannel> = new Map();
  private eventListeners: Map<string, Set<(event: CollaborationEvent) => void>> =
    new Map();

  async createSession(
    documentId: string,
    documentType: 'chat' | 'artifact' | 'document',
    userId: string
  ): Promise<CollaborationSession> {
    const session: CollaborationSession = {
      id: `session-${Date.now()}`,
      documentId,
      documentType,
      participants: [],
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.sessions.set(session.id, session);

    // Join as owner
    await this.joinSession(session.id, userId, 'owner');

    return session;
  }

  async joinSession(
    sessionId: string,
    userId: string,
    role: 'editor' | 'viewer' = 'editor'
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // In production, this would:
    // 1. Connect to signaling server (WebSocket)
    // 2. Exchange WebRTC offers/answers
    // 3. Establish P2P connections

    // Simulated participant
    const participant: Participant = {
      userId,
      name: `User ${userId.slice(0, 4)}`,
      color: this.generateColor(userId),
      role,
      joinedAt: Date.now(),
      lastSeenAt: Date.now(),
    };

    session.participants.push(participant);
    session.updatedAt = Date.now();

    // Broadcast presence event
    this.broadcastEvent(sessionId, {
      type: 'presence-update',
      data: { participant, action: 'joined' },
    });
  }

  async leaveSession(sessionId: string, userId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.participants = session.participants.filter(
      (p) => p.userId !== userId
    );
    session.updatedAt = Date.now();

    // Clean up P2P connections
    const peerKey = `${sessionId}-${userId}`;
    const peer = this.peers.get(peerKey);
    if (peer) {
      peer.close();
      this.peers.delete(peerKey);
    }

    this.broadcastEvent(sessionId, {
      type: 'presence-update',
      data: { userId, action: 'left' },
    });
  }

  async updateCursor(
    sessionId: string,
    userId: string,
    cursor: Participant['cursor']
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const participant = session.participants.find((p) => p.userId === userId);
    if (participant) {
      participant.cursor = cursor;
      participant.lastSeenAt = Date.now();
      session.updatedAt = Date.now();
    }

    this.broadcastEvent(sessionId, {
      type: 'cursor-move',
      data: { userId, cursor },
    });
  }

  async updateSelection(
    sessionId: string,
    userId: string,
    selection: Participant['selection']
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const participant = session.participants.find((p) => p.userId === userId);
    if (participant) {
      participant.selection = selection;
      participant.lastSeenAt = Date.now();
      session.updatedAt = Date.now();
    }

    this.broadcastEvent(sessionId, {
      type: 'selection-change',
      data: { userId, selection },
    });
  }

  async sendTextEdit(
    sessionId: string,
    userId: string,
    edit: TextEdit
  ): Promise<void> {
    // Use Operational Transformation or CRDT for conflict resolution
    // This is a simplified version

    this.broadcastEvent(sessionId, {
      type: 'text-edit',
      data: { userId, edit },
    });
  }

  on(
    sessionId: string,
    eventType: string,
    callback: (event: CollaborationEvent) => void
  ): () => void {
    const key = `${sessionId}-${eventType}`;
    if (!this.eventListeners.has(key)) {
      this.eventListeners.set(key, new Set());
    }
    this.eventListeners.get(key)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.eventListeners.get(key)?.delete(callback);
    };
  }

  private broadcastEvent(
    sessionId: string,
    event: Omit<CollaborationEvent, 'id' | 'sessionId' | 'timestamp'>
  ): void {
    const collaborationEvent: CollaborationEvent = {
      id: `event-${Date.now()}`,
      sessionId,
      ...event,
      timestamp: Date.now(),
    };

    // Broadcast to all participants in the session
    // In production, this would use WebSocket or WebRTC data channels
    const key = `${sessionId}-${event.type}`;
    this.eventListeners.get(key)?.forEach((callback) => {
      callback(collaborationEvent);
    });
  }

  private generateColor(userId: string): string {
    const colors = [
      '#ef4444', '#f97316', '#f59e0b', '#84cc16',
      '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6',
      '#d946ef', '#f43f5e',
    ];

    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }

    return colors[Math.abs(hash) % colors.length];
  }

  getSession(sessionId: string): CollaborationSession | undefined {
    return this.sessions.get(sessionId);
  }

  getActiveSessions(): CollaborationSession[] {
    return Array.from(this.sessions.values()).filter(
      (s) => s.status === 'active'
    );
  }
}

export const collaborationManager = new CollaborationManager();
```

### 2.3 Collaborative Cursors Component

**File**: `apps/web/components/collaboration/collaborative-cursors.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { collaborationManager } from '@/lib/collaboration/manager';
import type { Participant } from '@/lib/collaboration/types';
import { cn } from '@/lib/utils';

interface CollaborativeCursorsProps {
  sessionId: string;
}

export function CollaborativeCursors({
  sessionId,
}: CollaborativeCursorsProps) {
  const { user } = useAuth();
  const [participants, setParticipants] = useState<Participant[]>([]);

  useEffect(() => {
    const session = collaborationManager.getSession(sessionId);
    if (!session) return;

    setParticipants(session.participants.filter((p) => p.userId !== user?.id));

    // Subscribe to cursor updates
    const unsubscribe = collaborationManager.on(
      sessionId,
      'cursor-move',
      (event) => {
        const session = collaborationManager.getSession(sessionId);
        if (!session) return;

        setParticipants(
          session.participants.filter((p) => p.userId !== user?.id)
        );
      }
    );

    return unsubscribe;
  }, [sessionId, user?.id]);

  if (participants.length === 0) {
    return null;
  }

  return (
    <>
      {participants.map((participant) => (
        <Cursor key={participant.userId} participant={participant} />
      ))}
    </>
  );
}

interface CursorProps {
  participant: Participant;
}

function Cursor({ participant }: CursorProps) {
  if (!participant.cursor) return null;

  return (
    <div
      className="pointer-events-none fixed z-50 transition-all duration-100"
      style={{
        left: participant.cursor.x,
        top: participant.cursor.y,
      }}
    >
      {/* Cursor */}
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ color: participant.color }}
      >
        <path
          d="M5.5 3.21V20.8c0 .45.54.67.85.42l5.8-4.26a.5.5 0 0 1 .59-.01l4.2 3.82c.31.28.87.06.87-.35V3.21c0-.41-.56-.63-.87-.35l-4.2 3.82a.5.5 0 0 1-.59-.01L6.35 2.86c-.31-.25-.85-.03-.85.35z"
          fill="currentColor"
          stroke="white"
          strokeWidth="1"
        />
      </svg>

      {/* Name tag */}
      <div
        className="ml-4 px-2 py-0.5 rounded text-xs text-white whitespace-nowrap"
        style={{ backgroundColor: participant.color }}
      >
        {participant.name}
      </div>
    </div>
  );
}
```

### 2.4 Participant Avatars Component

**File**: `apps/web/components/collaboration/participant-avatars.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { collaborationManager } from '@/lib/collaboration/manager';
import type { Participant } from '@/lib/collaboration/types';
import { cn } from '@/lib/utils';

interface ParticipantAvatarsProps {
  sessionId: string;
  max?: number;
}

export function ParticipantAvatars({
  sessionId,
  max = 5,
}: ParticipantAvatarsProps) {
  const [participants, setParticipants] = useState<Participant[]>([]);

  useEffect(() => {
    const session = collaborationManager.getSession(sessionId);
    if (!session) return;

    setParticipants(session.participants);

    const unsubscribe = collaborationManager.on(
      sessionId,
      'presence-update',
      () => {
        const session = collaborationManager.getSession(sessionId);
        if (!session) return;
        setParticipants(session.participants);
      }
    );

    return unsubscribe;
  }, [sessionId]);

  const visibleParticipants = participants.slice(0, max);
  const remainingCount = Math.max(0, participants.length - max);

  return (
    <div className="flex items-center -space-x-2">
      {visibleParticipants.map((participant) => (
        <Avatar
          key={participant.userId}
          className="h-8 w-8 border-2 border-background"
          title={participant.name}
        >
          <AvatarImage src={participant.avatar} />
          <AvatarFallback
            style={{ backgroundColor: participant.color }}
            className="text-white text-xs"
          >
            {participant.name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      ))}

      {remainingCount > 0 && (
        <div
          className={cn(
            'h-8 w-8 rounded-full border-2 border-background',
            'flex items-center justify-center',
            'bg-muted text-xs font-medium'
          )}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  );
}
```

---

## Summary Phase 2

**Total New Files**: ~40 files
**Total Lines of Code**: ~12,000 lines
**Key Features**:
1. Multi-agent architecture with routing and handoff
2. Custom agent builder with capability selection
3. Real-time collaboration via WebRTC/WebSocket
4. Collaborative cursors and presence
5. P2P data channels for low-latency updates

**Dependencies Added**:
- SimplePeer (WebRTC wrapper)
- Yjs or Automerge (CRDT for collaborative editing)
- WebSocket signaling server (or use Cloudflare Durable Objects)

Continue to Phase 3 for Autonomous Agents and Spatial Interfaces...
