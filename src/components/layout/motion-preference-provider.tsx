'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import {
  MOTION_STORAGE_KEY,
  isMotionPreference,
  resolveMotion,
  type MotionMode,
  type MotionPreference,
} from '@/lib/motion-preference';

type Ctx = {
  preference: MotionPreference;
  /** What actually applies: the preference resolved against the OS setting. */
  mode: MotionMode;
  setPreference: (p: MotionPreference) => void;
};

/** Without a provider (isolated component tests) the setting is the default: follow the system. */
const fallback: Ctx = { preference: 'system', mode: 'full', setPreference: () => {} };
const MotionPreferenceContext = createContext<Ctx>(fallback);
const OS_QUERY = '(prefers-reduced-motion: reduce)';

/** In-memory copy so the setting still works when localStorage is blocked. */
let memoryPreference: MotionPreference | null = null;
const listeners = new Set<() => void>();

function readPreference(): MotionPreference {
  if (memoryPreference) return memoryPreference;
  try {
    const v = localStorage.getItem(MOTION_STORAGE_KEY);
    return isMotionPreference(v) ? v : 'system';
  } catch {
    return 'system';
  }
}

const osReduces = () => window.matchMedia(OS_QUERY).matches;

function apply(pref: MotionPreference) {
  document.documentElement.setAttribute('data-motion', resolveMotion(pref, osReduces()));
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const mq = window.matchMedia(OS_QUERY);
  const onOs = () => {
    apply(readPreference());
    cb();
  };
  mq.addEventListener('change', onOs);
  return () => {
    listeners.delete(cb);
    mq.removeEventListener('change', onOs);
  };
}

/**
 * Owns the motion setting. The server and the first client render assume `system` / `full`, so
 * markup never depends on it; consumers act on it in effects. The attribute on <html> is already
 * correct before hydration (inline script), this keeps it correct afterwards.
 */
export function MotionPreferenceProvider({ children }: { children: ReactNode }) {
  const preference = useSyncExternalStore<MotionPreference>(
    subscribe,
    readPreference,
    () => 'system',
  );
  const mode = useSyncExternalStore<MotionMode>(
    subscribe,
    () => resolveMotion(readPreference(), osReduces()),
    () => 'full',
  );

  const setPreference = useCallback((p: MotionPreference) => {
    memoryPreference = p;
    try {
      localStorage.setItem(MOTION_STORAGE_KEY, p);
    } catch {
      /* storage unavailable: the choice lasts for this page view only */
    }
    apply(p);
    listeners.forEach((l) => l());
  }, []);

  const value = useMemo(
    () => ({ preference, mode, setPreference }),
    [preference, mode, setPreference],
  );
  return (
    <MotionPreferenceContext.Provider value={value}>{children}</MotionPreferenceContext.Provider>
  );
}

export function useMotionPreference(): Ctx {
  return useContext(MotionPreferenceContext);
}

/** Convenience: `true` when the effective mode is "reduced". */
export function useReducedMode(): boolean {
  return useMotionPreference().mode === 'reduced';
}
