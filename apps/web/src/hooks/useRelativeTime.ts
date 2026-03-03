import { useSyncExternalStore } from 'react';
import { relativeTime, normalizeDate } from '@/lib/utils';

/**
 * A single shared ticker that drives all useRelativeTime consumers.
 *
 * Instead of N independent setTimeout timers (one per SessionCard / MessageBubble),
 * this module runs ONE interval that increments a generation counter. Every consumer
 * subscribes via useSyncExternalStore and recomputes its relative-time string only
 * when the ticker fires — so 50 cards share 1 timer instead of 50.
 *
 * The tick interval adapts: 5s when any subscriber has a "recent" date (< 1min old),
 * 30s otherwise. The interval is lazily started on the first subscriber and cleared
 * when the last one unsubscribes.
 */

let generation = 0;
let interval: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();
const subscriberAges = new Map<() => void, () => number>();

function getTickInterval(): number {
  let minAge = Infinity;
  for (const getAge of subscriberAges.values()) {
    const age = getAge();
    if (age < minAge) minAge = age;
  }
  if (minAge < 60_000) return 5_000;       // < 1min: tick every 5s
  if (minAge < 3_600_000) return 30_000;    // < 1h: tick every 30s
  return 60_000;                            // > 1h: tick every 60s
}

function startTicker() {
  if (interval) return;
  const tick = () => {
    generation++;
    for (const cb of listeners) cb();
    // Reschedule with adaptive interval
    if (listeners.size > 0) {
      interval = setTimeout(tick, getTickInterval());
    }
  };
  interval = setTimeout(tick, getTickInterval());
}

function stopTicker() {
  if (interval) {
    clearTimeout(interval);
    interval = null;
  }
}

function subscribe(callback: () => void, getAge: () => number): () => void {
  listeners.add(callback);
  subscriberAges.set(callback, getAge);
  if (listeners.size === 1) startTicker();
  return () => {
    listeners.delete(callback);
    subscriberAges.delete(callback);
    if (listeners.size === 0) stopTicker();
  };
}

function getSnapshot(): number {
  return generation;
}

/**
 * Returns a live-updating relative time string. All consumers share a single
 * ticker — no per-component timers.
 */
export function useRelativeTime(dateStr: string | null | undefined): string {
  const getAge = () => {
    if (!dateStr) return Infinity;
    return Date.now() - new Date(normalizeDate(dateStr)).getTime();
  };

  // Subscribe to the shared ticker; re-renders when generation increments
  useSyncExternalStore(
    (cb) => subscribe(cb, getAge),
    getSnapshot,
    getSnapshot,
  );

  return relativeTime(dateStr);
}
