import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { Shell } from '@/components/layout/shell';
import { MessagesContent } from '@/components/messages/messages-content';

export default function MessagesPage() {
  return (
    <Shell
      title="Messages"
      description="View and analyze agent conversations."
      headerActions={
        <Breadcrumbs items={[{ label: 'Dashboard', href: '/' }, { label: 'Messages' }]} />
      }
      fullWidth
    >
      <MessagesContent />
    </Shell>
  );
}
