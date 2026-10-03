import type { Prisma, PrismaClient } from '../../prisma/generated/client';
import { escapeLike } from '../../src/lib/text';
import { isoDateTime } from '../db/mappers';

/** Read side of the audit log (written by server/audit.ts). Newest first, filterable, paged. */

export type AuditRow = {
  id: string;
  createdAt: string;
  actor: string | null;
  action: string;
  entityType: string;
  entityId: string;
  ip: string | null;
  before: unknown;
  after: unknown;
};
export type AuditPage = { rows: AuditRow[]; total: number; page: number; pageSize: number };
export const AUDIT_PAGE_SIZE = 25;

export async function listAudit(
  db: PrismaClient,
  opts: { entity?: string; action?: string; page?: number },
): Promise<AuditPage> {
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const where: Prisma.AuditLogWhereInput = {
    ...(opts.entity ? { entityType: opts.entity.slice(0, 60) } : {}),
    ...(opts.action
      ? { action: { contains: escapeLike(opts.action.slice(0, 60)), mode: 'insensitive' } }
      : {}),
  };
  const [rows, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * AUDIT_PAGE_SIZE,
      take: AUDIT_PAGE_SIZE,
      include: { actor: { select: { email: true } } },
    }),
    db.auditLog.count({ where }),
  ]);
  return {
    total,
    page,
    pageSize: AUDIT_PAGE_SIZE,
    rows: rows.map((r) => ({
      id: r.id,
      createdAt: isoDateTime(r.createdAt),
      actor: r.actor?.email ?? null,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      ip: r.ip,
      before: r.before,
      after: r.after,
    })),
  };
}
