import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { Shell } from '@/components/layout/shell';
import { MCPContent } from '@/components/mcp/mcp-content';

export default function MCPPage() {
  return (
    <Shell title="MCP Servers" description="Model Context Protocol server status and configuration">
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: 'Dashboard', href: '/' }, { label: 'MCP Servers' }]} />
        <MCPContent />
      </div>
    </Shell>
  );
}
