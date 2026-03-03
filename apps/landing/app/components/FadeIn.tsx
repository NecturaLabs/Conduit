import type { ReactNode } from 'react';

export function FadeInSection({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`fade-in-section ${className}`}>
      {children}
    </div>
  );
}
