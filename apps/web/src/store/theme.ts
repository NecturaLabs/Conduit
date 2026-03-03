import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeName = 'midnight' | 'phosphor' | 'frost' | 'aurora' | 'ember' | 'ocean' | 'rose' | 'cobalt' | 'sakura' | 'copper' | 'slate' | 'neon';

interface ThemeState {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'midnight',
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'conduit-theme',
    },
  ),
);
