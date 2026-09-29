'use client';

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from 'react';

export type ThemePreference = 'system' | 'dark' | 'light';
type Resolved = 'dark' | 'light';
type Ctx = {
  preference: ThemePreference;
  resolved: Resolved;
  setPreference: (t: ThemePreference) => void;
};

const STORAGE_KEY = 'axiom-theme';
const ThemeContext = createContext<Ctx | null>(null);

/**
 * Inline script run before first paint (see layout.tsx) so the correct theme is applied
 * with no flash. Keep in sync with resolve() below.
 */
export const themeInitScript = `(function(){try{var p=localStorage.getItem('${STORAGE_KEY}')||'system';var d=p==='system'?(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):p;document.documentElement.setAttribute('data-theme',d);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

/** In-memory copy so the toggle still works when localStorage is blocked. */
let memoryPreference: ThemePreference | null = null;
const listeners = new Set<() => void>();

function readPreference(): ThemePreference {
  if (memoryPreference) return memoryPreference;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'dark' || v === 'light' || v === 'system' ? v : 'system';
  } catch {
    return 'system';
  }
}

function resolve(p: ThemePreference): Resolved {
  if (p !== 'system') return p;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function apply(p: ThemePreference) {
  document.documentElement.setAttribute('data-theme', resolve(p));
}

/** External store: preference lives in storage, "system" follows the OS media query. */
function subscribe(cb: () => void) {
  listeners.add(cb);
  const mq = window.matchMedia('(prefers-color-scheme: light)');
  const onOs = () => {
    if (readPreference() === 'system') apply('system');
    cb();
  };
  mq.addEventListener('change', onOs);
  return () => {
    listeners.delete(cb);
    mq.removeEventListener('change', onOs);
  };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const preference = useSyncExternalStore<ThemePreference>(
    subscribe,
    readPreference,
    () => 'system',
  );
  const resolved = useSyncExternalStore<Resolved>(
    subscribe,
    () => resolve(readPreference()),
    () => 'dark',
  );

  const setPreference = useCallback((t: ThemePreference) => {
    memoryPreference = t;
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* storage unavailable: preference lasts for this page view only */
    }
    apply(t);
    listeners.forEach((l) => l());
  }, []);

  const value = useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Ctx {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
