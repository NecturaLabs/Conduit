import { Check } from 'lucide-react';
import { useThemeStore, type ThemeName } from '@/store/theme';
import { cn } from '@/lib/utils';

interface ThemeConfig {
  name: ThemeName;
  label: string;
  base: string;
  surface: string;
  accent: string;
  text: string;
}

const themes: ThemeConfig[] = [
  { name: 'midnight', label: 'Midnight', base: '#080c14', surface: '#111827', accent: '#5b9ef5', text: '#e8edf5' },
  { name: 'phosphor', label: 'Phosphor', base: '#010a01', surface: '#081808', accent: '#4ade80', text: '#88f088' },
  { name: 'frost', label: 'Frost', base: '#f1f5fb', surface: '#ffffff', accent: '#2563eb', text: '#0e1726' },
  { name: 'aurora', label: 'Aurora', base: '#08060f', surface: '#120e24', accent: '#a78bfa', text: '#e8e0ff' },
  { name: 'ember', label: 'Ember', base: '#0c0602', surface: '#1a0e06', accent: '#f97316', text: '#f8ddc5' },
  { name: 'ocean', label: 'Ocean', base: '#030a14', surface: '#071828', accent: '#0ea5e9', text: '#d0e6f8' },
  { name: 'rose', label: 'Rose', base: '#0c0406', surface: '#1a0a10', accent: '#f43f5e', text: '#fde8f0' },
  { name: 'cobalt', label: 'Cobalt', base: '#04060e', surface: '#0a1020', accent: '#4c6ef5', text: '#dce6ff' },
  { name: 'sakura', label: 'Sakura', base: '#fdf4f6', surface: '#ffffff', accent: '#e8457a', text: '#1a0810' },
  { name: 'copper', label: 'Copper', base: '#0a0704', surface: '#18100a', accent: '#d4885a', text: '#f0dcc8' },
  { name: 'slate', label: 'Slate', base: '#0e1012', surface: '#181c20', accent: '#7b9fc4', text: '#e0e4e8' },
  { name: 'neon', label: 'Neon', base: '#050410', surface: '#0c0a18', accent: '#00e5ff', text: '#e8e4ff' },
];

export function ThemeSwatch() {
  const current = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {themes.map((t) => {
        const isActive = current === t.name;
        return (
          <button
            key={t.name}
            onClick={() => setTheme(t.name)}
            aria-label={`Switch to ${t.label} theme`}
            aria-pressed={isActive}
            className={cn(
              'relative rounded-xl overflow-hidden border-2 transition-all cursor-pointer group min-h-[48px]',
              'hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-base)]',
              isActive
                ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent)] ring-offset-2 ring-offset-[var(--color-base)]'
                : 'border-[var(--color-border)]',
            )}
            style={{ background: t.base }}
          >
            {/* Mini UI preview */}
            <div className="p-2 h-24 sm:h-20 flex flex-col gap-1.5">
              {/* Fake topbar */}
              <div className="flex items-center gap-1" style={{ background: t.surface, borderRadius: 4, padding: '2px 4px' }}>
                <div className="h-1.5 w-1.5 rounded-full" style={{ background: t.accent }} />
                <div className="h-1 flex-1 rounded-full" style={{ background: t.text, opacity: 0.3 }} />
              </div>
              {/* Fake content lines */}
              <div className="h-1 w-3/4 rounded-full" style={{ background: t.text, opacity: 0.2 }} />
              <div className="h-1 w-1/2 rounded-full" style={{ background: t.accent, opacity: 0.6 }} />
              <div className="h-1 w-5/6 rounded-full" style={{ background: t.text, opacity: 0.15 }} />
            </div>
            {/* Label */}
            <div className="px-2 pb-2 text-center">
              <span className="text-xs font-medium" style={{ color: t.text, opacity: 0.8 }}>
                {t.label}
              </span>
            </div>
            {isActive && (
              <div
                className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full flex items-center justify-center"
                style={{ background: t.accent }}
              >
                <Check className="h-2.5 w-2.5" style={{ color: t.base }} />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
