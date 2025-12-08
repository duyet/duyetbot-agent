import { Search } from 'lucide-react';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { Shell } from '@/components/layout/shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface Message {
  id: number;
  message_id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  platform: string;
  user_id: string;
  username?: string;
  input_tokens: number;
  output_tokens: number;
  created_at: number;
  visibility: string;
}

async function getMessages(): Promise<Message[]> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/messages?limit=20`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || [];
  } catch {
    return [];
  }
}

function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default async function MessagesPage() {
  const messages = await getMessages();

  return (
    <Shell title="Messages" description="View and manage all messages from users and agents">
      <div className="space-y-6">
        {/* Breadcrumbs */}
        <Breadcrumbs items={[{ label: 'Dashboard', href: '/' }, { label: 'Messages' }]} />

        {/* Search and Filter */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search messages..." className="pl-10" />
          </div>
          <Button>Export</Button>
        </div>

        {/* Messages List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Messages</CardTitle>
            <CardDescription>
              {messages.length > 0
                ? `Showing ${messages.length} most recent messages`
                : 'No messages yet'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {messages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No messages yet. Start a conversation to see messages here.
                </p>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.message_id || msg.id}
                    className="flex items-start justify-between gap-4 border-b border-border last:border-0 pb-4 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {msg.role}
                        </Badge>
                        <span className="text-xs text-muted-foreground capitalize">
                          {msg.platform}
                        </span>
                        {msg.username && (
                          <span className="text-xs text-muted-foreground">@{msg.username}</span>
                        )}
                      </div>
                      <p className="text-sm font-medium line-clamp-2">{msg.content}</p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <span>{formatTimestamp(msg.created_at)}</span>
                        {(msg.input_tokens > 0 || msg.output_tokens > 0) && (
                          <>
                            <span>•</span>
                            <span>{msg.input_tokens + msg.output_tokens} tokens</span>
                          </>
                        )}
                      </div>
                    </div>
                    <Badge
                      variant={msg.visibility === 'public' ? 'success' : 'secondary'}
                      className="shrink-0"
                    >
                      {msg.visibility}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Shell>
  );
}
