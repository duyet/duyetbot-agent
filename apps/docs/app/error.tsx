'use client';

import Link from 'next/link';

export default function ErrorPage({
  reset: resetError,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <h2 className="mb-4 text-2xl font-bold">Something went wrong</h2>
      <p className="mb-8 text-fd-muted-foreground">An unexpected error occurred.</p>
      <div className="flex gap-4">
        <button
          type="button"
          onClick={resetError}
          className="rounded-md bg-fd-secondary px-4 py-2 text-fd-secondary-foreground"
        >
          Try Again
        </button>
        <Link href="/" className="rounded-md bg-fd-primary px-4 py-2 text-fd-primary-foreground">
          Return Home
        </Link>
      </div>
    </div>
  );
}
