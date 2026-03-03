import type { Metadata } from 'next';
import { PricingCard } from '../components/PricingCard';
import { FadeInSection } from '../components/FadeIn';

export const metadata: Metadata = {
  title: 'Pricing — Conduit',
  description:
    'Simple, transparent pricing. Self-host for free forever, or use Conduit Cloud starting at $5/month.',
};

const PLANS = [
  {
    name: 'Self-Hosted',
    price: 'Free',
    period: 'forever',
    badge: 'Open Source',
    features: [
      'Unlimited everything',
      'Full source code access',
      'Docker Compose setup',
      'Community support',
      'All themes included',
    ],
    cta: 'View on GitHub',
    ctaHref: '#',
    external: true,
  },
  {
    name: 'Solo',
    price: '$5',
    period: '/month',
    badge: '7-day free trial',
    note: 'No credit card required',
    popular: true,
    features: [
      '1 user',
      'Unlimited instances',
      'All features',
      'All themes',
      'Email support',
    ],
    cta: 'Start Free Trial',
    ctaHref: '/app/auth',
  },
  {
    name: 'Team',
    price: '$15',
    period: '/month',
    badge: '7-day free trial',
    note: 'No credit card required',
    features: [
      '5 users included',
      '+$3 per additional user',
      'All Solo features',
      'Shared sessions',
      'Priority support',
    ],
    cta: 'Start Free Trial',
    ctaHref: '/app/auth',
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    features: [
      'Unlimited users',
      'SSO / SAML',
      'SLA guarantee',
      'Dedicated support',
      'Custom integrations',
    ],
    cta: 'Contact Us',
    ctaHref: '#',
    external: true,
  },
] as const;

const FAQ = [
  {
    q: 'What happens after the trial?',
    a: 'Your account enters read-only mode. All your data is preserved — you can upgrade anytime to regain full access. Nothing gets deleted.',
  },
  {
    q: 'Can I switch from cloud to self-hosted?',
    a: 'Yes! You can export your data anytime and migrate to a self-hosted instance. No lock-in, ever.',
  },
  {
    q: 'Is the self-hosted version limited?',
    a: "No. It's the full product with every feature. Self-hosted is always free under the MIT license.",
  },
  {
    q: 'What payment methods do you accept?',
    a: 'We currently accept PayPal. More payment methods are coming soon.',
  },
] as const;

export default function PricingPage() {
  return (
    <div className="pt-28 pb-20">
      {/* Header */}
      <section className="mx-auto max-w-4xl px-6 text-center">
        <FadeInSection>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Simple, transparent&nbsp;
            <span className="gradient-text">pricing</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted sm:text-lg">
            Self-host for free, forever. Use our cloud if you don&apos;t want to manage infrastructure.
          </p>
        </FadeInSection>
      </section>

      {/* Pricing cards */}
      <section aria-label="Pricing plans" className="mx-auto mt-16 max-w-7xl px-6">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => (
            <FadeInSection key={plan.name}>
              <PricingCard {...plan} />
            </FadeInSection>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq-heading" className="mx-auto mt-28 max-w-3xl px-6">
        <FadeInSection>
          <h2 id="faq-heading" className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
            Frequently asked questions
          </h2>
        </FadeInSection>

        <div className="mt-12 space-y-4">
          {FAQ.map((item) => (
            <FadeInSection key={item.q}>
              <details className="group rounded-2xl border border-border bg-surface/50">
                <summary className="flex cursor-pointer items-center justify-between p-6 text-sm font-semibold [&::-webkit-details-marker]:hidden list-none">
                  {item.q}
                  <span aria-hidden="true" className="ml-4 shrink-0 text-muted transition-transform group-open:rotate-45">+</span>
                </summary>
                <div className="px-6 pb-6 -mt-2">
                  <p className="text-sm leading-relaxed text-muted">{item.a}</p>
                </div>
              </details>
            </FadeInSection>
          ))}
        </div>
      </section>
    </div>
  );
}
