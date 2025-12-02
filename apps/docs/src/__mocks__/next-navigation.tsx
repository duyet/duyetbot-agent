'use client';

import { useCallback } from 'react';

// Mock the Next.js App Router's useRouter hook
export function useRouter() {
  const push = useCallback((href: string) => {
    // In test environment, we can just log the navigation
    console.log('Mock navigation to:', href);
  }, []);

  const replace = useCallback((href: string) => {
    console.log('Mock replace to:', href);
  }, []);

  const back = useCallback(() => {
    console.log('Mock back');
  }, []);

  const forward = useCallback(() => {
    console.log('Mock forward');
  }, []);

  const refresh = useCallback(() => {
    console.log('Mock refresh');
  }, []);

  const prefetch = useCallback((href: string) => {
    console.log('Mock prefetch:', href);
  }, []);

  return {
    push,
    replace,
    back,
    forward,
    refresh,
    prefetch,
  };
}

export function usePathname() {
  return '/';
}

export function useSearchParams() {
  return new URLSearchParams();
}

export function useParams() {
  return {};
}

export function redirect(url: string): never {
  throw new Error(`NEXT_REDIRECT: ${url}`);
}

export function notFound(): never {
  throw new Error('NEXT_NOT_FOUND');
}
