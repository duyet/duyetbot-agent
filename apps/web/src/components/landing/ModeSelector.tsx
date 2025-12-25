'use client';

import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

export interface ModeSelectorProps {
  mode: 'chat' | 'agent';
  onModeChange: (mode: 'chat' | 'agent') => void;
}

interface ModeCard {
  id: 'chat' | 'agent';
  name: string;
  description: string;
}

const modeCards: ModeCard[] = [
  {
    id: 'chat',
    name: 'Chat',
    description: 'Quick conversations',
  },
  {
    id: 'agent',
    name: 'Agent',
    description: 'Task automation',
  },
];

/**
 * ModeSelector Component
 *
 * Displays compact chip/pill style mode selection (Chat vs Agent) with:
 * - Purple accent border for active state
 * - Card background with border for inactive state
 * - No icons - just clean text
 * - Staggered entrance animations
 * - Responsive layout (stacked on mobile, side-by-side on desktop)
 */
export function ModeSelector({ mode, onModeChange }: ModeSelectorProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Select mode"
      className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full"
    >
      {modeCards.map((card, index) => {
        const isActive = mode === card.id;

        return (
          <ModeCard
            key={card.id}
            card={card}
            isActive={isActive}
            index={index}
            onClick={() => onModeChange(card.id)}
          />
        );
      })}
    </div>
  );
}

interface ModeCardProps {
  card: ModeCard;
  isActive: boolean;
  index: number;
  onClick: () => void;
}

/**
 * Individual mode card with hover and active states
 * Compact chip/pill style - title only, no description
 */
function ModeCard({ card, isActive, index, onClick }: ModeCardProps) {
  return (
    <motion.button
      type="button"
      role="radio"
      aria-checked={isActive}
      onClick={onClick}
      className={cn(
        'relative flex items-center justify-center',
        'p-3 sm:p-4',
        'rounded-xl',
        'transition-all duration-200 ease-out',
        'cursor-pointer',
        // Active state
        isActive && [
          'border-2 border-accent bg-card',
          'shadow-md',
        ],
        // Inactive state
        !isActive && [
          'border border-border bg-card/50',
          'hover:border-border hover:bg-card hover:shadow-sm',
        ],
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2'
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: index * 0.1,
        ease: 'easeOut',
      }}
      whileHover={isActive ? undefined : { y: -1 }}
      whileTap={{ scale: 0.98 }}
    >
      <h3 className={cn('text-base sm:text-lg font-medium', isActive ? 'text-accent' : 'text-foreground')}>
        {card.name}
      </h3>
    </motion.button>
  );
}
