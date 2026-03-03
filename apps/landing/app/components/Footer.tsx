import { Github } from 'lucide-react';

const LINK_GROUPS = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '/#features' },
      { label: 'Pricing', href: '/pricing/' },
      { label: 'Themes', href: '/#themes' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Documentation', href: '#' },
      { label: 'Self-Host Guide', href: '#' },
      { label: 'Status', href: '#' },
    ],
  },
  {
    title: 'Community',
    links: [
      { label: 'GitHub', href: '#' },
      { label: 'Contributing', href: '#' },
      { label: 'License (MIT)', href: '#' },
    ],
  },
] as const;

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface/30" role="contentinfo">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-5">
          {/* Brand column */}
          <div className="lg:col-span-2">
            <a href="/" className="flex items-center gap-2 text-xl font-bold tracking-tight">
              <span className="inline-block h-7 w-7 rounded-lg bg-accent" aria-hidden="true" />
              Conduit
            </a>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
              The dashboard for AI coding agents. Monitor, configure, and control
              OpenCode &amp; Claude Code from anywhere.
            </p>
            <p className="mt-3 text-xs text-muted/60 italic">Made with AI, for AI.</p>
            <a
              href="#"
              aria-label="Conduit on GitHub"
              className="mt-4 inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-text"
            >
              <Github aria-hidden="true" className="h-4 w-4" />
              GitHub
            </a>
          </div>

          {/* Link groups */}
          {LINK_GROUPS.map((group) => (
            <nav key={group.title} aria-label={`${group.title} links`}>
              <h4 className="text-sm font-semibold">{group.title}</h4>
              <ul className="mt-4 space-y-3">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      {...('external' in link && link.external
                        ? { target: '_blank', rel: 'noopener noreferrer', 'aria-label': `${link.label} (opens in new tab)` }
                        : {})}
                      className="text-sm text-muted transition-colors hover:text-text"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 sm:flex-row">
          <p className="text-xs text-muted">&copy; 2026 Nectura. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted">
              MIT License
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
