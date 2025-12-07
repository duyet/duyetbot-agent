import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { Shell } from '@/components/layout/shell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function TokensPage() {
  return (
    <Shell title="Token Usage" description="Monitor your API token consumption and quotas">
      <div className="space-y-6">
        {/* Breadcrumbs */}
        <Breadcrumbs items={[{ label: 'Dashboard', href: '/' }, { label: 'Tokens' }]} />

        {/* Current Usage */}
        <Card>
          <CardHeader>
            <CardTitle>Current Usage</CardTitle>
            <CardDescription>This month's token consumption</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {[
              { model: 'Claude Opus', usage: 45000, limit: 100000 },
              { model: 'Claude Haiku', usage: 55000, limit: 100000 },
              { model: 'Claude 3 Sonnet', usage: 30000, limit: 100000 },
            ].map((item) => (
              <div key={item.model}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">{item.model}</p>
                  <p className="text-sm font-semibold">
                    {item.usage.toLocaleString()} / {item.limit.toLocaleString()}
                  </p>
                </div>
                <div className="h-2 w-full rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${(item.usage / item.limit) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {((item.usage / item.limit) * 100).toFixed(0)}% used
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Statistics */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Total Tokens Used</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">130,000</div>
              <p className="text-xs text-muted-foreground mt-1">This month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Monthly Limit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">300,000</div>
              <p className="text-xs text-muted-foreground mt-1">Total quota</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Remaining</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">170,000</div>
              <p className="text-xs text-muted-foreground mt-1">57% available</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </Shell>
  );
}
