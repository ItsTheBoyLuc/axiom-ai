import { cache } from 'react';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { getEnv } from '../../src/lib/env';
import { getPrisma } from '../db/client';
import { cookieConfig } from './cookie';
import { findSession, type SessionUser } from './sessions';

/**
 * Data access layer for server components (Next.js authentication guide): the one place pages
 * ask "who is this?". It reads the session cookie and checks it against the database, once per
 * request (React `cache`). Proxy only does an optimistic redirect; THIS is the real check.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const cfg = cookieConfig(getEnv().APP_URL);
  const token = (await cookies()).get(cfg.name)?.value;
  const session = await findSession(getPrisma(), token);
  return session?.user ?? null;
});

/**
 * For admin pages: anonymous visitors go to sign-in (and come back), signed-in people without
 * the ADMIN role get a 404 so the admin area is not even confirmed to exist.
 */
export async function requireAdminPage(nextPath: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(nextPath)}`);
  if (user.role !== 'ADMIN') notFound();
  return user;
}
