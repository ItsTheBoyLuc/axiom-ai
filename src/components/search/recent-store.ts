'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { parseRecent, pushRecentSearch } from '@/lib/search/recent';

/**
 * Recent searches in localStorage (anonymous, per browser; account history is Phase 9).
 * Snapshots are cached so React sees a stable reference until the list really changes, and a
 * blocked localStorage degrades to an in-memory list for the page view.
 */
const KEY = 'axiom-recent-searches';
const empty: string[] = [];
let cache: string[] = empty;
let loaded = false;
const listeners = new Set<() => void>();

function read(): string[] {
  try {
    return parseRecent(localStorage.getItem(KEY));
  } catch {
    return cache;
  }
}

function set(next: string[]) {
  cache = next.length ? next : empty;
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* storage unavailable: the list lasts for this page view only */
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
  getSnapshot(): string[] {
    if (!loaded) {
      loaded = true;
      const initial = read();
      cache = initial.length ? initial : empty;
    }
    return cache;
  },
  getServerSnapshot: (): string[] => empty,
};

export function useRecentSearches() {
  const list = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const record = useCallback((q: string) => {
    const next = pushRecentSearch(store.getSnapshot(), q);
    if (next !== store.getSnapshot()) set(next);
  }, []);
  const clear = useCallback(() => set([]), []);
  return { list, record, clear };
}
