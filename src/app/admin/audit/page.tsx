import type { Metadata } from 'next';
import Link from 'next/link';
import { Pager } from '@/components/ui/pager';
import { ADMIN_ENTITIES } from '../../../../server/admin/definitions';
import { listAudit } from '../../../../server/admin/audit-log';
import { requireAdminPage } from '../../../../server/auth/current-user';
import { getPrisma } from '../../../../server/db/client';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Audit log' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const ENTITY_TYPES = [...ADMIN_ENTITIES, 'users', 'imports', 'sync-sources'] as const;

export default async function AuditLogPage({ searchParams }: Props) {
  await requireAdminPage('/admin/audit');
  const sp = await searchParams;
  const entityRaw = first(sp.entity) ?? '';
  const entity = (ENTITY_TYPES as readonly string[]).includes(entityRaw) ? entityRaw : '';
  const action = (first(sp.action) ?? '').slice(0, 60);
  const pageNo = Math.max(1, Number.parseInt(first(sp.page) ?? '1', 10) || 1);
  const data = await listAudit(getPrisma(), {
    entity: entity || undefined,
    action: action || undefined,
    page: pageNo,
  });
  const pageCount = Math.max(1, Math.ceil(data.total / data.pageSize));
  const hrefFor = (p: number) => {
    const u = new URLSearchParams();
    if (entity) u.set('entity', entity);
    if (action) u.set('action', action);
    if (p > 1) u.set('page', String(p));
    return `/admin/audit${u.size ? `?${u}` : ''}`;
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="t-h2">Audit log</h1>
        <p className="text-fg-2 mt-1 text-sm">
          {data.total} entr{data.total === 1 ? 'y' : 'ies'}. Who changed what, when and from which
          address, with the values before and after. Secrets are never stored in it.
        </p>
      </header>

      <form method="get" role="search" className="flex flex-wrap items-end gap-3">
        <label className="text-fg-2 text-xs">
          Record type
          <select
            name="entity"
            defaultValue={entity}
            className="border-line-strong bg-elevated text-fg mt-1 block h-10 rounded-lg border px-3 text-sm"
          >
            <option value="">All</option>
            {ENTITY_TYPES.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </label>
        <label className="text-fg-2 text-xs">
          Action contains
          <input
            name="action"
            defaultValue={action}
            maxLength={60}
            placeholder="e.g. delete"
            className="border-line-strong bg-elevated text-fg mt-1 block h-10 rounded-lg border px-3 text-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
          />
        </label>
        <button
          type="submit"
          className="border-line-strong bg-elevated text-fg h-10 rounded-lg border px-4 text-sm"
        >
          Filter
        </button>
        {(entity || action) && (
          <Link
            href="/admin/audit"
            className="text-fg-2 hover:text-fg inline-flex h-10 items-center px-2 text-sm"
          >
            Clear
          </Link>
        )}
      </form>

      {data.rows.length === 0 ? (
        <p className="border-line text-fg-2 rounded-xl border p-8 text-center text-sm">
          No entries match.
        </p>
      ) : (
        <ul className="border-line divide-line divide-y rounded-xl border">
          {data.rows.map((r) => (
            <li key={r.id} className="px-4 py-3">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                <time dateTime={r.createdAt} className="text-muted font-mono text-xs">
                  {r.createdAt.slice(0, 19).replace('T', ' ')} UTC
                </time>
                <span className="text-fg font-mono">{r.action}</span>
                <span className="text-fg-2">{r.actor ?? 'system'}</span>
                {r.ip && <span className="text-muted font-mono text-xs">{r.ip}</span>}
              </div>
              <p className="text-muted mt-1 font-mono text-xs break-all">
                {r.entityType} · {r.entityId}
              </p>
              {(r.before !== null || r.after !== null) && (
                <details className="mt-2">
                  <summary className="text-accent cursor-pointer text-xs">Show values</summary>
                  <div className="mt-2 grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {(['before', 'after'] as const).map((k) => (
                      <div key={k} className="min-w-0">
                        <p className="t-eyebrow mb-1">{k}</p>
                        <pre className="bg-elevated text-fg-2 max-h-72 overflow-auto rounded-lg p-3 text-xs">
                          {r[k] === null ? '—' : JSON.stringify(r[k], null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
      <Pager page={data.page} pageCount={pageCount} hrefFor={hrefFor} />
    </div>
  );
}
