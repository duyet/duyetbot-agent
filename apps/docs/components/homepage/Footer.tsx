export function Footer() {
  return (
    <footer className="border-t border-fd-border py-8 text-center text-xs text-fd-muted-foreground">
      <div className="flex items-center justify-center gap-2">
        <a
          href="https://github.com/duyet/duyetbot-agent"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-[#f38020] transition-colors"
        >
          GitHub
        </a>
        <span>•</span>
        <a
          href="/docs"
          className="hover:text-[#f38020] transition-colors"
        >
          Docs
        </a>
        <span>•</span>
        <a
          href="https://workers.cloudflare.com"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-[#f38020] transition-colors"
        >
          Built with Cloudflare
        </a>
      </div>
    </footer>
  );
}
