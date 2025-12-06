import type { ReactNode } from 'react';

// fumadocs-ui/components/card mock
interface CardProps {
  title?: string;
  description?: string;
  href?: string;
  children?: ReactNode;
}

export function Card({ title, description, children }: CardProps) {
  return (
    <div className="card">
      {title && <div className="card-title">{title}</div>}
      {description && <div className="card-description">{description}</div>}
      {children}
    </div>
  );
}

export function Cards({ children }: { children: ReactNode }) {
  return <div className="cards">{children}</div>;
}

export function CardHeader({ children }: { children: ReactNode }) {
  return <div className="card-header">{children}</div>;
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <div className="card-title">{children}</div>;
}

export function CardDescription({ children }: { children: ReactNode }) {
  return <div className="card-description">{children}</div>;
}

export function CardContent({ children }: { children: ReactNode }) {
  return <div className="card-content">{children}</div>;
}
