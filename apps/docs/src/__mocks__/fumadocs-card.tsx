import type { ReactNode } from 'react';

export function Card({ children }: { children: ReactNode }) {
  return <div className="card">{children}</div>;
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
