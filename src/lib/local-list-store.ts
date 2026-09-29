import { parseRefs, type ModelRef } from './comparison';

/**
 * Tiny localStorage-backed list store usable with useSyncExternalStore. Snapshots are cached
 * so React sees a stable reference until the list really changes. Works when storage is
 * blocked (falls back to memory for the page view) and syncs across tabs.
 */
export function createListStore(key: string, max: number) {
  const empty: ModelRef[] = [];
  let cache: ModelRef[] = empty;
  let loaded = false;
  const listeners = new Set<() => void>();

  const read = (): ModelRef[] => {
    try {
      return parseRefs(localStorage.getItem(key), max);
    } catch {
      return cache; // storage unavailable: keep the in-memory list
    }
  };

  const same = (a: ModelRef[], b: ModelRef[]) =>
    a.length === b.length && a.every((m, i) => m.slug === b[i]?.slug);

  const refresh = () => {
    const next = read();
    if (!same(next, cache)) {
      cache = next.length ? next : empty;
      listeners.forEach((l) => l());
    }
  };

  return {
    subscribe(cb: () => void) {
      listeners.add(cb);
      const onStorage = (e: StorageEvent) => {
        if (e.key === key) refresh();
      };
      window.addEventListener('storage', onStorage);
      return () => {
        listeners.delete(cb);
        window.removeEventListener('storage', onStorage);
      };
    },
    getSnapshot(): ModelRef[] {
      if (!loaded) {
        loaded = true;
        const initial = read();
        cache = initial.length ? initial : empty;
      }
      return cache;
    },
    getServerSnapshot(): ModelRef[] {
      return empty;
    },
    set(next: ModelRef[]) {
      cache = next.length ? next.slice(0, max) : empty;
      try {
        localStorage.setItem(key, JSON.stringify(cache));
      } catch {
        /* storage unavailable: list lasts for this page view only */
      }
      listeners.forEach((l) => l());
    },
  };
}
