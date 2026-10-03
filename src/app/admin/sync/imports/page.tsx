import type { Metadata } from 'next';
import Link from 'next/link';
import { TrustPill, utc } from '@/components/admin/status';
import { Pager } from '@/components/ui/pager';
import { listImports, type ImportStatus } from '../../../../../server/admin/imports';
import { requireAdminPage } from '../../../../../server/auth/current-user';
import { getPrisma } from '../../../../../server/db/client';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Imports' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const TABS: { status: ImportStatus; label: string }[] = [
  { status: 'PENDING', label: 'Waiting for review' },
  { status: 'APPROVED', label: 'Approved' },
  { status: 'REJECTED', label: 'Rejected' },
];

export default async function ImportsPage({ searchParams }: Props) {
  await requireAdminPage('/admin/sync/imports');
  const sp = await searchParams;
  const status = (TABS.find((t) => t.status === first(sp.status))?.status ??
    'PENDING') as ImportStatus;
  const runRaw = first(sp.run);
  const runId = runRaw && /^[A-Za-z0-9_-]{1,64}$/.test(runRaw) ? runRaw : undefined;
  const pageNo = Math.max(1, Number.parseInt(first(sp.page) ?? '1', 10) || 1);
  const data = await listImports(getPrisma(), { status, runId, page: pageNo });
  const pageCount = Math.max(1, Math.ceil(data.total / data.pageSize));

  const hrefFor = (p: number, s: ImportStatus = status) => {
    const u = new URLSearchParams();
    if (s !== 'PENDING') u.set('status', s);
    if (runId) u.set('run', runId);
    if (p > 1) u.set('page', String(p));
    return `/admin/sync/imports${u.size ? `?${u}` : ''}`;
  };
  const decided = first(sp.decided);

  return (
    <div className="space-y-6">
      <header>
        <Link href="/admin/sync" className="text-fg-2 hover:text-fg text-sm hover:underline">
          ← Data sync
        </Link>
        <h1 className="t-h2 mt-2">Imports</h1>
        <p className="text-fg-2 mt-1 text-sm">
          Records found by the sync worker. Each one is validated like seed data and waits here;
          publishing needs your approval.
          {runId && ' Showing one run only.'}
        </p>
      </header>

      {decided && (
        <p
          role="status"
          className="border-line bg-card text-fg rounded-lg border px-4 py-2 text-sm"
        >
          {decided === 'approve' ? 'Import approved and published.' : 'Import rejected.'}
        </p>
      )}

      <nav aria-label="Import status" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.status}
            href={hrefFor(1, t.status)}
            aria-current={t.status === status ? 'page' : undefined}
            className={`inline-flex min-h-10 items-center rounded-lg border px-3 text-sm ${t.status === status ? 'border-accent bg-accent/10 text-fg' : 'border-line text-fg-2 hover:text-fg'}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {data.rows.length === 0 ? (
        <p className="border-line text-fg-2 rounded-xl border p-8 text-center text-sm">
          {status === 'PENDING' ? 'Nothing is waiting for review.' : 'No imports in this list.'}
        </p>
      ) : (
        <ul className="border-line divide-line divide-y rounded-xl border">
          {data.rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/admin/sync/imports/${r.id}`}
                className="hover:bg-elevated flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 transition-colors"
              >
                <span className="min-w-0">
                  <span className="text-fg block truncate text-sm font-medium">{r.title}</span>
                  <span className="text-fg-2 block text-xs break-words">
                    {r.entityType} · {r.kind === 'new' ? 'new record' : 'changes a stored record'} ·{' '}
                    {r.source} · {utc(r.stagedAt)}
                  </span>
                </span>
                <TrustPill trust={r.trust} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pager page={data.page} pageCount={pageCount} hrefFor={(p) => hrefFor(p)} />
    </div>
  );
}
