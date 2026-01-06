'use client';

import { AlertCircle } from 'lucide-react';
import { useEffect } from 'react';
import { Shell } from '@/components/layout/shell';

export default function ErrorPage({
  error: errorData,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(errorData);
  }, [errorData]);

  return (
    <Shell>
      <div className="rounded-lg border border-destructive bg-card text-card-foreground shadow-sm">
        <div className="flex flex-col space-y-1.5 p-6">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <h3 className="text-2xl font-semibold leading-none tracking-tight">
              Something went wrong
            </h3>
          </div>
        </div>
        <div className="p-6 pt-0 space-y-4">
          <p className="text-sm text-muted-foreground">
            {errorData.message || 'An unexpected error occurred. Please try again.'}
          </p>
          {errorData.digest && (
            <p className="text-xs font-mono text-muted-foreground break-all">
              Error ID: {errorData.digest}
            </p>
          )}
          <button
            onClick={() => reset()}
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2"
          >
            Try again
          </button>
        </div>
      </div>
    </Shell>
  );
}
