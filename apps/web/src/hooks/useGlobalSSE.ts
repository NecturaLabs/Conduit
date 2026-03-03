import { useRef, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSSE } from '@/hooks/useSSE';
import type { SSEEventType } from '@conduit/shared';
import type { SessionListResponse, SessionDetailResponse } from '@conduit/shared';

/** Minimum interval (ms) between invalidations for high-frequency events. */
const THROTTLE_MS = 2_000;

/**
 * Minimum time (ms) to display "compacting" status before allowing it to be
 * overwritten by a refetch. Compaction is very fast (~1-3s) so without this,
 * the client refetch races against session.compacted and the user never sees it.
 */
const COMPACTING_MIN_DISPLAY_MS = 4_000;

/**
 * Global SSE subscription that invalidates React Query caches across all pages.
 * Mount once in App (inside QueryClientProvider + auth boundary).
 *
 * High-frequency events (message.part.updated, tool.*) are throttled to avoid
 * re-fetching expensive endpoints many times per second during active streaming.
 * Low-frequency events (session.created, session.deleted) invalidate immediately.
 */
export function useGlobalSSE() {
  const queryClient = useQueryClient();

  const sessionsTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const metricsTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const sessionsDirty = useRef(false);
  const metricsDirty = useRef(false);

  /**
   * Track sessions currently displayed as "compacting" with their expiry time.
   * While a session is in this map, refetches are suppressed (deferred) so the
   * compacting badge stays visible for at least COMPACTING_MIN_DISPLAY_MS.
   */
  const compactingUntil = useRef<Map<string, number>>(new Map());
  const deferredFlush = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Flush pending invalidations immediately
  const flushSessions = useCallback(() => {
    if (sessionsTimer.current) {
      clearTimeout(sessionsTimer.current);
      sessionsTimer.current = undefined;
    }
    sessionsDirty.current = false;

    // If any sessions are still in the compacting display window, defer the
    // invalidation until the earliest window expires.
    const now = Date.now();
    let earliestExpiry = 0;
    for (const [, expiry] of compactingUntil.current) {
      if (expiry > now) {
        earliestExpiry = earliestExpiry === 0 ? expiry : Math.min(earliestExpiry, expiry);
      }
    }
    if (earliestExpiry > now) {
      // Defer the flush — schedule it for when the compacting window expires
      if (deferredFlush.current) clearTimeout(deferredFlush.current);
      deferredFlush.current = setTimeout(() => {
        // Clean up expired entries
        const t = Date.now();
        for (const [id, exp] of compactingUntil.current) {
          if (exp <= t) compactingUntil.current.delete(id);
        }
        void queryClient.invalidateQueries({ queryKey: ['sessions'] });
      }, earliestExpiry - now);
      return;
    }

    void queryClient.invalidateQueries({ queryKey: ['sessions'] });
  }, [queryClient]);

  const flushMetrics = useCallback(() => {
    if (metricsTimer.current) {
      clearTimeout(metricsTimer.current);
      metricsTimer.current = undefined;
    }
    metricsDirty.current = false;
    void queryClient.invalidateQueries({ queryKey: ['metrics'] });
  }, [queryClient]);

  // Schedule a throttled invalidation (coalesces rapid events)
  const throttleSessions = useCallback(() => {
    sessionsDirty.current = true;
    if (!sessionsTimer.current) {
      sessionsTimer.current = setTimeout(flushSessions, THROTTLE_MS);
    }
  }, [flushSessions]);

  const throttleMetrics = useCallback(() => {
    metricsDirty.current = true;
    if (!metricsTimer.current) {
      metricsTimer.current = setTimeout(flushMetrics, THROTTLE_MS);
    }
  }, [flushMetrics]);

  // Cleanup timers on unmount
  useEffect(() => () => {
    if (sessionsTimer.current) clearTimeout(sessionsTimer.current);
    if (metricsTimer.current) clearTimeout(metricsTimer.current);
    if (deferredFlush.current) clearTimeout(deferredFlush.current);
  }, []);

  /**
   * Optimistically set a session's status to "compacting" in all cached query
   * data so the UI reflects it immediately — without waiting for a server
   * round-trip that would race against the subsequent session.compacted event.
   */
  const setCompactingInCache = useCallback((sessionId: string) => {
    // Mark this session as "compacting" in the display-hold map
    compactingUntil.current.set(sessionId, Date.now() + COMPACTING_MIN_DISPLAY_MS);

    // Patch session list caches
    queryClient.setQueriesData<SessionListResponse>(
      { queryKey: ['sessions'], type: 'active' },
      (old) => {
        if (!old?.sessions) return old;
        const idx = old.sessions.findIndex((s) => s.id === sessionId);
        if (idx === -1 || old.sessions[idx]?.status === 'compacting') return old;
        const sessions = [...old.sessions];
        sessions[idx] = { ...sessions[idx]!, status: 'compacting' } as typeof sessions[number];
        return { ...old, sessions };
      },
    );

    // Patch session detail cache if it's loaded
    queryClient.setQueriesData<SessionDetailResponse>(
      { queryKey: ['sessions', sessionId], type: 'active' },
      (old) => {
        if (!old?.session || old.session.status === 'compacting') return old;
        return { ...old, session: { ...old.session, status: 'compacting' } };
      },
    );
  }, [queryClient]);

  const { isConnected, isConfigured, lastEvent, error, reconnect, pause } = useSSE((type: SSEEventType, data: unknown) => {
    // Instance status changed — invalidate immediately so the UI reflects
    // connected/disconnected without waiting for the 10s polling interval.
    if (type === 'instance.updated') {
      void queryClient.invalidateQueries({ queryKey: ['instances'] });
      return;
    }

    // ── Compacting: optimistically write status into cache ──
    if (type === 'session.compacting') {
      const eventData = data as Record<string, unknown> | null;
      const sessionId = typeof eventData?.sessionId === 'string' ? eventData.sessionId : null;
      if (sessionId) {
        setCompactingInCache(sessionId);
      }
      // Still flush metrics, but DON'T invalidate sessions (we just wrote the
      // optimistic update and want it to stick for COMPACTING_MIN_DISPLAY_MS)
      flushMetrics();
      return;
    }

    // ── Compacted: let the hold timer expire, then refetch ──
    if (type === 'session.compacted') {
      // Don't immediately refetch — flushSessions checks the hold map and
      // defers if the compacting display window is still active
      flushSessions();
      flushMetrics();
      return;
    }

    // ── Immediate invalidation — low-frequency structural events ──
    if (
      type === 'session.created' ||
      type === 'session.deleted' ||
      type === 'session.idle' ||
      type === 'session.error'
    ) {
      flushSessions();
      flushMetrics();
      return;
    }

    // ── Throttled invalidation — high-frequency streaming events ──
    if (
      type === 'session.updated' ||
      type === 'message.updated' ||
      type === 'message.created' ||
      type === 'message.completed' ||
      type === 'message.part.updated' ||
      type === 'tool.started' ||
      type === 'tool.completed' ||
      type === 'tool.execute.after' ||
      type === 'todo.updated' ||
      type === 'mcp.tools.changed'
    ) {
      throttleSessions();
      throttleMetrics();
      return;
    }

    // Config events → invalidate config queries (already low-frequency)
    if (type === 'config.updated' || type === 'config.sync') {
      void queryClient.invalidateQueries({ queryKey: ['config'] });
    }
  });

  return { isConnected, isConfigured, lastEvent, error, reconnect, pause };
}
