import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { Shell } from '@/components/layout/shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function SettingsPage() {
  return (
    <Shell title="Settings" description="Configure your dashboard and agent preferences">
      <div className="space-y-6">
        {/* Breadcrumbs */}
        <Breadcrumbs items={[{ label: 'Dashboard', href: '/' }, { label: 'Settings' }]} />

        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle>General Settings</CardTitle>
            <CardDescription>Basic configuration for your dashboard</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="dashboard-name" className="text-sm font-medium">
                Dashboard Name
              </label>
              <Input id="dashboard-name" defaultValue="duyetbot Dashboard" />
            </div>
            <div className="space-y-2">
              <label htmlFor="time-zone" className="text-sm font-medium">
                Time Zone
              </label>
              <Input id="time-zone" defaultValue="UTC" type="text" />
            </div>
            <Button>Save Changes</Button>
          </CardContent>
        </Card>

        {/* API Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>API Configuration</CardTitle>
            <CardDescription>Manage API keys and integrations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium">API Keys</h4>
                <Badge variant="info">Active</Badge>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Your API keys are used to authenticate requests to the dashboard API.
              </p>
              <Button variant="outline">Generate New Key</Button>
            </div>

            <div className="border-t border-border pt-6">
              <h4 className="text-sm font-medium mb-2">Webhooks</h4>
              <p className="text-xs text-muted-foreground mb-4">
                Set up webhooks to receive real-time notifications.
              </p>
              <Button variant="outline">Configure Webhooks</Button>
            </div>
          </CardContent>
        </Card>

        {/* Notification Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>Control how you receive updates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: 'Agent status changes', enabled: true },
              { label: 'High error rates', enabled: true },
              { label: 'Token usage alerts', enabled: false },
              { label: 'System maintenance', enabled: true },
            ].map((notif) => (
              <div key={notif.label} className="flex items-center justify-between">
                <p className="text-sm">{notif.label}</p>
                <input
                  type="checkbox"
                  defaultChecked={notif.enabled}
                  className="h-4 w-4 rounded border-input"
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>Actions that cannot be undone</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm mb-2">Reset all settings to default</p>
              <Button variant="destructive" size="sm">
                Reset Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Shell>
  );
}
