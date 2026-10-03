import type { Db } from './db/client';

/**
 * Audit log (docs/PROMPT.md 9 and 12): every admin write and every approval records who did what
 * to which record, with the before and after values. Secrets are redacted before they are
 * stored, and the entry is written with the change itself so the two cannot diverge.
 */

export type AuditEntry = {
  actorId: string | null;
  /** Dotted verb, e.g. `provider.update`, `import.approve`, `user.role`. */
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
};

const SECRET_KEYS = new Set(['passwordHash', 'sessionToken', 'password', 'token', 'secret']);

/** A JSON-safe copy with secrets replaced by "[redacted]" (dates become ISO strings). */
export function redact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value ?? null;
  if (depth > 8) return '[too deep]';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'object' && 'toNumber' in value && typeof value.toNumber === 'function') {
    return (value as { toNumber(): number }).toNumber(); // Prisma Decimal
  }
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        SECRET_KEYS.has(k) ? '[redacted]' : redact(v, depth + 1),
      ]),
    );
  }
  return value;
}

type AuditDb = Pick<Db, 'auditLog'>;

export async function recordAudit(db: AuditDb, e: AuditEntry): Promise<void> {
  await db.auditLog.create({
    data: {
      actorId: e.actorId,
      action: e.action,
      entityType: e.entityType,
      entityId: e.entityId,
      before: e.before === undefined ? undefined : (redact(e.before) as object),
      after: e.after === undefined ? undefined : (redact(e.after) as object),
      ip: e.ip ?? null,
    },
  });
}
