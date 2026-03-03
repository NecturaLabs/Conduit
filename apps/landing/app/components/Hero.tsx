import { ArrowRight, Github } from 'lucide-react';

const CTA_HREF = '/app/auth';
const GITHUB_HREF = '#';

export function Hero() {
  return (
    <section className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden pt-20">
      {/* Grid background */}
      <div className="hero-grid pointer-events-none absolute inset-0" aria-hidden="true" />

      {/* Radial glow */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 h-[520px] w-[720px] rounded-full opacity-20 blur-[120px]"
        style={{ background: 'radial-gradient(circle, var(--color-accent) 0%, transparent 70%)' }}
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
        {/* Badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-4 py-1.5 text-xs font-medium text-muted">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-success pulse-glow" />
          Open source &middot; MIT Licensed
        </div>

        {/* Headline */}
        <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
          Your AI agents,{' '}
          <span className="gradient-text">one dashboard.</span>
        </h1>

        {/* Subheadline */}
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted sm:text-xl">
          Monitor, configure, and control OpenCode &amp; Claude Code from your phone.
          Self-host for free, or let us handle it.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href={CTA_HREF}
            className="group inline-flex items-center gap-2 rounded-xl bg-accent px-7 py-3.5 text-sm font-semibold text-base shadow-lg shadow-accent/20 transition-all hover:bg-accent-hover hover:shadow-accent-hover/25 hover:scale-[1.03]"
          >
            Get Started Free
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </a>
          <a
            href={GITHUB_HREF}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface/50 px-7 py-3.5 text-sm font-semibold text-text transition-all hover:border-muted hover:bg-surface hover:scale-[1.03]"
          >
            <Github className="h-4 w-4" />
            Self-Host
          </a>
        </div>

        {/* Social proof hint */}
        <p className="mt-12 text-xs text-muted/70">
          No credit card required &middot; 7-day free trial on Cloud
        </p>
      </div>
    </section>
  );
}
