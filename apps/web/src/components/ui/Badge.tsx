import { type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'warning';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  default:
    'bg-[var(--color-accent)] text-[var(--color-base)] border-transparent',
  secondary:
    'bg-[var(--color-surface)] text-[var(--color-text)] border-[var(--color-border)]',
  destructive:
    'bg-[var(--color-danger)] text-white border-transparent',
  outline:
    'bg-transparent text-[var(--color-text)] border-[var(--color-border)]',
  warning:
    'bg-[var(--color-warning)]/80 text-[var(--color-base)] border-transparent',
};

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-sm font-semibold transition-colors',
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
