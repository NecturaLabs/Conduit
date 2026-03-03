import { Check } from 'lucide-react';
import clsx from 'clsx';

export interface PricingCardProps {
  name: string;
  price: string;
  period?: string;
  features: readonly string[];
  cta: string;
  ctaHref: string;
  badge?: string;
  popular?: boolean;
  note?: string;
  external?: boolean;
}

export function PricingCard({
  name,
  price,
  period,
  features,
  cta,
  ctaHref,
  badge,
  popular,
  note,
  external,
}: PricingCardProps) {
  return (
    <div
      role="article"
      aria-label={`${name} plan — ${price}${period ? ' ' + period : ''}`}
      className={clsx(
        'relative flex h-full flex-col rounded-2xl border p-7 transition-all duration-300 hover:-translate-y-1',
        popular
          ? 'popular-ring border-accent bg-surface/80'
          : 'border-border bg-surface/50 hover:border-muted',
      )}
    >
      {/* Popular badge */}
      {popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-4 py-1 text-xs font-bold text-base">
          Most Popular
        </div>
      )}

      {/* Badge */}
      {badge && (
        <span className="mb-4 inline-block w-fit rounded-full border border-border bg-base/60 px-3 py-1 text-xs font-medium text-muted">
          {badge}
        </span>
      )}

      {/* Plan name */}
      <h3 className="text-lg font-bold">{name}</h3>

      {/* Price */}
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-4xl font-extrabold tracking-tight">{price}</span>
        {period && <span className="text-sm text-muted">{period}</span>}
      </div>

      {/* Note */}
      {note && <p className="mt-1.5 text-xs text-success font-medium">{note}</p>}

      {/* Divider */}
      <div className="my-6 h-px bg-border" />

      {/* Features */}
      <ul className="flex-1 space-y-3">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-3 text-sm text-muted">
            <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <a
        href={ctaHref}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        className={clsx(
          'mt-8 flex min-h-[44px] items-center justify-center rounded-xl px-6 py-3 text-center text-sm font-semibold transition-all',
          popular
            ? 'bg-accent text-base shadow-lg shadow-accent/20 hover:bg-accent-hover hover:shadow-accent-hover/25'
            : 'border border-border bg-base text-text hover:border-muted hover:bg-surface',
        )}
      >
        {cta}
      </a>
    </div>
  );
}
