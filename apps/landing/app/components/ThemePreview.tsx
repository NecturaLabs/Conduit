import { FadeInSection } from './FadeIn';

const THEMES = [
  {
    name: 'Midnight',
    description: 'Deep navy dark mode. Easy on the eyes, built for late-night coding.',
    base: '#0b0f18',
    surface: '#131926',
    border: '#253044',
    text: '#e8edf5',
    muted: '#6b7a94',
    accent: '#5b9ef5',
  },
  {
    name: 'Phosphor',
    description: 'Retro green-on-black terminal aesthetic. Maximum hacker vibes.',
    base: '#020c02',
    surface: '#071507',
    border: '#153515',
    text: '#88f088',
    muted: '#5a9a5a',
    accent: '#4ade80',
  },
  {
    name: 'Frost',
    description: 'Clean light theme with crisp blues. For when you want something bright.',
    base: '#f4f7fb',
    surface: '#ffffff',
    border: '#d5dde8',
    text: '#0e1726',
    muted: '#5c6b82',
    accent: '#2563eb',
  },
  {
    name: 'Aurora',
    description: 'Deep purple with violet gradients. Cosmic, vibrant, beautiful.',
    base: '#0a0815',
    surface: '#130f28',
    border: '#2a2050',
    text: '#e8e0ff',
    muted: '#8878b5',
    accent: '#a78bfa',
  },
  {
    name: 'Ember',
    description: 'Warm orange tones on deep charcoal. Like coding by firelight.',
    base: '#100804',
    surface: '#1c1008',
    border: '#3a2214',
    text: '#f8ddc5',
    muted: '#b08050',
    accent: '#f97316',
  },
  {
    name: 'Ocean',
    description: 'Deep blues and teals. Calm, focused, and endlessly deep.',
    base: '#040d18',
    surface: '#081b30',
    border: '#133454',
    text: '#d0e6f8',
    muted: '#5590bb',
    accent: '#0ea5e9',
  },
  {
    name: 'Rose',
    description: 'Soft pinks on dark backgrounds. Bold but elegant.',
    base: '#100609',
    surface: '#1c0b12',
    border: '#3a1525',
    text: '#fde8f0',
    muted: '#a05070',
    accent: '#f43f5e',
  },
  {
    name: 'Cobalt',
    description: 'Rich indigo and deep blue. Refined and focused.',
    base: '#050810',
    surface: '#0c1222',
    border: '#1c2a50',
    text: '#dce6ff',
    muted: '#6678aa',
    accent: '#4c6ef5',
  },
  {
    name: 'Sakura',
    description: 'Soft cherry-blossom light theme. Warm, elegant, and inviting.',
    base: '#fdf5f7',
    surface: '#ffffff',
    border: '#f0d4dc',
    text: '#1a0810',
    muted: '#8c6070',
    accent: '#e8457a',
  },
  {
    name: 'Copper',
    description: 'Burnished bronze on deep brown. Industrial warmth and character.',
    base: '#0e0906',
    surface: '#1a120c',
    border: '#3a2a1c',
    text: '#f0dcc8',
    muted: '#a08878',
    accent: '#d4885a',
  },
  {
    name: 'Slate',
    description: 'Neutral grays with steel-blue accents. Minimal and distraction-free.',
    base: '#101214',
    surface: '#191c20',
    border: '#2e3338',
    text: '#e0e4e8',
    muted: '#7a828c',
    accent: '#7b9fc4',
  },
  {
    name: 'Neon',
    description: 'Electric cyan on dark violet. Cyberpunk energy, maximum contrast.',
    base: '#06050c',
    surface: '#0e0c18',
    border: '#221c3a',
    text: '#e8e4ff',
    muted: '#7a70a0',
    accent: '#00e5ff',
  },
] as const;

export function ThemePreview() {
  return (
    <section id="themes" aria-labelledby="themes-heading" className="relative py-28 sm:py-36">
      <div className="mx-auto max-w-7xl px-6">
        <FadeInSection className="text-center">
          <h2 id="themes-heading" className="text-3xl font-bold tracking-tight sm:text-4xl">
            Pick your&nbsp;
            <span className="gradient-text">vibe</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted sm:text-lg">
            Twelve hand-crafted themes. Switch any time — your eyes will thank you.
          </p>
        </FadeInSection>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {THEMES.map((t) => (
            <FadeInSection key={t.name}>
              <div className="card-glow overflow-hidden rounded-2xl border border-border">
                {/* Mini dashboard mockup */}
                <div
                  className="p-4"
                  style={{ backgroundColor: t.base }}
                  aria-hidden="true"
                >
                  {/* Title bar */}
                  <div
                    className="flex items-center gap-2 rounded-lg px-3 py-2"
                    style={{ backgroundColor: t.surface, border: `1px solid ${t.border}` }}
                  >
                    <div className="flex gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#f85149' }} />
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#d29922' }} />
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#3fb950' }} />
                    </div>
                    <span className="ml-2 text-[10px] font-medium" style={{ color: t.muted }}>
                      Conduit
                    </span>
                  </div>

                  {/* Fake content */}
                  <div className="mt-2 space-y-1.5">
                    <div
                      className="h-2.5 w-3/4 rounded"
                      style={{ backgroundColor: t.accent, opacity: 0.7 }}
                    />
                    <div
                      className="h-2.5 w-1/2 rounded"
                      style={{ backgroundColor: t.muted, opacity: 0.4 }}
                    />
                    <div className="flex gap-1.5 mt-2">
                      <div
                        className="h-6 flex-1 rounded-lg"
                        style={{ backgroundColor: t.surface, border: `1px solid ${t.border}` }}
                      />
                      <div
                        className="h-6 flex-1 rounded-lg"
                        style={{ backgroundColor: t.surface, border: `1px solid ${t.border}` }}
                      />
                    </div>
                    <div
                      className="mt-1.5 h-10 rounded-lg"
                      style={{ backgroundColor: t.surface, border: `1px solid ${t.border}` }}
                    />
                  </div>
                </div>

                {/* Label */}
                <div className="border-t border-border bg-surface/50 px-4 py-3">
                  <h3 className="text-sm font-bold">{t.name}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{t.description}</p>
                </div>
              </div>
            </FadeInSection>
          ))}
        </div>
      </div>
    </section>
  );
}
