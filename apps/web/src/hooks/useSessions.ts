import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useRef, useCallback, useEffect } from 'react';
import { api } from '@/lib/api';
import type {
  SessionListResponse,
  SessionDetailResponse,
  PaginationParams,
} from '@conduit/shared';

const SESSION_MESSAGE_LIMIT = 50;
const SESSION_LIST_LIMIT = 50;

export function useSessionsQuery(params?: PaginationParams) {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.sort) query.set('sort', params.sort);
  if (params?.order) query.set('order', params.order);
  const qs = query.toString();

  return useQuery({
    queryKey: ['sessions', params],
    queryFn: () => api.get<SessionListResponse>(`/sessions${qs ? `?${qs}` : ''}`),
    refetchInterval: 15_000,
  });
}

/**
 * Hook that accumulates sessions across pages, exposing a `loadMore` callback.
 * Always polls page 1 for live updates (status, title, messageCount changes).
 * Additional pages are fetched on-demand via loadMore() and merged into the
 * accumulated list, with page-1 data kept authoritative for status updates.
 */
export function usePaginatedSessions() {
  const [accumulated, setAccumulated] = useState<SessionListResponse['sessions']>([]);
  const totalRef = useRef(0);
  const nextPageRef = useRef(2);
  const loadingMore = useRef(false);

  // Always query page 1 so the 15s refetch keeps statuses up to date
  const { data, isLoading, isFetching } = useSessionsQuery({ page: 1, limit: SESSION_LIST_LIMIT });

  // When page-1 data arrives, merge it into the accumulated list.
  // Page-1 sessions are authoritative — their status/title/messageCount
  // fields overwrite whatever is in the accumulated list.
  // NOTE: `accumulated` is intentionally omitted from deps — page-1 data is
  // always authoritative, so we re-merge only when a new fetch completes, not
  // on every accumulated state change (which would cause an infinite loop).
  const prevFirstIdRef = useRef<string | undefined>(undefined);
  const prevTotalRef = useRef<number>(0);
  useEffect(() => {
    if (!data) return;

    // If new sessions were inserted at the top (first session ID changed or
    // total increased), reset the page cursor so subsequent loadMore calls
    // don't skip a page of data due to shifted page boundaries.
    const firstId = data.sessions[0]?.id;
    if (firstId !== prevFirstIdRef.current || data.total > prevTotalRef.current) {
      nextPageRef.current = 2;
    }
    prevFirstIdRef.current = firstId;
    prevTotalRef.current = data.total;

    totalRef.current = data.total;
    const page1Ids = new Set(data.sessions.map(s => s.id));
    // Start with page-1 sessions, then append any accumulated sessions from
    // later pages that aren't duplicated in page 1.
    setAccumulated(prev => {
      const merged = [...data.sessions];
      for (const s of prev) {
        if (!page1Ids.has(s.id)) {
          // Session from a later page — keep stale copy (still valid,
          // just outside page 1's window).
          merged.push(s);
        }
      }
      const changed = merged.length !== prev.length
        || merged.some((s, i) =>
          s.id !== prev[i]?.id
          || s.status !== prev[i]?.status
          || s.messageCount !== prev[i]?.messageCount
          || s.title !== prev[i]?.title
          || s.updatedAt !== prev[i]?.updatedAt,
        );
      // Return previous reference unchanged if nothing actually changed,
      // so downstream components don't re-render unnecessarily.
      return changed ? merged : prev;
    });
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const sessions = accumulated.length > 0 ? accumulated : (data?.sessions ?? []);
  const hasMore = sessions.length < totalRef.current;

  const loadMore = useCallback(() => {
    if (loadingMore.current || !hasMore) return;
    loadingMore.current = true;
    const nextPage = nextPageRef.current;
    api.get<SessionListResponse>(`/sessions?page=${nextPage}&limit=${SESSION_LIST_LIMIT}`)
      .then(result => {
        if (result.sessions.length > 0) {
          nextPageRef.current = nextPage + 1;
          setAccumulated(prev => {
            const existingIds = new Set(prev.map(s => s.id));
            const newSessions = result.sessions.filter(s => !existingIds.has(s.id));
            return [...prev, ...newSessions];
          });
        }
        totalRef.current = result.total;
      })
      .finally(() => {
        loadingMore.current = false;
      });
  }, [hasMore]);

  return {
    sessions,
    total: totalRef.current || (data?.total ?? 0),
    isLoading,
    isFetching,
    hasMore,
    loadMore,
  };
}

export function useArchivedSessionsQuery(expanded = false) {
  const [accumulated, setAccumulated] = useState<SessionListResponse['sessions']>([]);
  const totalRef = useRef(0);
  const nextPageRef = useRef(2);
  const loadingMore = useRef(false);

  const query = useQuery({
    queryKey: ['sessions', 'archived', 1],
    queryFn: () => api.get<SessionListResponse>(`/sessions?archived=true&page=1&limit=${SESSION_LIST_LIMIT}`),
    // Always fetch once (for count in collapsed header), but only auto-refresh when expanded
    refetchInterval: expanded ? 30_000 : false,
  });

  // Same pattern as usePaginatedSessions: merge inside useEffect to avoid
  // render-phase side effects. `accumulated` omitted from deps intentionally.
  useEffect(() => {
    if (!query.data) return;
    totalRef.current = query.data.total;
    const page1Ids = new Set(query.data.sessions.map(s => s.id));
    setAccumulated(prev => {
      const merged = [...query.data!.sessions];
      for (const s of prev) {
        if (!page1Ids.has(s.id)) merged.push(s);
      }
      const changed = merged.length !== prev.length
        || merged.some((s, i) =>
          s.id !== prev[i]?.id
          || s.status !== prev[i]?.status
          || s.messageCount !== prev[i]?.messageCount
          || s.title !== prev[i]?.title,
        );
      return changed ? merged : prev;
    });
  }, [query.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const sessions = accumulated.length > 0 ? accumulated : (query.data?.sessions ?? []);
  const total = totalRef.current || (query.data?.total ?? 0);
  const hasMore = sessions.length < total;

  const loadMore = useCallback(() => {
    if (loadingMore.current || !hasMore) return;
    loadingMore.current = true;
    const nextPage = nextPageRef.current;
    api.get<SessionListResponse>(`/sessions?archived=true&page=${nextPage}&limit=${SESSION_LIST_LIMIT}`)
      .then(result => {
        if (result.sessions.length > 0) {
          nextPageRef.current = nextPage + 1;
          setAccumulated(prev => {
            const existingIds = new Set(prev.map(s => s.id));
            const newSessions = result.sessions.filter(s => !existingIds.has(s.id));
            return [...prev, ...newSessions];
          });
        }
        totalRef.current = result.total;
      })
      .finally(() => {
        loadingMore.current = false;
      });
  }, [hasMore]);

  return {
    data: { sessions, total },
    isLoading: query.isLoading,
    hasMore,
    loadMore,
  };
}

export function useSessionQuery(id: string | undefined) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['sessions', id],
    queryFn: async () => {
      const data = await api.get<SessionDetailResponse>(`/sessions/${id}?limit=${SESSION_MESSAGE_LIMIT}`);

      // Sync the detail-derived status back into every session-list cache entry
      // so the sidebar badge stays consistent with the detail header.
      queryClient.setQueriesData<SessionListResponse>(
        { queryKey: ['sessions'], type: 'active' },
        (old) => {
          if (!old?.sessions) return old;
          const idx = old.sessions.findIndex((s) => s.id === data.session.id);
          if (idx === -1 || old.sessions[idx]?.status === data.session.status) return old;
          const sessions = [...old.sessions];
          sessions[idx] = { ...sessions[idx]!, status: data.session.status } as typeof sessions[number];
          return { ...old, sessions };
        },
      );

      return data;
    },
    enabled: !!id,
    refetchInterval: (query) => {
      const session = query.state.data?.session;
      if (!session) return 5_000;
      // Active/compacting sessions poll frequently; idle/completed sessions poll less
      const status = session.status;
      if (status === 'active' || status === 'compacting') return 5_000;
      return 30_000;
    },
  });
}

/**
 * Hook for loading older messages via cursor-based pagination.
 * Returns a load function and state for the older-message pages.
 */
export function useOlderMessages(sessionId: string | undefined) {
  const [olderMessages, setOlderMessages] = useState<SessionDetailResponse['messages']>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const oldestCursorRef = useRef<string | null>(null);
  const prevSessionIdRef = useRef<string | undefined>(undefined);

  // Reset when session changes
  if (sessionId !== prevSessionIdRef.current) {
    prevSessionIdRef.current = sessionId;
    setOlderMessages([]);
    setHasMore(true);
    setIsLoadingOlder(false);
    oldestCursorRef.current = null;
  }

  const loadOlder = useCallback(async (beforeId: string) => {
    if (!sessionId || isLoadingOlder || !hasMore) return;
    // Use the oldest cursor we've loaded so far, or the provided ID
    const cursor = oldestCursorRef.current ?? beforeId;
    setIsLoadingOlder(true);
    try {
      const data = await api.get<SessionDetailResponse>(
        `/sessions/${sessionId}?limit=${SESSION_MESSAGE_LIMIT}&before=${cursor}`,
      );
      if (data.messages.length > 0) {
        setOlderMessages(prev => [...data.messages, ...prev]);
        oldestCursorRef.current = data.oldestMessageId ?? null;
      }
      setHasMore(data.hasMore ?? false);
    } finally {
      setIsLoadingOlder(false);
    }
  }, [sessionId, isLoadingOlder, hasMore]);

  return { olderMessages, hasMore, isLoadingOlder, loadOlder, setHasMore };
}

export function useDeleteSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/sessions/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
}

