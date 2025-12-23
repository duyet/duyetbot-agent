/**
 * OAuth Callback Page
 *
 * This page handles the OAuth callback redirect from GitHub.
 * It's a client-side page that shows loading state while
 * the API callback route handles the actual authentication.
 */

'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const error = searchParams.get('error');

    if (error) {
      // Redirect to home with error message
      router.replace(`/?error=${error}`);
    } else {
      // Successful callback, redirect to home
      router.replace('/');
    }
  }, [router, searchParams]);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-gray-900" />
        <p className="text-lg text-gray-600">Completing sign in...</p>
      </div>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <div className="text-center">
            <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-gray-900" />
            <p className="text-lg text-gray-600">Loading...</p>
          </div>
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
