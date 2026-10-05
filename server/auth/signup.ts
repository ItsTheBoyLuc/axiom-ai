import { normalizeEmail, passwordIssueText, passwordIssues } from '../../src/lib/auth/credentials';
import { ApiError } from '../api/http';
import { recordAudit } from '../audit';
import type { Db } from '../db/client';
import { hashPassword } from './password';
import type { RateLimiter } from './rate-limit';
import { createSession, type SessionUser } from './sessions';

/**
 * Sign-up limits: per address, over an hour. Account creation is cheap to abuse (each one costs
 * an Argon2 hash), so this is stricter than sign-in.
 */
export const SIGNUP_IP_RULE = { limit: 10, windowSeconds: 60 * 60 };
/** A ceiling over ALL addresses, so spoofed or rotating addresses cannot mass-create accounts. */
export const SIGNUP_GLOBAL_RULE = { limit: 500, windowSeconds: 60 * 60 };

type SignUpDb = Pick<Db, 'user' | 'session' | 'auditLog'>;

export type SignUpResult =
  | { ok: true; token: string; expires: Date; user: SessionUser }
  | { ok: false; reason: 'throttled'; retryAfterSeconds: number };

/**
 * Creates a USER account and signs it in. The password policy is enforced here (400 with the
 * reasons), the email is normalised, and a duplicate email is a 409 EMAIL_TAKEN. Honest about
 * one trade-off: telling people an email is taken reveals that an account exists. That is the
 * price of sign-up without email delivery; the per-address limit bounds how fast it can be
 * probed, and sign-IN stays uniform. The Argon2 hash is computed before the lookup so a taken
 * and a free email cost the same time.
 *
 * No email verification yet (it needs outgoing mail credentials, see docs/DECISIONS.md): the
 * account is created with `emailVerified = null`.
 */
export async function signUp(
  deps: { db: SignUpDb; limiter: RateLimiter; now?: () => Date },
  input: { email: string; password: string; name?: string; ip: string },
): Promise<SignUpResult> {
  const email = normalizeEmail(input.email);

  const hit = await deps.limiter.hit(`signup:ip:${input.ip}`, SIGNUP_IP_RULE);
  const all = await deps.limiter.hit('signup:all', SIGNUP_GLOBAL_RULE);
  if (!hit.allowed || !all.allowed) {
    return {
      ok: false,
      reason: 'throttled',
      retryAfterSeconds: Math.max(hit.retryAfterSeconds, all.retryAfterSeconds),
    };
  }

  const issues = passwordIssues(input.password, email);
  if (issues.length > 0) {
    throw new ApiError(400, 'WEAK_PASSWORD', 'That password is not acceptable.', {
      issues: issues.map((i) => ({ path: 'password', message: passwordIssueText[i] })),
    });
  }

  const passwordHash = await hashPassword(input.password);
  let user: SessionUser;
  try {
    const row = await deps.db.user.create({
      data: { email, name: input.name ?? null, passwordHash, role: 'USER' },
      select: { id: true, email: true, name: true },
    });
    user = { ...row, role: 'USER' };
  } catch (err) {
    // Unique violation on email (Prisma P2002): the race-free way to detect "taken".
    if ((err as { code?: string }).code === 'P2002') {
      throw new ApiError(409, 'EMAIL_TAKEN', 'An account with this email already exists.');
    }
    throw err;
  }
  await recordAudit(deps.db, {
    actorId: user.id,
    action: 'user.signup',
    entityType: 'users',
    entityId: user.id,
    after: { email },
  });
  const { token, expires } = await createSession(deps.db, user.id, deps.now?.());
  return { ok: true, token, expires, user };
}
