'use client';

import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Code,
  FileSearch,
  HelpCircle,
  Lightbulb,
  MessageSquare,
  PenTool,
  Presentation,
  Rocket,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  Wand2,
} from 'lucide-react';
import { motion } from 'motion/react';
import type { SubAgentId } from '@/lib/constants';
import { getQuickActions, type QuickAction } from '@/lib/quick-actions';
import { cn } from '@/lib/utils';

interface QuickActionsProps {
  mode: 'chat' | 'agent';
  subAgentId?: SubAgentId;
  onActionClick: (prompt: string) => void;
}

// Icon mapping with proper types
const iconMap: Record<string, LucideIcon> = {
  Presentation,
  Code,
  Wand2,
  Sparkles,
  Search,
  FileSearch,
  TrendingUp,
  BarChart3,
  Target,
  MessageSquare,
  Lightbulb,
  Rocket,
  PenTool,
  HelpCircle,
};

/**
 * Get icon component by name from the icon map
 * Falls back to HelpCircle if icon name is not found
 */
function getIcon(name: string): LucideIcon {
  return iconMap[name] || HelpCircle;
}

/**
 * QuickActions Component
 *
 * Displays dynamic action chips below the input based on mode and selected agent.
 * Each chip has an icon and label, and when clicked, inserts the action's prompt
 * into the input field with staggered entrance animations.
 */
export function QuickActions({ mode, subAgentId, onActionClick }: QuickActionsProps) {
  const actions = getQuickActions(mode, subAgentId);

  if (actions.length === 0) {
    return null;
  }

  return (
    <motion.div
      className="flex flex-wrap justify-center gap-2"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {actions.map((action, index) => (
        <QuickActionChip
          key={action.id}
          action={action}
          index={index}
          onActionClick={onActionClick}
        />
      ))}
    </motion.div>
  );
}

interface QuickActionChipProps {
  action: QuickAction;
  index: number;
  onActionClick: (prompt: string) => void;
}

/**
 * Individual quick action chip with staggered animation
 */
function QuickActionChip({ action, index, onActionClick }: QuickActionChipProps) {
  const IconComponent = getIcon(action.icon);

  return (
    <motion.button
      className={cn(
        'flex items-center gap-2',
        'rounded-full border border-border',
        'px-4 py-2',
        'text-xs font-medium',
        'bg-background text-foreground',
        'hover:bg-muted hover:border-muted-foreground',
        'transition-colors duration-200',
        'cursor-pointer',
        'active:scale-95 transition-transform'
      )}
      onClick={() => onActionClick(action.prompt)}
      initial={{ opacity: 0, scale: 0.8, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{
        duration: 0.3,
        delay: index * 0.05,
        ease: 'easeOut',
      }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      {IconComponent && <IconComponent className="h-4 w-4 flex-shrink-0" aria-hidden="true" />}
      <span>{action.label}</span>
    </motion.button>
  );
}
