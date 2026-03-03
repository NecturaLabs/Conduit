import {
  Radio,
  Settings,
  Layers,
  BarChart3,
  Smartphone,
  Palette,
  MessageSquare,
  Fingerprint,
} from 'lucide-react';
import { FadeInSection } from './FadeIn';

const FEATURES = [
  {
    icon: Radio,
    title: 'Real-Time Sessions',
    description:
      'Watch AI agents work in real-time via SSE streaming. See every tool call, file edit, and decision as it happens.',
  },
  {
    icon: Settings,
    title: 'Remote Config',
    description:
      'Edit agent configuration from anywhere. Changes are queued and applied on the next session start — no restarts needed.',
  },
  {
    icon: Layers,
    title: 'Multi-Agent',
    description:
      'Monitor both OpenCode and Claude Code from one unified interface. One dashboard for all your agents.',
  },
  {
    icon: MessageSquare,
    title: 'Prompt Relay',
    description:
      'Send prompts to running agents directly from the dashboard. Messages are delivered in real-time via MCP.',
  },
  {
    icon: Fingerprint,
    title: 'Device Flow Pairing',
    description:
      'Pair agents with a simple code — no manual config files. Enter a code in the dashboard and your agent is connected.',
  },
  {
    icon: BarChart3,
    title: 'Metrics & Analytics',
    description:
      'Track token usage, session duration, and tool calls over time. Know exactly where your budget goes.',
  },
  {
    icon: Smartphone,
    title: 'Mobile-First',
    description:
      'Designed for your phone first. Check on agents from the couch, the bus, or a hammock.',
  },
  {
    icon: Palette,
    title: '12 Beautiful Themes',
    description:
      'Midnight, Phosphor, Frost, Aurora, Ember, Ocean, Rose, Cobalt, Sakura, Copper, Slate, Neon — pick your vibe. Every theme crafted for readability.',
  },
] as const;

export function Features() {
  return (
    <section id="features" aria-labelledby="features-heading" className="relative py-28 sm:py-36">
      <div className="mx-auto max-w-7xl px-6">
        <FadeInSection className="text-center">
          <h2 id="features-heading" className="text-3xl font-bold tracking-tight sm:text-4xl">
            Everything you need to&nbsp;
            <span className="gradient-text">manage your agents</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted sm:text-lg">
            Built by vibe coders, for vibe coders. No bloat, no enterprise fluff — just the tools
            you actually need.
          </p>
        </FadeInSection>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <FadeInSection key={f.title}>
              <div className="card-glow group h-full rounded-2xl border border-border bg-surface/50 p-7">
                <div className="mb-4 inline-flex items-center justify-center rounded-xl border border-border bg-base p-3 text-accent transition-colors group-hover:border-accent/40">
                  <f.icon aria-hidden="true" className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 leading-relaxed text-muted text-sm">{f.description}</p>
              </div>
            </FadeInSection>
          ))}
        </div>
      </div>
    </section>
  );
}
