import type { Prisma, PrismaClient } from '../../prisma/generated/client';
import { escapeLike, searchTokens } from '../../src/lib/text';
import { ApiError } from '../api/http';
import { recordAudit } from '../audit';
import { isoDateTime } from '../db/mappers';

/**
 * User administration. Accounts are created by `npm run admin:create` (first admin) and, from
 * Phase 9, by sign-up; here an admin can change a role, revoke sessions or delete an account.
 * Two rules keep the system recoverable: nobody changes or deletes THEIR OWN account here (so an
 * admin cannot lock themselves out), and the last remaining admin can never be removed.
 */

export type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  role: 'USER' | 'ADMIN';
  createdAt: string;
  activeSessions: number;
  /** True when the account has no password (e.g. GitHub only). The hash itself is never exposed. */
  hasPassword: boolean;
};

export type UserPage = { rows: AdminUser[]; total: number; page: number; pageSize: number };
export const USER_PAGE_SIZE = 25;

type Actor = { id: string; ip: string | null };

export async function listUsers(
  db: PrismaClient,
  opts: { q?: string; page?: number; now?: Date },
): Promise<UserPage> {
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const where: Prisma.UserWhereInput = {
    AND: searchTokens((opts.q ?? '').slice(0, 100)).map((t) => ({
      OR: [
        { email: { contains: escapeLike(t), mode: 'insensitive' } },
        { name: { contains: escapeLike(t), mode: 'insensitive' } },
      ],
    })),
  };
  const now = opts.now ?? new Date();
  const [rows, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      skip: (page - 1) * USER_PAGE_SIZE,
      take: USER_PAGE_SIZE,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        passwordHash: true,
        _count: { select: { sessions: { where: { expires: { gt: now } } } } },
      },
    }),
    db.user.count({ where }),
  ]);
  return {
    total,
    page,
    pageSize: USER_PAGE_SIZE,
    rows: rows.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      createdAt: isoDateTime(u.createdAt),
      activeSessions: u._count.sessions,
      hasPassword: u.passwordHash !== null,
    })),
  };
}

const notSelf = (actor: Actor, id: string, what: string) => {
  if (actor.id === id) {
    throw new ApiError(409, 'CONFLICT', `You cannot ${what} your own account.`);
  }
};

async function adminCount(tx: Prisma.TransactionClient) {
  return tx.user.count({ where: { role: 'ADMIN' } });
}

/** Changes a role. The user's sessions are revoked so the change applies immediately. */
export async function setUserRole(
  db: PrismaClient,
  actor: Actor,
  id: string,
  role: 'USER' | 'ADMIN',
): Promise<void> {
  notSelf(actor, id, 'change the role of');
  await db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id }, select: { email: true, role: true } });
    if (!user) throw new ApiError(404, 'NOT_FOUND', 'user not found');
    if (user.role === role) return;
    if (user.role === 'ADMIN' && (await adminCount(tx)) <= 1) {
      throw new ApiError(409, 'CONFLICT', 'The last administrator cannot be demoted.');
    }
    await tx.user.update({ where: { id }, data: { role } });
    await tx.session.deleteMany({ where: { userId: id } });
    await recordAudit(tx, {
      actorId: actor.id,
      action: 'user.role',
      entityType: 'users',
      entityId: id,
      before: { email: user.email, role: user.role },
      after: { email: user.email, role },
      ip: actor.ip,
    });
  });
}

/** Signs the user out everywhere (every session row removed). Returns how many were revoked. */
export async function revokeUserSessions(
  db: PrismaClient,
  actor: Actor,
  id: string,
): Promise<number> {
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id }, select: { email: true } });
    if (!user) throw new ApiError(404, 'NOT_FOUND', 'user not found');
    const { count } = await tx.session.deleteMany({ where: { userId: id } });
    await recordAudit(tx, {
      actorId: actor.id,
      action: 'user.revoke-sessions',
      entityType: 'users',
      entityId: id,
      after: { email: user.email, revoked: count },
      ip: actor.ip,
    });
    return count;
  });
}

/** Deletes an account (its sessions, saved items and preferences cascade; audit rows are kept). */
export async function deleteUser(db: PrismaClient, actor: Actor, id: string): Promise<void> {
  notSelf(actor, id, 'delete');
  await db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id }, select: { email: true, role: true } });
    if (!user) throw new ApiError(404, 'NOT_FOUND', 'user not found');
    if (user.role === 'ADMIN' && (await adminCount(tx)) <= 1) {
      throw new ApiError(409, 'CONFLICT', 'The last administrator cannot be deleted.');
    }
    await tx.user.delete({ where: { id } });
    await recordAudit(tx, {
      actorId: actor.id,
      action: 'user.delete',
      entityType: 'users',
      entityId: id,
      before: { email: user.email, role: user.role },
      ip: actor.ip,
    });
  });
}
