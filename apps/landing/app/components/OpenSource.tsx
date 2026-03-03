import { Github, Star } from 'lucide-react';
import { FadeInSection } from './FadeIn';

const GITHUB_HREF = '#';

export function OpenSource() {
  return (
    <section id="open-source" aria-labelledby="open-source-heading" className="relative py-28 sm:py-36">
      <div className="mx-auto max-w-5xl px-6">
        <FadeInSection>
          <div className="relative overflow-hidden rounded-3xl border border-border bg-surface/50 px-8 py-16 text-center sm:px-16">
            {/* Background glow */}
            <div
              className="pointer-events-none absolute inset-0 opacity-10"
              style={{
                background:
                  'radial-gradient(ellipse at center, var(--color-accent) 0%, transparent 70%)',
              }}
              aria-hidden="true"
            />

            <div className="relative z-10">
              {/* Badge */}
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-base/60 px-4 py-1.5 text-xs font-medium text-muted">
                MIT License
              </div>

              <h2 id="open-source-heading" className="text-3xl font-bold tracking-tight sm:text-4xl">
                Fully&nbsp;
                <span className="gradient-text">open source</span>
              </h2>

              <p className="mx-auto mt-4 max-w-xl text-muted sm:text-lg">
                Conduit is fully open source. Self-host it, fork it, contribute.
                No vendor lock-in, no hidden limits.
              </p>

              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <a
                  href={GITHUB_HREF}
                  aria-label="View Conduit on GitHub"
                  className="group inline-flex items-center gap-2 rounded-xl bg-accent px-7 py-3.5 text-sm font-semibold text-base shadow-lg shadow-accent/20 transition-all hover:bg-accent-hover hover:shadow-accent-hover/25 hover:scale-[1.03]"
                >
                  <Github aria-hidden="true" className="h-4 w-4" />
                  View on GitHub
                </a>
                <a
                  href={GITHUB_HREF}
                  aria-label="Star Conduit on GitHub"
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface/50 px-7 py-3.5 text-sm font-semibold text-text transition-all hover:border-muted hover:bg-surface hover:scale-[1.03]"
                >
                  <Star aria-hidden="true" className="h-4 w-4" />
                  Star on GitHub
                </a>
              </div>
            </div>
          </div>
        </FadeInSection>
      </div>
    </section>
  );
}
