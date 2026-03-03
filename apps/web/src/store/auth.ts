import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserProfile } from '@conduit/shared';

interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isOnboarded: boolean;
  setUser: (user: UserProfile) => void;
  clearUser: () => void;
  setOnboarded: (value: boolean) => void;
  /** Fetch user profile from /auth/me (call after confirming session is valid). */
  hydrateUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isOnboarded: false,
      setUser: (user) =>
        set({
          user,
          isAuthenticated: true,
        }),
      clearUser: () =>
        set({
          user: null,
          isAuthenticated: false,
          isOnboarded: false,
        }),
      setOnboarded: (value) => set({ isOnboarded: value }),
      hydrateUser: async () => {
        // Only hydrate if we think we're authenticated but have no user profile
        // (i.e. profile was excluded from localStorage by partialize)
        if (!get().isAuthenticated || get().user) return;
        try {
          // Dynamic import to avoid circular dependency (api.ts imports this store)
          const { api } = await import('@/lib/api');
          const res = await api.get<{ user: UserProfile }>('/auth/me');
          if (res?.user) {
            set({ user: res.user });
          }
        } catch {
          // If /auth/me fails, the session is likely invalid — clearUser will
          // be handled by the 401 interceptor in api.ts
        }
      },
    }),
    {
      name: 'conduit-auth',
      // Only persist auth flags — never write PII (email, user ID) to
      // localStorage where it could be exfiltrated via XSS.
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        isOnboarded: state.isOnboarded,
      }),
    },
  ),
);
