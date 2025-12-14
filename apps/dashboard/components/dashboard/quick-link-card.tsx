import { ArrowUpRight, LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';

interface QuickLinkCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
}

export function QuickLinkCard({ title, description, icon: Icon, href }: QuickLinkCardProps) {
  return (
    <Link href={href} className="group block h-full">
      <Card className="h-full transition-all hover:bg-secondary/40 hover:border-foreground/20">
        <CardContent className="p-6 relative h-full flex flex-col justify-between">
          <div>
            <Icon className="h-6 w-6 text-foreground mb-4" />
            <h3 className="text-base font-semibold mb-1">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <div className="absolute bottom-6 right-6 opacity-0 transition-opacity group-hover:opacity-100">
            <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
