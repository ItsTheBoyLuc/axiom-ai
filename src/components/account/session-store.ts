import type { Preferences } from '@/lib/account/schemas';

/**
 * Client-side session state as a tiny external store (consumed with useSyncExternalStore), so
 * components re-render when the session changes without any setState-in-effect. The first
 * subscriber triggers the first read of `/api/v1/auth/session`; anything that changes the
 * session (sign-in, sign-up, sign-out, settings) announces it and the store reads again.
 */

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  role: 'USER' | 'ADMIN';
};

export type SessionState =
  | { status: 'loading'; user: null; preferences: null }
  | { status: 'anonymous'; user: null; preferences: null }
  | { status: 'user'; user: SessionUser; preferences: Preferences; saved: string[] };

export const SESSION_CHANGED = 'axiom:session-changed';
/** Tell the store that the session changed (called by the auth forms and sign-out buttons). */
export const announceSessionChange = () => window.dispatchEvent(new Event(SESSION_CHANGED));

const LOADING: SessionState = { status: 'loading', user: null, preferences: null };
const ANONYMOUS: SessionState = { status: 'anonymous', user: null, preferences: null };

let state: SessionState = LOADING;
let started = false;
const listeners = new Set<() => void>();

function set(next: SessionState) {
  state = next;
  listeners.forEach((l) => l());
}

export async function refreshSession(): Promise<void> {
  try {
    const res = await fetch('/api/v1/auth/session', {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    const body = (await res.json()) as {
      data?: {
        user: SessionUser | null;
        preferences: Preferences | null;
        savedModels: string[] | null;
      };
    };
    const data = body.data;
    set(
      data?.user && data.preferences
        ? {
            status: 'user',
            user: data.user,
            preferences: data.preferences,
            saved: data.savedModels ?? [],
          }
        : ANONYMOUS,
    );
  } catch {
    // Offline or the server is down: browsing works, account features simply stay hidden.
    set(ANONYMOUS);
  }
}

export function subscribeSession(cb: () => void): () => void {
  listeners.add(cb);
  if (!started) {
    started = true;
    window.addEventListener(SESSION_CHANGED, () => void refreshSession());
    void refreshSession();
  }
  return () => {
    listeners.delete(cb);
  };
}

export const getSessionSnapshot = (): SessionState => state;
export const getServerSessionSnapshot = (): SessionState => LOADING;

/** Optimistic local update after a successful preferences save. */
export function setLocalPreferences(preferences: Preferences) {
  if (state.status === 'user') set({ ...state, preferences });
}

/** Optimistic local update of the saved-models set (rolled back by the caller on failure). */
export function setLocalSaved(slug: string, saved: boolean) {
  if (state.status !== 'user') return;
  const has = state.saved.includes(slug);
  if (saved === has) return;
  set({ ...state, saved: saved ? [slug, ...state.saved] : state.saved.filter((s) => s !== slug) });
}
