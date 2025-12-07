import { Activity } from 'lucide-react';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { Shell } from '@/components/layout/shell';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function RealtimePage() {
  return (
    <Shell
      title="Real-time Monitor"
      description="Live monitoring of system activities and agent status"
    >
      <div className="space-y-6">
        {/* Breadcrumbs */}
        <Breadcrumbs items={[{ label: 'Dashboard', href: '/' }, { label: 'Real-time' }]} />

        {/* Live Agents */}
        <Card>
          <CardHeader>
            <CardTitle>Active Agents</CardTitle>
            <CardDescription>Currently running agents and their status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { name: 'Telegram Bot', status: 'online', messages: 234 },
                { name: 'GitHub Bot', status: 'online', messages: 89 },
                { name: 'Research Agent', status: 'online', messages: 45 },
              ].map((agent) => (
                <div
                  key={agent.name}
                  className="flex items-center justify-between border-b border-border last:border-0 pb-4 last:pb-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-green-500 animate-pulse" />
                      <p className="text-sm font-medium">{agent.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-muted-foreground">
                      {agent.messages} messages
                    </p>
                    <Badge variant="success">{agent.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Live Metrics */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Requests/min</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">1,234</div>
              <div className="h-2 w-full rounded-full bg-secondary mt-3">
                <div className="h-full w-[65%] rounded-full bg-primary" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">Peak capacity at 2000/min</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Latency (avg)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">245ms</div>
              <div className="h-2 w-full rounded-full bg-secondary mt-3">
                <div className="h-full w-[30%] rounded-full bg-green-500" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">Within acceptable range</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activities */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Activities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0"
                >
                  <p className="text-muted-foreground">Activity event #{i + 1}</p>
                  <p className="text-xs text-muted-foreground">{i} seconds ago</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </Shell>
  );
}
