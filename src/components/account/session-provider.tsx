'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
import { useMotionPreference } from '@/components/layout/motion-preference-provider';
import { useTheme } from '@/components/layout/theme-provider';
import type { Preferences } from '@/lib/account/schemas';
import {
  getServerSessionSnapshot,
  getSessionSnapshot,
  refreshSession,
  setLocalPreferences,
  subscribeSession,
  type SessionState,
} from './session-store';

export { announceSessionChange, type SessionUser } from './session-store';

/**
 * Who is signed in, for the page chrome (account menu, save buttons). The pages themselves stay
 * static or cached: this asks `/api/v1/auth/session` once per page load. That endpoint answers
 * 200 with `user: null` for anonymous visitors (so no failed request shows up in the browser)
 * and does no database work when there is no session cookie. Anonymous browsing is unchanged.
 */

type Api = SessionState & {
  /** Re-reads the session (after sign-in, sign-up, sign-out or a settings change). */
  refresh: () => Promise<void>;
  /** Saves a preference change for the signed-in user. Returns false when it was not saved. */
  updatePreferences: (patch: Partial<Preferences>) => Promise<boolean>;
};

const SessionContext = createContext<Api | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const state = useSyncExternalStore(
    subscribeSession,
    getSessionSnapshot,
    getServerSessionSnapshot,
  );
  const { preference: localTheme, setPreference } = useTheme();
  const themeAdopted = useRef(false);
  const { preference: localMotion, setPreference: setMotion } = useMotionPreference();
  const motionAdopted = useRef(false);

  // The account is the source of truth across devices: adopt the saved theme once per page load.
  const savedTheme = state.status === 'user' ? state.preferences.theme : null;
  useEffect(() => {
    if (savedTheme && !themeAdopted.current) {
      themeAdopted.current = true;
      if (savedTheme !== localTheme) setPreference(savedTheme);
    }
  }, [savedTheme, localTheme, setPreference]);

  // Same for the motion setting.
  const savedMotion = state.status === 'user' ? state.preferences.motion : null;
  useEffect(() => {
    if (savedMotion && !motionAdopted.current) {
      motionAdopted.current = true;
      if (savedMotion !== localMotion) setMotion(savedMotion);
    }
  }, [savedMotion, localMotion, setMotion]);

  const updatePreferences = useCallback(async (patch: Partial<Preferences>) => {
    const current = getSessionSnapshot();
    if (current.status !== 'user') return false;
    const next = { ...current.preferences, ...patch };
    try {
      const res = await fetch('/api/v1/me/preferences', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      if (!res.ok) return false;
      setLocalPreferences(next);
      return true;
    } catch {
      return false;
    }
  }, []);

  const value = useMemo<Api>(
    () => ({ ...state, refresh: refreshSession, updatePreferences }),
    [state, updatePreferences],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Api {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
