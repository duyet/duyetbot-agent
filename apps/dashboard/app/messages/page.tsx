import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { Shell } from '@/components/layout/shell';
import { MessagesContent } from '@/components/messages/messages-content';

export default function MessagesPage() {
  return (
    <Shell title="Messages" description="View and manage all messages from users and agents">
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: 'Dashboard', href: '/' }, { label: 'Messages' }]} />
        <MessagesContent />
      </div>
    </Shell>
  );
}
