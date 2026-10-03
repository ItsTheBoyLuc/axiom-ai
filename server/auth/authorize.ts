import { ApiError } from '../api/http';
import type { Db } from '../db/client';
import { readCookie, type CookieConfig } from './cookie';
import { findSession, type Role, type SessionUser } from './sessions';

type AuthDb = Pick<Db, 'session'>;

/** The signed-in user behind a request's session cookie, or null. */
export async function userFromRequest(
  db: AuthDb,
  cookie: CookieConfig,
  request: Pick<Request, 'headers'>,
  now?: Date,
): Promise<SessionUser | null> {
  const token = readCookie(request.headers.get('cookie'), cookie.name);
  const session = await findSession(db, token, now);
  return session?.user ?? null;
}

/**
 * Authorization for API handlers. No session is 401, a session without the required role is 403.
 * The check runs against the database on every request (sessions are revocable and roles can
 * change), never against anything the client sent besides the opaque cookie.
 */
export async function authorize(
  db: AuthDb,
  cookie: CookieConfig,
  request: Pick<Request, 'headers'>,
  required: Role,
  now?: Date,
): Promise<SessionUser> {
  const user = await userFromRequest(db, cookie, request, now);
  if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
  if (required === 'ADMIN' && user.role !== 'ADMIN') {
    throw new ApiError(403, 'FORBIDDEN', 'You do not have access to this resource.');
  }
  return user;
}
