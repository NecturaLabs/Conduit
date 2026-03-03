import { useState, type FormEvent } from 'react';
import { Mail, ArrowRight, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { api } from '@/lib/api';
import type { MagicLinkResponse } from '@conduit/shared';

export function MagicLinkForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isValidEmail) return;

    setStatus('loading');
    setErrorMessage('');

    try {
      await api.postPublic<MagicLinkResponse>('/auth/magic-link', {
        email,
      });
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Failed to send magic link');
    }
  }

  if (status === 'success') {
    return (
      <div className="flex flex-col items-center gap-5 text-center" role="status">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-success)]/10">
          <CheckCircle className="h-8 w-8 text-[var(--color-success)]" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-semibold text-[var(--color-text)]">Check your inbox</h2>
        <p className="text-sm text-[var(--color-muted)] max-w-sm">
          We sent a magic link to sign in.
        </p>
        <div className="flex items-center gap-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 max-w-sm w-full">
          <Mail className="h-4 w-4 text-[var(--color-accent)] shrink-0" aria-hidden="true" />
          <span className="text-sm font-medium text-[var(--color-text)] truncate">{email}</span>
        </div>
        <p className="text-xs text-[var(--color-muted)] max-w-sm">
          Click the link in the email to sign in. It may take a minute to arrive.
        </p>
        <Button variant="ghost" onClick={() => { setStatus('idle'); setEmail(''); }}>
          Use a different email
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="text-sm font-medium text-[var(--color-text)]">
          Email address
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-muted)]" aria-hidden="true" />
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="pl-10"
            required
            autoFocus
            aria-invalid={status === 'error'}
          />
        </div>
      </div>

      {status === 'error' && (
        <p className="text-sm text-[var(--color-danger)]" role="alert">
          {errorMessage}
        </p>
      )}

      <Button type="submit" disabled={!isValidEmail || status === 'loading'}>
        {status === 'loading' ? (
          <span className="flex items-center gap-2">
            <Spinner size="sm" />
            Sending...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            Send Magic Link
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </Button>
    </form>
  );
}
