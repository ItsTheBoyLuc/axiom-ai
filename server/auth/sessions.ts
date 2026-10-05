import type { Db } from '../db/client';
import { hashToken, newSessionToken } from './crypto';

/**
 * Database sessions (docs/PROMPT.md 3 and 12). The browser holds a random token in an httpOnly
 * cookie; the `Session` table holds only its SHA-256, so sessions are revocable (sign-out,
 * "sign out everywhere", a user removed or demoted) and a database leak yields no usable cookie.
 */

export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
/** A session used after this much of its life has passed is extended (sliding expiry). */
export const SESSION_REFRESH_AFTER_SECONDS = 24 * 60 * 60;

export type Role = 'USER' | 'ADMIN';
export type SessionUser = { id: string; email: string; name: string | null; role: Role };
export type ActiveSession = {
  id: string;
  expires: Date;
  user: SessionUser;
  /** True when this call extended the session: the browser's cookie must be re-issued too. */
  refreshed: boolean;
};

type SessionDb = Pick<Db, 'session'>;

export async function createSession(
  db: SessionDb,
  userId: string,
  now = new Date(),
): Promise<{ token: string; expires: Date }> {
  const token = newSessionToken();
  const expires = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);
  await db.session.create({ data: { sessionToken: hashToken(token), userId, expires } });
  return { token, expires };
}

/**
 * The live session for a cookie token, or null. Expired sessions are deleted on sight. A session
 * past the refresh point is extended, so active people stay signed in and idle ones do not.
 */
export async function findSession(
  db: SessionDb,
  token: string | undefined,
  now = new Date(),
): Promise<ActiveSession | null> {
  if (!token || token.length < 20 || token.length > 200) return null;
  const row = await db.session.findUnique({
    where: { sessionToken: hashToken(token) },
    select: {
      id: true,
      expires: true,
      user: { select: { id: true, email: true, name: true, role: true } },
    },
  });
  if (!row) return null;
  if (row.expires <= now) {
    await db.session.delete({ where: { id: row.id } }).catch(() => undefined);
    return null;
  }
  let expires = row.expires;
  let refreshed = false;
  const age = SESSION_TTL_SECONDS * 1000 - (row.expires.getTime() - now.getTime());
  if (age > SESSION_REFRESH_AFTER_SECONDS * 1000) {
    expires = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);
    await db.session.update({ where: { id: row.id }, data: { expires } }).catch(() => undefined);
    refreshed = true;
  }
  return { id: row.id, expires, refreshed, user: { ...row.user, role: row.user.role as Role } };
}

export async function deleteSession(db: SessionDb, token: string | undefined): Promise<void> {
  if (!token) return;
  await db.session.deleteMany({ where: { sessionToken: hashToken(token) } });
}

/** Signs a user out of every device (also used when their role or password changes). */
export async function deleteUserSessions(db: SessionDb, userId: string): Promise<number> {
  return (await db.session.deleteMany({ where: { userId } })).count;
}
