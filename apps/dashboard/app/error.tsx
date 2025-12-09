'use client';

import { AlertCircle } from 'lucide-react';
import { useEffect } from 'react';
import { Shell } from '@/components/layout/shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
      <Card className="border-destructive">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <CardTitle>Something went wrong</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {errorData.message || 'An unexpected error occurred. Please try again.'}
          </p>
          {errorData.digest && (
            <p className="text-xs font-mono text-muted-foreground break-all">
              Error ID: {errorData.digest}
            </p>
          )}
          <Button onClick={() => reset()} variant="outline">
            Try again
          </Button>
        </CardContent>
      </Card>
    </Shell>
  );
}
