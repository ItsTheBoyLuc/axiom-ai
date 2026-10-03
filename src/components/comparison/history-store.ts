'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { historyKey, parseHistory, pushHistory, type HistoryEntry } from '@/lib/compare/history';

/**
 * Comparison history in localStorage (anonymous, per browser; account history is Phase 9).
 * Snapshots are cached so React sees a stable reference until the list really changes, and a
 * blocked localStorage degrades to an in-memory list for the page view.
 */
const KEY = 'axiom-compare-history';
const empty: HistoryEntry[] = [];
let cache: HistoryEntry[] = empty;
let loaded = false;
const listeners = new Set<() => void>();

function read(): HistoryEntry[] {
  try {
    return parseHistory(localStorage.getItem(KEY));
  } catch {
    return cache;
  }
}

function set(next: HistoryEntry[]) {
  cache = next.length ? next : empty;
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* storage unavailable: history lasts for this page view only */
  }
  listeners.forEach((l) => l());
}

const store = {
  subscribe(cb: () => void) {
    listeners.add(cb);
    const onStorage = (e: StorageEvent) => {
      if (e.key !== KEY) return;
      cache = read();
      listeners.forEach((l) => l());
    };
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(cb);
      window.removeEventListener('storage', onStorage);
    };
  },
  getSnapshot(): HistoryEntry[] {
    if (!loaded) {
      loaded = true;
      const initial = read();
      cache = initial.length ? initial : empty;
    }
    return cache;
  },
  getServerSnapshot: (): HistoryEntry[] => empty,
};

export function useCompareHistory() {
  const list = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  /** Records a compared set. A set already at the front is left alone to avoid write churn. */
  const record = useCallback((entry: HistoryEntry) => {
    const current = store.getSnapshot();
    if (current[0] && historyKey(current[0].slugs) === historyKey(entry.slugs)) return;
    const next = pushHistory(current, entry);
    if (next !== current) set(next);
  }, []);
  const clear = useCallback(() => set([]), []);
  return { list, record, clear };
}
