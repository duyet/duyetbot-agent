import { DashboardContent } from '@/components/dashboard/dashboard-content';
import { Shell } from '@/components/layout/shell';

export default function DashboardPage() {
  return (
    <Shell
      title="Dashboard Overview"
      description="Welcome to duyetbot. Here is your system overview."
    >
      <DashboardContent />
    </Shell>
  );
}
