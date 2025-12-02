// Type definitions for homepage architecture diagram components

export type AgentRole =
  | 'router'
  | 'simple'
  | 'orchestrator'
  | 'hitl'
  | 'lead-researcher'
  | 'duyet-info'
  | 'code-worker'
  | 'research-worker'
  | 'github-worker';

export type PlatformType = 'telegram' | 'github' | 'future';

export type FlowStageType = 'inputs' | 'edge' | 'routing' | 'agents';

export interface AgentData {
  id: AgentRole;
  name: string;
  shortName: string;
  role: string;
  description: string;
  triggers: string[];
  routesTo?: string[];
  color: string;
  bgColor: string;
  borderColor: string;
  metrics: {
    avgLatency: string;
    successRate: string;
  };
}

export interface PlatformData {
  id: PlatformType;
  name: string;
  icon: string;
  color: string;
  bgColor: string;
  description: string;
}

export interface UseCaseData {
  id: string;
  title: string;
  triggerExample: string;
  agentPath: string[];
  icon: string;
  description: string;
  platform: PlatformType;
}

export interface TechStackItem {
  name: string;
  icon?: string;
  color: string;
  bgColor: string;
}

export interface ConnectionData {
  from: string;
  to: string;
  animated?: boolean;
}

export interface FlowStageData {
  type: FlowStageType;
  title: string;
  subtitle?: string;
  items: (AgentData | PlatformData | { id: string; label: string })[];
}

// Component Props
export interface AgentNodeProps {
  agent: AgentData;
  isActive: boolean;
  isHighlighted: boolean;
  onClick: (agent: AgentData) => void;
  onHover: (agent: AgentData | null) => void;
  size?: 'sm' | 'md' | 'lg';
}

export interface AgentDetailPanelProps {
  agent: AgentData | null;
  onClose: () => void;
  isOpen: boolean;
}

export interface ConnectionPathProps {
  from: { x: number; y: number };
  to: { x: number; y: number };
  animated?: boolean;
  highlighted?: boolean;
  color?: string;
}

export interface FlowStageProps {
  stage: FlowStageData;
  activeAgent: AgentData | null;
  onAgentClick: (agent: AgentData) => void;
  onAgentHover: (agent: AgentData | null) => void;
}

export interface UseCaseCardProps {
  useCase: UseCaseData;
  onClick?: (useCase: UseCaseData) => void;
}

export interface TechBadgeProps {
  tech: TechStackItem;
}

// State
export interface DiagramState {
  activeAgent: AgentData | null;
  hoveredAgent: AgentData | null;
  highlightedPath: string[];
  isPanelOpen: boolean;
}
