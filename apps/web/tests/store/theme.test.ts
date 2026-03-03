import { describe, it, expect, beforeEach } from 'vitest';
import { useThemeStore } from '@/store/theme';

describe('theme store', () => {
  beforeEach(() => {
    useThemeStore.setState({
      theme: 'midnight',
      colorScheme: 'system',
    });
  });

  it('has correct default values', () => {
    const state = useThemeStore.getState();
    expect(state.theme).toBe('midnight');
    expect(state.colorScheme).toBe('system');
  });

  it('setTheme updates theme', () => {
    useThemeStore.getState().setTheme('phosphor');
    expect(useThemeStore.getState().theme).toBe('phosphor');
  });

  it('setTheme to frost', () => {
    useThemeStore.getState().setTheme('frost');
    expect(useThemeStore.getState().theme).toBe('frost');
  });

  it('setTheme to aurora', () => {
    useThemeStore.getState().setTheme('aurora');
    expect(useThemeStore.getState().theme).toBe('aurora');
  });

  it('setColorScheme updates scheme', () => {
    useThemeStore.getState().setColorScheme('dark');
    expect(useThemeStore.getState().colorScheme).toBe('dark');
  });

  it('setColorScheme to light', () => {
    useThemeStore.getState().setColorScheme('light');
    expect(useThemeStore.getState().colorScheme).toBe('light');
  });

  it('setColorScheme back to system', () => {
    useThemeStore.getState().setColorScheme('dark');
    useThemeStore.getState().setColorScheme('system');
    expect(useThemeStore.getState().colorScheme).toBe('system');
  });
});
