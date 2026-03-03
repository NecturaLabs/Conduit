import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { useThemeStore } from '@/store/theme';

describe('ThemeToggle', () => {
  beforeEach(() => {
    useThemeStore.setState({ colorScheme: 'system' });
  });

  it('renders all three options', () => {
    render(<ThemeToggle />);
    expect(screen.getByLabelText('System')).toBeInTheDocument();
    expect(screen.getByLabelText('Light')).toBeInTheDocument();
    expect(screen.getByLabelText('Dark')).toBeInTheDocument();
  });

  it('defaults to system scheme', () => {
    render(<ThemeToggle />);
    const systemBtn = screen.getByLabelText('System');
    expect(systemBtn).toHaveAttribute('aria-checked', 'true');
  });

  it('switches to light when clicked', () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByLabelText('Light'));
    expect(useThemeStore.getState().colorScheme).toBe('light');
  });

  it('switches to dark when clicked', () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByLabelText('Dark'));
    expect(useThemeStore.getState().colorScheme).toBe('dark');
  });

  it('switches back to system', () => {
    useThemeStore.setState({ colorScheme: 'dark' });
    render(<ThemeToggle />);
    fireEvent.click(screen.getByLabelText('System'));
    expect(useThemeStore.getState().colorScheme).toBe('system');
  });
});
