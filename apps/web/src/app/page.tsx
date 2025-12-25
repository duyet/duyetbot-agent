/**
 * Home Page (Client Component)
 *
 * Main chat interface with client-side authentication check.
 * Shows login button if not authenticated, chat interface if authenticated.
 *
 * Converted to client component for static export compatibility.
 */

'use client';

import { useEffect, useState } from 'react';
import { ChatInterface } from '../components/chat-interface';
import { DataStreamHandler } from '../components/data-stream-handler';
import { DataStreamProvider } from '../components/data-stream-provider';
import { SessionUser } from '../lib/session';

export default function HomePage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check session on mount
    async function checkSession() {
      try {
        const response = await fetch('/api/sessions');
        if (response.ok) {
          const data = (await response.json()) as { user: SessionUser };
          setUser(data.user);
        }
      } catch (error) {
        console.error('Failed to check session:', error);
      } finally {
        setLoading(false);
      }
    }
    checkSession();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Show chat interface (supports both authenticated users and guests)
  // Pass user if authenticated, undefined for guests
  return (
    <DataStreamProvider>
      <DataStreamHandler />
      <ChatInterface user={user ?? undefined} />
    </DataStreamProvider>
  );
}
