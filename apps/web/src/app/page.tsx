/**
 * Home Page
 *
 * Main entry point for the app. Uses query params for session ID (?id=...)
 * to support static export. The ChatInterface component handles client-side
 * session loading from URL params.
 */

import { ChatInterface } from '@/components/chat-interface';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { DataStreamProvider } from '@/components/data-stream-provider';
import type { SessionUser } from '@/lib/session';

interface HomePageProps {
  searchParams: Promise<{ id?: string }>;
}

/**
 * Get session user from cookie
 * This runs on the server in development, but for static export
 * the page will be pre-rendered and session check happens client-side
 */
async function getSessionUser(): Promise<SessionUser | null> {
  // In static export mode, we can't do server-side data fetching
  // The client component will handle session checking
  return null;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  // For static export, we render without server-side data
  // The ChatInterface component handles all the logic client-side
  const user = await getSessionUser();

  return (
    <DataStreamProvider>
      <DataStreamHandler />
      <ChatInterface user={user ?? undefined} />
    </DataStreamProvider>
  );
}
