import { useState, useRef, useCallback } from 'react';
import { Search, Inbox, Archive, ChevronDown, ChevronUp, Loader2, CheckSquare, X, Trash2, ArchiveRestore, Square, CheckCheck } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { SessionCard } from './SessionCard';
import { usePaginatedSessions, useArchivedSessionsQuery, useBatchDeleteMutation, useBatchArchiveMutation, useBatchUnarchiveMutation } from '@/hooks/useSessions';
import { cn } from '@/lib/utils';

type ConfirmAction = {
  type: 'delete' | 'archive' | 'unarchive';
  ids: string[];
};

function ConfirmDialog({ action, onConfirm, onCancel, isPending }: {
  action: ConfirmAction;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const labels: Record<ConfirmAction['type'], { title: string; description: string; button: string }> = {
    delete: {
      title: 'Delete sessions',
      description: `Permanently delete ${action.ids.length} session${action.ids.length > 1 ? 's' : ''}? This cannot be undone.`,
      button: 'Delete',
    },
    archive: {
      title: 'Archive sessions',
      description: `Archive ${action.ids.length} session${action.ids.length > 1 ? 's' : ''}?`,
      button: 'Archive',
    },
    unarchive: {
      title: 'Unarchive sessions',
      description: `Restore ${action.ids.length} session${action.ids.length > 1 ? 's' : ''} from archive?`,
      button: 'Unarchive',
    },
  };

  const { title, description, button } = labels[action.type];
  const isDestructive = action.type === 'delete';

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--color-base)]/80 backdrop-blur-sm rounded-lg" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-4 mx-4 max-w-xs w-full shadow-lg">
        <h3 id="confirm-dialog-title" className="text-sm font-semibold text-[var(--color-text)] mb-1">{title}</h3>
        <p className="text-xs text-[var(--color-muted)] mb-4">{description}</p>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant={isDestructive ? 'destructive' : 'default'}
            size="sm"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : button}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function SessionList() {
  const { id: activeId } = useParams<{ id: string }>();
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const { sessions, total, isLoading, isFetching, hasMore, loadMore } = usePaginatedSessions();
  const { data: archivedData, isLoading: archivedLoading, hasMore: archivedHasMore, loadMore: loadMoreArchived } = useArchivedSessionsQuery(showArchived);

  const batchDelete = useBatchDeleteMutation();
  const batchArchive = useBatchArchiveMutation();
  const batchUnarchive = useBatchUnarchiveMutation();

  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !hasMore || isFetching) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    if (nearBottom) loadMore();
  }, [hasMore, isFetching, loadMore]);

  const filteredSessions = sessions.filter((s) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      s.title?.toLowerCase().includes(term) ||
      s.id.toLowerCase().includes(term)
    );
  });

  const archivedSessions = archivedData?.sessions ?? [];
  const filteredArchived = archivedSessions.filter((s) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      s.title?.toLowerCase().includes(term) ||
      s.id.toLowerCase().includes(term)
    );
  });

  const archivedCount = archivedData?.total ?? 0;

  // Selection helpers
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
    setConfirmAction(null);
  }, []);

  const enterSelectionMode = useCallback(() => {
    setSelectionMode(true);
    setSelectedIds(new Set());
  }, []);

  // Determine which visible list(s) the selected IDs fall into
  const activeSelectedIds = [...selectedIds].filter(id => filteredSessions.some(s => s.id === id));
  const archivedSelectedIds = [...selectedIds].filter(id => filteredArchived.some(s => s.id === id));
  const selectedCount = selectedIds.size;

  const selectAllActive = useCallback(() => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      for (const s of filteredSessions) next.add(s.id);
      return next;
    });
  }, [filteredSessions]);

  const selectAllArchived = useCallback(() => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      for (const s of filteredArchived) next.add(s.id);
      return next;
    });
  }, [filteredArchived]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleBulkAction = useCallback((type: ConfirmAction['type']) => {
    const ids = type === 'unarchive' ? archivedSelectedIds : activeSelectedIds;
    if (ids.length === 0) return;
    setConfirmAction({ type, ids });
  }, [activeSelectedIds, archivedSelectedIds]);

  const executeBulkAction = useCallback(async () => {
    if (!confirmAction) return;
    const { type, ids } = confirmAction;
    try {
      if (type === 'delete') await batchDelete.mutateAsync(ids);
      else if (type === 'archive') await batchArchive.mutateAsync(ids);
      else if (type === 'unarchive') await batchUnarchive.mutateAsync(ids);
      // Remove completed IDs from selection
      setSelectedIds(prev => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
      setConfirmAction(null);
      // If no more selected, exit selection mode
      const remaining = selectedIds.size - ids.length;
      if (remaining <= 0) exitSelectionMode();
    } catch {
      // Mutation errors are handled by react-query; keep dialog open
    }
  }, [confirmAction, batchDelete, batchArchive, batchUnarchive, selectedIds.size, exitSelectionMode]);

  const isMutating = batchDelete.isPending || batchArchive.isPending || batchUnarchive.isPending;

  return (
    <div className="relative flex flex-col h-full">
      {/* Confirm dialog overlay */}
      {confirmAction && (
        <ConfirmDialog
          action={confirmAction}
          onConfirm={() => void executeBulkAction()}
          onCancel={() => setConfirmAction(null)}
          isPending={isMutating}
        />
      )}

      {/* Header + Search */}
      <div className="px-4 pt-3 pb-2 border-b border-[var(--color-border)] shrink-0 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h1 className="text-base font-semibold text-[var(--color-text)]">Sessions</h1>
          <div className="flex items-center gap-1.5">
            {total > 0 && !selectionMode && (
              <span className="text-xs text-[var(--color-muted)] tabular-nums">{total}</span>
            )}
            {total > 0 && (
              <button
                onClick={selectionMode ? exitSelectionMode : enterSelectionMode}
                className={cn(
                  'p-1 rounded-md transition-colors',
                  selectionMode
                    ? 'text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]',
                )}
                aria-label={selectionMode ? 'Exit selection mode' : 'Enter selection mode'}
                title={selectionMode ? 'Cancel selection' : 'Select sessions'}
              >
                {selectionMode ? <X className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}
              </button>
            )}
          </div>
        </div>
        <div className="relative">
          <Search aria-hidden="true" className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-muted)]" />
          <Input
            placeholder="Search sessions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
            aria-label="Search sessions"
          />
        </div>
      </div>

      {/* Bulk action toolbar */}
      {selectionMode && (
        <div className="px-3 py-2 border-b border-[var(--color-border)] shrink-0 flex items-center gap-1.5 bg-[var(--color-surface)]/50">
          <button
            onClick={selectedCount > 0 ? deselectAll : selectAllActive}
            className="flex items-center gap-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors px-1.5 py-1 rounded-md hover:bg-[var(--color-surface)]"
            title={selectedCount > 0 ? 'Deselect all' : 'Select all'}
          >
            {selectedCount > 0 ? <Square className="h-3.5 w-3.5" /> : <CheckCheck className="h-3.5 w-3.5" />}
            <span>{selectedCount > 0 ? `${selectedCount} selected` : 'Select all'}</span>
          </button>
          <div className="flex-1" />
          {activeSelectedIds.length > 0 && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-10 px-2 text-xs gap-1"
                onClick={() => handleBulkAction('archive')}
                disabled={isMutating}
              >
                <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                Archive
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-10 px-2 text-xs gap-1 text-[var(--color-danger)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                onClick={() => handleBulkAction('delete')}
                disabled={isMutating}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Delete
              </Button>
            </>
          )}
          {archivedSelectedIds.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-10 px-2 text-xs gap-1"
              onClick={() => handleBulkAction('unarchive')}
              disabled={isMutating}
            >
              <ArchiveRestore className="h-3.5 w-3.5" aria-hidden="true" />
              Unarchive
            </Button>
          )}
        </div>
      )}

      {/* List */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex flex-col gap-2 p-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : !filteredSessions?.length ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <Inbox aria-hidden="true" className="h-8 w-8 text-[var(--color-muted)] mb-2" />
            <p className="text-sm text-[var(--color-muted)]">
              {search ? 'No sessions match your search.' : 'Sessions will appear here when agents connect.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {filteredSessions.map((session, index) => (
              <SessionCard
                key={session.id}
                session={session}
                isActive={session.id === activeId}
                index={index}
                selectionMode={selectionMode}
                isSelected={selectedIds.has(session.id)}
                onToggleSelect={toggleSelect}
              />
            ))}
            {/* Load more indicator */}
            {hasMore && !search && (
              <div className="flex justify-center py-2">
                {isFetching ? (
                  <Loader2 aria-hidden="true" className="h-4 w-4 text-[var(--color-muted)] animate-spin" />
                ) : (
                  <button
                    onClick={loadMore}
                    className="text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors px-3 py-1.5 rounded-md hover:bg-[var(--color-surface)]/50"
                  >
                    Load more sessions
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Archived section */}
        {archivedCount > 0 && (
          <div className="mt-3">
            <button
              className="flex items-center gap-2 w-full px-2 py-1.5 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors rounded-md hover:bg-[var(--color-surface)]/50"
              onClick={() => setShowArchived((v) => !v)}
              aria-expanded={showArchived}
            >
              <Archive aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 text-left">Archived</span>
              <span className="tabular-nums">{archivedCount}</span>
              {showArchived
                ? <ChevronUp aria-hidden="true" className="h-3 w-3 shrink-0" />
                : <ChevronDown aria-hidden="true" className="h-3 w-3 shrink-0" />}
            </button>

            {showArchived && (
              <div className="flex flex-col gap-1 mt-1">
                {selectionMode && filteredArchived.length > 0 && (
                  <button
                    onClick={selectAllArchived}
                    className="flex items-center gap-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors px-2 py-1 rounded-md hover:bg-[var(--color-surface)]/50"
                  >
                    <CheckCheck className="h-3 w-3" />
                    Select all archived
                  </button>
                )}
                {archivedLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                  ))
                ) : filteredArchived?.length ? (
                  <>
                    {filteredArchived.map((session, index) => (
                      <SessionCard
                        key={session.id}
                        session={session}
                        isActive={session.id === activeId}
                        index={index}
                        selectionMode={selectionMode}
                        isSelected={selectedIds.has(session.id)}
                        onToggleSelect={toggleSelect}
                      />
                    ))}
                    {archivedHasMore && !search && (
                      <div className="flex justify-center py-2">
                        <button
                          onClick={loadMoreArchived}
                          className="text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors px-3 py-1.5 rounded-md hover:bg-[var(--color-surface)]/50"
                        >
                          Load more archived
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-[var(--color-muted)] text-center py-3 px-2">
                    {search ? 'No archived sessions match your search.' : 'No archived sessions.'}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
