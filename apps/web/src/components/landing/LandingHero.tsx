'use client';

import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

interface LandingHeroProps {
  userName: string;
  mode: 'chat' | 'agent';
}

/**
 * Gets time-based greeting based on current hour
 * Morning: 5-12, Afternoon: 12-17, Evening: 17-21, Night: 21-5
 */
function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) {
    return 'morning';
  }
  if (hour >= 12 && hour < 17) {
    return 'afternoon';
  }
  if (hour >= 17 && hour < 21) {
    return 'evening';
  }
  return 'night';
}

export function LandingHero({ userName, mode }: LandingHeroProps) {
  const timeOfDay = getTimeOfDay();

  // Determine greeting text based on mode
  const getGreeting = () => {
    if (mode === 'chat') {
      return `Hi, ${userName}`;
    }

    const timeGreeting = {
      morning: 'Good morning',
      afternoon: 'Good afternoon',
      evening: 'Good evening',
      night: 'Good night',
    }[timeOfDay];

    return `${timeGreeting}, how can I help you today?`;
  };

  const greeting = getGreeting();
  const isChatMode = mode === 'chat';

  return (
    <div className={cn('flex size-full items-center justify-center px-4')}>
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
        exit={{ opacity: 0, y: 20 }}
        initial={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        {isChatMode ? (
          <motion.h1
            animate={{ opacity: 1, y: 0 }}
            className="font-semibold text-2xl md:text-3xl lg:text-4xl"
            exit={{ opacity: 0, y: 10 }}
            initial={{ opacity: 0, y: 10 }}
            transition={{ delay: 0.1, duration: 0.4, ease: 'easeOut' }}
          >
            {greeting}
          </motion.h1>
        ) : (
          <>
            <motion.h2
              animate={{ opacity: 1, y: 0 }}
              className="font-semibold text-2xl md:text-3xl lg:text-4xl"
              exit={{ opacity: 0, y: 10 }}
              initial={{ opacity: 0, y: 10 }}
              transition={{ delay: 0.1, duration: 0.4, ease: 'easeOut' }}
            >
              {greeting.split(',')[0]}
            </motion.h2>
            <motion.p
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 text-lg text-muted-foreground md:text-xl lg:text-2xl"
              exit={{ opacity: 0, y: 10 }}
              initial={{ opacity: 0, y: 10 }}
              transition={{ delay: 0.2, duration: 0.4, ease: 'easeOut' }}
            >
              {greeting.split(',')[1]?.trim()}
            </motion.p>
          </>
        )}
      </motion.div>
    </div>
  );
}
