import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <h2 className="mb-4 text-2xl font-bold">Page Not Found</h2>
      <p className="mb-8 text-fd-muted-foreground">The page you are looking for does not exist.</p>
      <Link href="/" className="rounded-md bg-fd-primary px-4 py-2 text-fd-primary-foreground">
        Return Home
      </Link>
    </div>
  );
}
