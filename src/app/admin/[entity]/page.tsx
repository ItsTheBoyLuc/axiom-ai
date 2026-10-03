import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Plus } from 'lucide-react';
import { DemoBadge, VerificationBadge } from '@/components/ui/badges';
import { Pager } from '@/components/ui/pager';
import type { VerificationStatus } from '@/lib/verification';
import { DEFINITIONS, isAdminEntity } from '../../../../server/admin/definitions';
import { listRecords } from '../../../../server/admin/records';
import { requireAdminPage } from '../../../../server/auth/current-user';
import { getPrisma } from '../../../../server/db/client';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ entity: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { entity } = await params;
  return { title: isAdminEntity(entity) ? DEFINITIONS[entity].label : 'Admin' };
}

export default async function EntityListPage({ params, searchParams }: Props) {
  const { entity } = await params;
  if (!isAdminEntity(entity)) notFound();
  await requireAdminPage(`/admin/${entity}`);
  const sp = await searchParams;
  const q = (first(sp.q) ?? '').slice(0, 100);
  const pageNo = Math.max(1, Number.parseInt(first(sp.page) ?? '1', 10) || 1);
  const def = DEFINITIONS[entity];
  const data = await listRecords(getPrisma(), entity, { q, page: pageNo });
  const pageCount = Math.max(1, Math.ceil(data.total / data.pageSize));

  const hrefFor = (p: number) => {
    const u = new URLSearchParams();
    if (q) u.set('q', q);
    if (p > 1) u.set('page', String(p));
    const s = u.toString();
    return `/admin/${entity}${s ? `?${s}` : ''}`;
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="t-h2">{def.label}</h1>
          <p className="text-fg-2 mt-1 text-sm">
            {data.total} record{data.total === 1 ? '' : 's'}
            {q ? ` matching “${q}”` : ''}
          </p>
        </div>
        <Link
          href={`/admin/${entity}/new`}
          className="bg-accent text-accent-fg inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium hover:brightness-110"
        >
          <Plus size={16} aria-hidden /> New {def.singular}
        </Link>
      </header>

      {first(sp.deleted) && (
        <p
          role="status"
          className="border-line bg-card text-fg rounded-lg border px-4 py-2 text-sm"
        >
          The {def.singular} was deleted.
        </p>
      )}

      <form method="get" role="search" className="flex gap-2">
        <label htmlFor="admin-q" className="sr-only">
          Search {def.label.toLowerCase()}
        </label>
        <input
          id="admin-q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder={`Search ${def.label.toLowerCase()}…`}
          maxLength={100}
          className="border-line-strong bg-elevated text-fg h-10 w-full max-w-md rounded-lg border px-3 text-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
        />
        <button
          type="submit"
          className="border-line-strong bg-elevated text-fg h-10 rounded-lg border px-4 text-sm"
        >
          Search
        </button>
        {q && (
          <Link
            href={`/admin/${entity}`}
            className="text-fg-2 hover:text-fg inline-flex h-10 items-center px-2 text-sm"
          >
            Clear
          </Link>
        )}
      </form>

      {data.rows.length === 0 ? (
        <p className="border-line text-fg-2 rounded-xl border p-8 text-center text-sm">
          {q ? 'No records match your search.' : `There are no ${def.label.toLowerCase()} yet.`}
        </p>
      ) : (
        <ul className="border-line divide-line divide-y rounded-xl border">
          {data.rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/admin/${entity}/${r.id}`}
                className="hover:bg-elevated flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 transition-colors"
              >
                <span className="min-w-0">
                  <span className="text-fg block truncate text-sm font-medium">{r.title}</span>
                  {r.subtitle && (
                    <span className="text-fg-2 block truncate text-xs">{r.subtitle}</span>
                  )}
                </span>
                <span className="flex items-center gap-2">
                  {r.isDemo && <DemoBadge />}
                  <VerificationBadge status={r.verificationStatus as VerificationStatus} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pager page={data.page} pageCount={pageCount} hrefFor={hrefFor} />
    </div>
  );
}
