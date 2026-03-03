'use client';

import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import clsx from 'clsx';

const LINKS: { label: string; href: string; external?: boolean }[] = [
  { label: 'Features', href: '/#features' },
  { label: 'Pricing', href: '/pricing/' },
  { label: 'GitHub', href: '#' },
];

const CTA_HREF = '/app/auth';

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={clsx(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        scrolled
          ? 'nav-blur bg-base/80 border-b border-border shadow-lg shadow-black/10'
          : 'bg-transparent',
      )}
    >
      <nav aria-label="Main navigation" className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2 text-xl font-bold tracking-tight text-text">
          <span className="inline-block h-7 w-7 rounded-lg bg-accent" aria-hidden="true" />
          Conduit
        </a>

        {/* Desktop links */}
        <ul className="hidden items-center gap-8 md:flex" role="list">
          {LINKS.map((l) => (
            <li key={l.label}>
              <a
                href={l.href}
                {...(l.external ? { target: '_blank', rel: 'noopener noreferrer', 'aria-label': `${l.label} (opens in new tab)` } : {})}
                className="text-sm font-medium text-muted transition-colors hover:text-text"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        {/* Desktop CTA */}
        <a
          href={CTA_HREF}
          className="hidden rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-base transition-colors hover:bg-accent-hover md:inline-block"
        >
          Get Started
        </a>

        {/* Mobile toggle */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="inline-flex items-center justify-center rounded-md p-2 text-muted transition-colors hover:text-text md:hidden"
          aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav-menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {/* Mobile menu */}
      <div
        id="mobile-nav-menu"
        role="navigation"
        aria-label="Mobile navigation"
        className={clsx(
          'overflow-hidden border-b border-border bg-base/95 nav-blur transition-all duration-300 md:hidden',
          mobileOpen ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0 border-none',
        )}
      >
        <div className="flex flex-col gap-4 px-6 pb-6 pt-2">
          {LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              {...(l.external ? { target: '_blank', rel: 'noopener noreferrer', 'aria-label': `${l.label} (opens in new tab)` } : {})}
              onClick={() => setMobileOpen(false)}
              className="text-sm font-medium text-muted transition-colors hover:text-text"
            >
              {l.label}
            </a>
          ))}
          <a
            href={CTA_HREF}
            className="mt-2 inline-block rounded-lg bg-accent px-5 py-2.5 text-center text-sm font-semibold text-base transition-colors hover:bg-accent-hover"
          >
            Get Started
          </a>
        </div>
      </div>
    </header>
  );
}
