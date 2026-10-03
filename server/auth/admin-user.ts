import { normalizeEmail, passwordIssues } from '../../src/lib/auth/credentials';
import { recordAudit } from '../audit';
import type { Db } from '../db/client';
import { hashPassword } from './password';
import { deleteUserSessions } from './sessions';

type AdminDb = Pick<Db, 'user' | 'session' | 'auditLog'>;

export type AdminUserResult =
  | { action: 'created' | 'promoted' | 'rotated'; userId: string }
  | { action: 'exists'; userId: string };

/**
 * Creates the first administrator, promotes an existing account, or (with `rotate`) replaces an
 * admin's password. The password is chosen by the caller (the CLI generates a random one), is
 * checked against the password policy and stored only as an Argon2id hash. Re-running without
 * `rotate` never changes an existing admin. Every outcome except "exists" is audit-logged, and a
 * rotation signs the account out everywhere.
 */
export async function createOrRotateAdmin(
  db: AdminDb,
  input: { email: string; password: string; rotate?: boolean },
): Promise<AdminUserResult> {
  const email = normalizeEmail(input.email);
  const issues = passwordIssues(input.password, email);
  if (issues.length > 0) throw new Error(`Password rejected: ${issues.join(', ')}`);

  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true, role: true, passwordHash: true },
  });
  if (existing && existing.role === 'ADMIN' && existing.passwordHash && !input.rotate) {
    return { action: 'exists', userId: existing.id };
  }

  const passwordHash = await hashPassword(input.password);
  if (!existing) {
    const user = await db.user.create({
      data: { email, passwordHash, role: 'ADMIN', emailVerified: new Date() },
      select: { id: true },
    });
    await recordAudit(db, {
      actorId: null,
      action: 'admin.create',
      entityType: 'User',
      entityId: user.id,
      after: { email, role: 'ADMIN' },
    });
    return { action: 'created', userId: user.id };
  }

  const wasAdmin = existing.role === 'ADMIN';
  await db.user.update({
    where: { id: existing.id },
    data: { passwordHash, role: 'ADMIN' },
  });
  await deleteUserSessions(db, existing.id);
  await recordAudit(db, {
    actorId: null,
    action: wasAdmin ? 'admin.rotate' : 'admin.promote',
    entityType: 'User',
    entityId: existing.id,
    before: { role: existing.role },
    after: { role: 'ADMIN' },
  });
  return { action: wasAdmin ? 'rotated' : 'promoted', userId: existing.id };
}
