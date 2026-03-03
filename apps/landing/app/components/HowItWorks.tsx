import { Server, Cloud } from 'lucide-react';
import { FadeInSection } from './FadeIn';

const SELF_HOSTED_STEPS = [
  { step: '01', label: 'Clone the repo', code: 'git clone <repo-url>' },
  { step: '02', label: 'Run setup', code: './scripts/setup.sh' },
  { step: '03', label: 'Start everything', code: 'docker compose up' },
  { step: '04', label: 'Open your browser', code: 'http://localhost:5173' },
];

const CLOUD_STEPS = [
  { step: '01', label: 'Sign up with your email' },
  { step: '02', label: 'Add the MCP server to your agent config' },
  { step: '03', label: 'Pair with a device code — no manual setup' },
  { step: '04', label: 'Done — monitor from anywhere' },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-it-works-heading" className="relative py-28 sm:py-36">
      <div className="mx-auto max-w-7xl px-6">
        <FadeInSection className="text-center">
          <h2 id="how-it-works-heading" className="text-3xl font-bold tracking-tight sm:text-4xl">
            Up and running in&nbsp;
            <span className="gradient-text">minutes</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted sm:text-lg">
            Choose your path. Both give you the full Conduit experience.
          </p>
        </FadeInSection>

        <div className="mt-16 grid gap-8 lg:grid-cols-2">
          {/* Self-Hosted Track */}
          <FadeInSection>
            <div className="card-glow h-full rounded-2xl border border-border bg-surface/50 p-8">
              <div className="mb-6 flex items-center gap-3">
                <div className="inline-flex items-center justify-center rounded-xl border border-border bg-base p-3 text-accent">
                  <Server aria-hidden="true" className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Self-Hosted</h3>
                  <span className="text-sm font-medium text-success">Free Forever</span>
                </div>
              </div>

              <ol className="space-y-5">
                {SELF_HOSTED_STEPS.map((s) => (
                  <li key={s.step} className="flex gap-4">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-xs font-bold text-accent">
                      {s.step}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{s.label}</p>
                      {s.code && (
                        <code className="mt-1 block overflow-x-auto rounded-lg bg-base px-3 py-2 text-xs text-muted">
                          {s.code}
                        </code>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </FadeInSection>

          {/* Cloud Track */}
          <FadeInSection>
            <div className="card-glow h-full rounded-2xl border border-border bg-surface/50 p-8">
              <div className="mb-6 flex items-center gap-3">
                <div className="inline-flex items-center justify-center rounded-xl border border-border bg-base p-3 text-accent">
                  <Cloud aria-hidden="true" className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Conduit Cloud</h3>
                  <span className="text-sm font-medium text-accent">7-day free trial</span>
                </div>
              </div>

              <ol className="space-y-5">
                {CLOUD_STEPS.map((s) => (
                  <li key={s.step} className="flex gap-4">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-xs font-bold text-accent">
                      {s.step}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{s.label}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="mt-8">
                <a
                  href="/app/auth"
                  className="inline-flex w-full items-center justify-center rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-base transition-colors hover:bg-accent-hover"
                >
                  Start Free Trial
                </a>
                <p className="mt-2 text-center text-xs text-muted">No credit card required</p>
              </div>
            </div>
          </FadeInSection>
        </div>
      </div>
    </section>
  );
}
