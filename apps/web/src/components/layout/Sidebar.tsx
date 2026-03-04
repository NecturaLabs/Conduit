import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquare,
  Settings as SettingsIcon,
  BarChart3,
  FileCode,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/sessions', label: 'Sessions', icon: MessageSquare },
  { to: '/config', label: 'Config', icon: FileCode },
  { to: '/metrics', label: 'Metrics', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

declare const __COMMIT_SHA__: string;

const commitSha: string = typeof __COMMIT_SHA__ !== 'undefined' ? __COMMIT_SHA__ : 'dev';
const shortSha = commitSha.length > 7 ? commitSha.slice(0, 7) : commitSha;

export function Sidebar() {
  return (
    <>
      {/* Desktop sidebar — always visible at lg+ */}
      <aside
        aria-label="Main navigation"
        className="fixed left-0 z-30 hidden w-60 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] lg:flex"
        style={{
          top: 'calc(3.5rem + var(--sat, 0px))',
          height: 'calc(100dvh - 3.5rem - var(--sat, 0px))',
        }}
      >
        <nav aria-label="Desktop navigation" className="flex flex-1 flex-col gap-1 p-3">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-base)]',
                )
              }
            >
              <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-[var(--color-border)] px-3 py-2">
          <span className="text-[11px] font-mono text-[var(--color-muted)]">
            build {shortSha}
          </span>
        </div>
      </aside>

      {/* Mobile bottom tab bar — visible below lg */}
      <nav
        aria-label="Mobile navigation"
        className="fixed bottom-0 left-0 right-0 z-30 border-t border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur-md lg:hidden"
        style={{ paddingBottom: 'var(--sab, 0px)' }}
      >
        <div className="flex items-stretch justify-around">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
                  isActive
                    ? 'text-[var(--color-accent)]'
                    : 'text-[var(--color-muted)] active:text-[var(--color-text)]',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {/* Pill-shaped active indicator */}
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute top-1.5 flex h-7 w-14 items-center justify-center rounded-full transition-colors duration-200',
                      isActive ? 'bg-[var(--color-accent)]/15' : 'bg-transparent',
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  {/* Spacer to push label below the pill */}
                  <span className="h-7 mt-1.5" aria-hidden="true" />
                  <span className="leading-tight">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
}
