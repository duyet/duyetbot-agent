import { EventsContent } from '@/components/events/events-content';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { Shell } from '@/components/layout/shell';

export default function EventsPage() {
  return (
    <Shell title="Events" description="Real-time event timeline and system activities">
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: 'Dashboard', href: '/' }, { label: 'Events' }]} />
        <EventsContent />
      </div>
    </Shell>
  );
}
