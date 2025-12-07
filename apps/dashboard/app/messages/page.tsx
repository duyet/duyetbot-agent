import { Search } from 'lucide-react';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { Shell } from '@/components/layout/shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function MessagesPage() {
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
            <CardDescription>Messages from the last 24 hours</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between gap-4 border-b border-border last:border-0 pb-4 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">Message from User #{i + 1}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      This is a sample message content that would appear in the messages list...
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">{i + 1} hours ago</p>
                  </div>
                  <Badge variant={i % 2 === 0 ? 'success' : 'info'}>
                    {i % 2 === 0 ? 'Processed' : 'Pending'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </Shell>
  );
}
