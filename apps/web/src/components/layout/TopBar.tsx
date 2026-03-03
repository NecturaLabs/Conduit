import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, User } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { api } from '@/lib/api';

export function TopBar() {
  const user = useAuthStore((s) => s.user);
  const clearUser = useAuthStore((s) => s.clearUser);
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  async function handleLogout() {
    try {
      await api.post('/auth/logout');
    } catch {
      // proceed regardless
    }
    clearUser();
    navigate('/auth');
  }

  const closeDropdown = useCallback(() => {
    setDropdownOpen(false);
    triggerRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!dropdownOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeDropdown();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [dropdownOpen, closeDropdown]);

  // Focus first menu item when dropdown opens
  useEffect(() => {
    if (dropdownOpen) {
      const firstItem = menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
      firstItem?.focus();
    }
  }, [dropdownOpen]);

  function handleMenuKeyDown(e: React.KeyboardEvent) {
    const items = menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
    if (!items?.length) return;

    const current = document.activeElement as HTMLElement;
    const index = Array.from(items).indexOf(current);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = index < items.length - 1 ? index + 1 : 0;
      (items[next] as HTMLElement | undefined)?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = index > 0 ? index - 1 : items.length - 1;
      (items[prev] as HTMLElement | undefined)?.focus();
    } else if (e.key === 'Tab') {
      closeDropdown();
    }
  }

  return (
    <header
      className="z-40 shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)]"
      style={{ paddingTop: 'var(--sat, 0px)' }}
      role="banner"
    >
    <div className="flex h-14 items-center justify-between px-4 lg:px-6">
      <Link to="/dashboard" className="flex items-center gap-2" aria-label="Conduit — go to dashboard">
        <div
          className="h-7 w-7 rounded-lg bg-[var(--color-accent)] flex items-center justify-center"
          aria-hidden="true"
        >
          <span className="text-[var(--color-base)] font-bold text-sm">C</span>
        </div>
        <span className="text-lg font-semibold text-[var(--color-text)] hidden sm:inline">
          Conduit
        </span>
      </Link>

      <div className="relative">
        <button
          ref={triggerRef}
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2 rounded-full p-1.5 hover:bg-[var(--color-base)] transition-colors cursor-pointer"
          aria-label="User menu"
          aria-haspopup="true"
          aria-expanded={dropdownOpen}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-accent)] text-[var(--color-base)]">
            <User className="h-4 w-4" aria-hidden="true" />
          </div>
        </button>

        {dropdownOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setDropdownOpen(false)}
              aria-hidden="true"
            />
            <div
              ref={menuRef}
              role="menu"
              aria-label="User menu"
              onKeyDown={handleMenuKeyDown}
              className="absolute right-0 top-full mt-2 z-50 w-56 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg py-1"
            >
              <div className="px-4 py-2 border-b border-[var(--color-border)]">
                <p className="text-sm font-medium text-[var(--color-text)] truncate">
                  {user?.displayName ?? 'User'}
                </p>
                <p className="text-xs text-[var(--color-muted)] truncate">
                  {user?.email}
                </p>
              </div>
              <button
                role="menuitem"
                tabIndex={0}
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[var(--color-danger)] hover:bg-[var(--color-base)] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-inset"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </div>
    </header>
  );
}