export type PromptStatus = 'pending' | 'processing' | 'delivered' | 'failed';

export interface PromptStatusEntry {
  id: string;
  status: PromptStatus;
  created_at: string;
}

export function usePromptStatusQuery(sessionId: string | undefined, promptId: string | undefined) {
  return useQuery({
    queryKey: ['prompt-status', sessionId, promptId],
    queryFn: async () => {
      const data = await api.get<{ prompts: PromptStatusEntry[] }>(`/sessions/${sessionId}/prompt-status`);
      return data.prompts.find((p) => p.id === promptId) ?? null;
    },
    enabled: !!sessionId && !!promptId,
    refetchInterval: (query) => {
      const entry = query.state.data;
      // null = row not found (delivered & deleted) or not yet fetched
      // Keep polling while pending or processing; stop once delivered or failed
      if (entry === null) return false;
      if (entry && entry.status !== 'pending' && entry.status !== 'processing') return false;
      return 2_000;
    },
  });
}

export function useBatchDeleteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => api.post('/sessions/batch/delete', { ids }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
}

export function useBatchArchiveMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => api.post('/sessions/batch/archive', { ids }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
}

export function useBatchUnarchiveMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => api.post('/sessions/batch/unarchive', { ids }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
}

export function useArchiveSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/sessions/${id}/archive`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
}

export function useUnarchiveSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/sessions/${id}/archive`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
}
export function useSendPromptMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, content, isCommand }: { sessionId: string; content: string; isCommand?: boolean }) =>
      api.post<{ promptId: string; status: string }>(`/sessions/${sessionId}/prompt`, { content, isCommand }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['sessions', variables.sessionId] });
    },
  });
}
