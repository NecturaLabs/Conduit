import { useState, useRef, useEffect, useCallback, useId } from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InfoTipProps {
  text: string;
  className?: string;
}

/**
 * A small info icon that shows a tooltip below on hover (desktop) or tap (mobile).
 * Auto-aligns horizontally to stay within the viewport.
 */
export function InfoTip({ text, className }: InfoTipProps) {
  const tooltipId = useId();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [align, setAlign] = useState<'left' | 'center' | 'right'>('center');

  const updateAlign = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const tipWidth = 320;
    const half = tipWidth / 2;
    if (rect.left < half) {
      setAlign('left');
    } else if (window.innerWidth - rect.right < half) {
      setAlign('right');
    } else {
      setAlign('center');
    }
  }, []);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      updateAlign();
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open, handleClickOutside, updateAlign]);

  // Dismiss on Escape
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  return (
    <span className={cn('relative inline-flex items-center', className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => { updateAlign(); setOpen(true); }}
        onMouseLeave={() => setOpen(false)}
        className="text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors p-1.5 -m-1.5 flex items-center justify-center"
        aria-label="More info"
        aria-describedby={open ? tooltipId : undefined}
      >
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {open && (
        <div
          id={tooltipId}
          role="tooltip"
          className={cn(
            'pointer-events-none absolute top-full mt-2 z-50 w-max max-w-[min(320px,90vw)] rounded-md border border-[var(--color-accent)] bg-[var(--color-surface-alt)] px-2.5 py-1.5 text-xs leading-relaxed text-[var(--color-text)] shadow-lg',
            align === 'center' && 'left-1/2 -translate-x-1/2',
            align === 'left' && 'left-0',
            align === 'right' && 'right-0',
          )}
        >
          {text}
        </div>
      )}
    </span>
  );
}
