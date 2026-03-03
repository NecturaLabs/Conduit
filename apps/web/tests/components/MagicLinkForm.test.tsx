import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MagicLinkForm } from '@/components/auth/MagicLinkForm';

vi.mock('@/lib/api', () => ({
  api: {
    post: vi.fn(),
  },
}));

describe('MagicLinkForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders email input and submit button', () => {
    render(<MagicLinkForm />);
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send magic link/i })).toBeInTheDocument();
  });

  it('disables submit with invalid email', () => {
    render(<MagicLinkForm />);
    const button = screen.getByRole('button', { name: /send magic link/i });
    expect(button).toBeDisabled();
  });

  it('enables submit with valid email', () => {
    render(<MagicLinkForm />);
    const input = screen.getByLabelText('Email address');
    fireEvent.change(input, { target: { value: 'test@example.com' } });
    const button = screen.getByRole('button', { name: /send magic link/i });
    expect(button).not.toBeDisabled();
  });

  it('shows success state after submit', async () => {
    const { api } = await import('@/lib/api');
    vi.mocked(api.post).mockResolvedValueOnce({ message: 'sent' });

    render(<MagicLinkForm />);
    const input = screen.getByLabelText('Email address');
    fireEvent.change(input, { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send magic link/i }));

    await waitFor(() => {
      expect(screen.getByText('Check your inbox')).toBeInTheDocument();
    });
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('shows error state on failure', async () => {
    const { api } = await import('@/lib/api');
    vi.mocked(api.post).mockRejectedValueOnce(new Error('Network error'));

    render(<MagicLinkForm />);
    const input = screen.getByLabelText('Email address');
    fireEvent.change(input, { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send magic link/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Network error');
    });
  });
});
