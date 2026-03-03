import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AccessibilityState {
  /** Override reduced-motion even if OS doesn't prefer it */
  reduceMotion: boolean;
  /** Show enhanced focus indicators (thicker, higher contrast) */
  enhancedFocus: boolean;
  /** Use larger touch targets (56px instead of 40-44px) */
  largerTargets: boolean;
  setReduceMotion: (value: boolean) => void;
  setEnhancedFocus: (value: boolean) => void;
  setLargerTargets: (value: boolean) => void;
}

export const useAccessibilityStore = create<AccessibilityState>()(
  persist(
    (set) => ({
      reduceMotion: false,
      enhancedFocus: false,
      largerTargets: false,
      setReduceMotion: (value) => set({ reduceMotion: value }),
      setEnhancedFocus: (value) => set({ enhancedFocus: value }),
      setLargerTargets: (value) => set({ largerTargets: value }),
    }),
    {
      name: 'conduit-accessibility',
    },
  ),
);
