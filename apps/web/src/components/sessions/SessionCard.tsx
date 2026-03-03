import { useNavigate } from 'react-router-dom';
import { Clock, Check } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { useRelativeTime } from '@/hooks/useRelativeTime';
import type { Session } from '@conduit/shared';

interface SessionCardProps {
  session: Session;
  isActive?: boolean;
  index?: number;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
}

const statusVariant: Record<Session['status'], { variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'warning'; label: string }> = {
  active: { variant: 'default', label: 'Active' },
  idle: { variant: 'secondary', label: 'Idle' },
  completed: { variant: 'outline', label: 'Completed' },
  error: { variant: 'destructive', label: 'Error' },
  compacting: { variant: 'warning', label: 'Compacting' },
};

function LiveTimestamp({ dateStr }: { dateStr: string }) {
  const display = useRelativeTime(dateStr);
  return (
    <span className="flex items-center gap-1">
      <Clock className="h-3 w-3" aria-hidden="true" />
      {display}
    </span>
  );
}

export function SessionCard({ session, isActive, index, selectionMode, isSelected, onToggleSelect }: SessionCardProps) {
  const navigate = useNavigate();
  const { variant, label } = statusVariant[session.status];
  const isLive = session.status === 'active' || session.status === 'compacting';
  const isOdd = index !== undefined && index % 2 === 1;

  const handleClick = () => {
    if (selectionMode && onToggleSelect) {
      onToggleSelect(session.id);
    } else {
      navigate(`/sessions/${session.id}`);
    }
  };

  return (
    <button
      onClick={handleClick}
      aria-label={
        selectionMode
          ? `${isSelected ? 'Deselect' : 'Select'} session: ${session.title ?? `Session ${session.id.slice(0, 8)}`}`
          : `View session: ${session.title ?? `Session ${session.id.slice(0, 8)}`}`
      }
      className={cn(
        'group relative w-full text-left rounded-lg pr-3 py-3 min-h-[48px] transition-all cursor-pointer',
        selectionMode ? 'pl-3' : 'pl-4',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]',
        isSelected
          ? 'bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30'
          : isActive && !selectionMode
            ? 'bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30'
            : isLive
              ? cn(
                  'bg-[var(--color-surface)] border border-[var(--color-success)]/25',
                  'hover:border-[var(--color-success)]/40',
                )
              : cn(
                  'border border-transparent hover:bg-[var(--color-surface)] hover:border-[var(--color-border)]',
                  isOdd && 'bg-[var(--color-surface)]',
                ),
      )}
    >
      {/* Left accent bar: accent for selected, green for live-but-not-selected */}
      {!selectionMode && isActive && (
        <span
          className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-[var(--color-accent)]"
          aria-hidden="true"
        />
      )}
      {isLive && !isActive && !selectionMode && (
        <span
          className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-[var(--color-success)]/70"
          aria-hidden="true"
        />
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {/* Checkbox in selection mode */}
          {selectionMode && (
            <span
              className={cn(
                'mt-0.5 shrink-0 flex items-center justify-center h-4.5 w-4.5 rounded border transition-colors',
                isSelected
                  ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-[var(--color-base)]'
                  : 'border-[var(--color-border)] bg-transparent group-hover:border-[var(--color-muted)]',
              )}
              aria-hidden="true"
            >
              {isSelected && <Check className="h-3 w-3" />}
            </span>
          )}
          {/* Pulsing dot for live sessions (not in selection mode) */}
          {isLive && !selectionMode && (
            <span className="relative mt-1.5 shrink-0" aria-hidden="true">
              <span className="block h-2 w-2 rounded-full bg-[var(--color-success)]" />
              <span className="absolute inset-0 h-2 w-2 rounded-full bg-[var(--color-success)] animate-ping opacity-50" />
            </span>
          )}
          <div className="flex-1 min-w-0 overflow-hidden">
            <p className="text-sm font-medium truncate text-[var(--color-text)] max-w-full">
              {session.title ?? `Session ${session.id.slice(0, 8)}`}
            </p>
            <div className="mt-1 flex items-center gap-2 text-sm text-[var(--color-muted)]">
              <LiveTimestamp dateStr={session.updatedAt} />
            </div>
          </div>
        </div>
        <Badge variant={variant} className="shrink-0 text-xs px-1.5 py-0.5">{label}</Badge>
      </div>
    </button>
  );
}
