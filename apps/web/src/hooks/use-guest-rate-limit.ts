'use client';

import { useCallback, useEffect, useState } from 'react';

const GUEST_LIMIT = 10;
const STORAGE_KEY = 'duyetbot-guest-message-count';
const STORAGE_DATE_KEY = 'duyetbot-guest-count-date';

export function useGuestRateLimit(isAuthenticated: boolean) {
  const [messageCount, setMessageCount] = useState(0);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitWarning, setLimitWarning] = useState(false);

  // Load count from localStorage on mount
  useEffect(() => {
    if (isAuthenticated) return; // Only track for guests
    if (typeof window === 'undefined') return; // Skip SSR

    const storedDate = localStorage.getItem(STORAGE_DATE_KEY);
    const today = new Date().toDateString();

    // Reset if new day
    if (storedDate !== today) {
      localStorage.setItem(STORAGE_DATE_KEY, today);
      localStorage.setItem(STORAGE_KEY, '0');
      setMessageCount(0);
    } else {
      const count = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
      setMessageCount(count);

      // Show warning at 8 messages
      if (count >= 8) {
        setLimitWarning(true);
      }
    }
  }, [isAuthenticated]);

  const incrementMessageCount = useCallback(() => {
    if (isAuthenticated) return;
    if (typeof window === 'undefined') return; // Skip SSR

    const newCount = messageCount + 1;
    localStorage.setItem(STORAGE_KEY, String(newCount));
    setMessageCount(newCount);

    // Show modal at limit
    if (newCount >= GUEST_LIMIT) {
      setShowLimitModal(true);
    }
    // Show warning at 8 messages
    else if (newCount >= 8) {
      setLimitWarning(true);
    }
  }, [messageCount, isAuthenticated]);

  const remaining = GUEST_LIMIT - messageCount;

  return {
    messageCount,
    remaining,
    showLimitModal,
    limitWarning,
    incrementMessageCount,
    setShowLimitModal,
  };
}
