import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { Shell } from '@/components/layout/shell';
import { SessionsContent } from '@/components/sessions/sessions-content';

export default function SessionsPage() {
  return (
    <Shell title="Sessions" description="Monitor active and historical user sessions">
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: 'Dashboard', href: '/' }, { label: 'Sessions' }]} />
        <SessionsContent />
      </div>
    </Shell>
  );
}
