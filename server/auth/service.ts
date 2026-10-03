import { normalizeEmail } from '../../src/lib/auth/credentials';
import type { Db } from '../db/client';
import { hashPassword, needsRehash, spendHashTime, verifyPassword } from './password';
import type { RateLimiter } from './rate-limit';
import { createSession, type Role, type SessionUser } from './sessions';

/** Sign-in limits: per address and per account, over 15 minutes. Tight on purpose (auth is the target). */
export const SIGNIN_IP_RULE = { limit: 30, windowSeconds: 15 * 60 };
export const SIGNIN_ACCOUNT_RULE = { limit: 8, windowSeconds: 15 * 60 };

export type SignInResult =
  | { ok: true; token: string; expires: Date; user: SessionUser }
  | { ok: false; reason: 'invalid' }
  | { ok: false; reason: 'throttled'; retryAfterSeconds: number };

type AuthDb = Pick<Db, 'user' | 'session'>;

/**
 * Checks credentials and opens a session. Deliberately uniform: an unknown email, a wrong
 * password and an account with no password all return `invalid` after the same amount of
 * hashing work, so the response never tells an attacker which accounts exist.
 */
export async function signIn(
  deps: { db: AuthDb; limiter: RateLimiter; now?: () => Date },
  input: { email: string; password: string; ip: string },
): Promise<SignInResult> {
  const email = normalizeEmail(input.email);

  const byIp = await deps.limiter.hit(`signin:ip:${input.ip}`, SIGNIN_IP_RULE);
  const byAccount = await deps.limiter.hit(`signin:acct:${email}`, SIGNIN_ACCOUNT_RULE);
  if (!byIp.allowed || !byAccount.allowed) {
    return {
      ok: false,
      reason: 'throttled',
      retryAfterSeconds: Math.max(byIp.retryAfterSeconds, byAccount.retryAfterSeconds),
    };
  }

  const user = await deps.db.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, role: true, passwordHash: true },
  });
  if (!user?.passwordHash) {
    await spendHashTime(input.password);
    return { ok: false, reason: 'invalid' };
  }
  if (!(await verifyPassword(user.passwordHash, input.password)))
    return { ok: false, reason: 'invalid' };

  // Hashes made with weaker parameters are upgraded transparently on a successful sign-in.
  if (needsRehash(user.passwordHash)) {
    await deps.db.user
      .update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword(input.password) },
      })
      .catch(() => undefined);
  }

  const { token, expires } = await createSession(deps.db, user.id, deps.now?.());
  return {
    ok: true,
    token,
    expires,
    user: { id: user.id, email: user.email, name: user.name, role: user.role as Role },
  };
}
