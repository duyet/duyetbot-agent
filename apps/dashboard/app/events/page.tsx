import { Clock } from 'lucide-react';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { Shell } from '@/components/layout/shell';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function EventsPage() {
  return (
    <Shell title="Events" description="Real-time event timeline and system activities">
      <div className="space-y-6">
        {/* Breadcrumbs */}
        <Breadcrumbs items={[{ label: 'Dashboard', href: '/' }, { label: 'Events' }]} />

        {/* Events Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Event Timeline</CardTitle>
            <CardDescription>Recent system events and agent activities</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="flex gap-4 border-l-2 border-border pl-4 relative">
                  <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-primary" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <p className="text-sm font-medium truncate">
                        Event {i + 1}: System Event Occurred
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{i * 15} minutes ago</p>
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                      A detailed description of what happened in this event would appear here...
                    </p>
                  </div>
                  <Badge variant={i % 3 === 0 ? 'success' : i % 3 === 1 ? 'warning' : 'info'}>
                    {['Completed', 'In Progress', 'Pending'][i % 3]}
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
