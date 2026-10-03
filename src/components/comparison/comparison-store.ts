'use client';

import { useCallback, useSyncExternalStore } from 'react';
import {
  MAX_COMPARE,
  MAX_RECENT,
  pushRecent,
  toggleSelection,
  type ModelRef,
} from '@/lib/comparison';
import { createListStore } from '@/lib/local-list-store';

/** Selection for comparison (max 4). Persists across pages and reloads. */
const compareStore = createListStore('axiom-compare', MAX_COMPARE);
/** Recently viewed models (max 12), used by the directory now and by /compare later. */
const recentStore = createListStore('axiom-recent', MAX_RECENT);

export function useComparison() {
  const list = useSyncExternalStore(
    compareStore.subscribe,
    compareStore.getSnapshot,
    compareStore.getServerSnapshot,
  );
  /** Returns false when the model could not be added because the tray is full. */
  const toggle = useCallback((ref: ModelRef) => {
    const r = toggleSelection(compareStore.getSnapshot(), ref);
    if (r.ok) compareStore.set(r.list);
    return r.ok;
  }, []);
  const remove = useCallback((slug: string) => {
    compareStore.set(compareStore.getSnapshot().filter((m) => m.slug !== slug));
  }, []);
  const clear = useCallback(() => compareStore.set([]), []);
  /** Replaces the whole selection (used when /compare is opened from a shared URL). */
  const replace = useCallback((refs: ModelRef[]) => {
    if (
      refs.length === compareStore.getSnapshot().length &&
      refs.every((r, i) => r.slug === compareStore.getSnapshot()[i]?.slug)
    ) {
      return;
    }
    compareStore.set(refs.slice(0, MAX_COMPARE));
  }, []);
  return {
    list,
    has: (slug: string) => list.some((m) => m.slug === slug),
    full: list.length >= MAX_COMPARE,
    toggle,
    remove,
    clear,
    replace,
  };
}

export function useRecentlyViewed() {
  const list = useSyncExternalStore(
    recentStore.subscribe,
    recentStore.getSnapshot,
    recentStore.getServerSnapshot,
  );
  const record = useCallback((ref: ModelRef) => {
    const current = recentStore.getSnapshot();
    if (current[0]?.slug === ref.slug) return; // already the most recent: avoid churn
    recentStore.set(pushRecent(current, ref));
  }, []);
  return { list, record };
}
