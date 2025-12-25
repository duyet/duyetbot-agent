'use client';

import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

interface LandingHeroProps {
  userName?: string;
  mode?: 'chat' | 'agent';
}

export function LandingHero({ userName, mode }: LandingHeroProps) {
  return (
    <div className={cn('flex size-full items-center justify-center px-4')}>
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
        initial={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <motion.h1
          animate={{ opacity: 1, y: 0 }}
          className="font-semibold text-2xl md:text-3xl lg:text-4xl"
          initial={{ opacity: 0, y: 10 }}
          transition={{ delay: 0.1, duration: 0.4, ease: 'easeOut' }}
        >
          What can I help with today?
        </motion.h1>
      </motion.div>
    </div>
  );
}
