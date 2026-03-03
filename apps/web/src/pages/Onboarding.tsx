import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import type { UserProfile, OnboardingPayload } from '@conduit/shared';

export function Onboarding() {
  const navigate      = useNavigate();
  const [searchParams] = useSearchParams();
  const setUser       = useAuthStore((s) => s.setUser);
  const setOnboarded  = useAuthStore((s) => s.setOnboarded);

  // Pre-fill display name from the OAuth callback redirect (?display_name=...).
  // The server URL-encodes the provider's name and limits it to 100 chars.
  // This is a UX convenience only — the user can freely edit or clear it.
  const prefillName = searchParams.get('display_name') ?? '';

  const [displayName, setDisplayName] = useState(prefillName);
  const [useCase, setUseCase] = useState<OnboardingPayload['useCase']>('personal');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) return;

    setIsSubmitting(true);
    setError('');

    try {
      const res = await api.post<{ user: UserProfile }>('/onboarding', {
        displayName: displayName.trim(),
        useCase,
      });
      setUser(res.user);
      setOnboarded(true);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--color-base)] p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-accent)]">
            <Sparkles className="h-7 w-7 text-[var(--color-base)]" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Let&apos;s get started</h1>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Tell us a bit about yourself to personalize your experience.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-lg"
        >
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label htmlFor="displayName" className="text-sm font-medium text-[var(--color-text)]">
                Display name
              </label>
              <Input
                id="displayName"
                placeholder="How should we call you?"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="useCase" className="text-sm font-medium text-[var(--color-text)]">
                How will you use Conduit?
              </label>
              <Select
                id="useCase"
                value={useCase}
                onChange={(e) => setUseCase(e.target.value as OnboardingPayload['useCase'])}
              >
                <option value="personal">Personal projects</option>
                <option value="team">Team collaboration</option>
                <option value="agency">Agency / client work</option>
              </Select>
            </div>

            {error && (
              <p className="text-sm text-[var(--color-danger)]" role="alert">
                {error}
              </p>
            )}

            <Button type="submit" disabled={!displayName.trim() || isSubmitting}>
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Spinner size="sm" />
                  Setting up...
                </span>
              ) : (
                'Get Started'
              )}
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}
