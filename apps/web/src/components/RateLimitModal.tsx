'use client';

import { LogIn } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface RateLimitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  remaining: number;
  isWarning: boolean;
}

export function RateLimitModal({
  open,
  onOpenChange,
  remaining,
  isWarning
}: RateLimitModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isWarning ? 'Message Limit Warning' : 'Daily Limit Reached'}
          </DialogTitle>
          <DialogDescription>
            {isWarning ? (
              <>You have {remaining} message{remaining !== 1 ? 's' : ''} left today.</>
            ) : (
              <>You've reached your daily limit of 10 messages. Sign in for unlimited access.</>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          {isWarning ? (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Continue as Guest
            </Button>
          ) : null}
          <Button
            asChild
            className={isWarning ? '' : 'w-full sm:w-auto'}
          >
            <a href="/api/auth/login">
              <LogIn className="mr-2 h-4 w-4" />
              Sign In
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
