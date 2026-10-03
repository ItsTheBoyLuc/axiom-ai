import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ImportReview } from '@/components/admin/import-review';
import { TrustPill, utc } from '@/components/admin/status';
import { getImport } from '../../../../../../server/admin/imports';
import { requireAdminPage } from '../../../../../../server/auth/current-user';
import { getPrisma } from '../../../../../../server/db/client';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Review import' };

type Props = { params: Promise<{ id: string }> };

const show = (v: unknown): string =>
  v === null || v === undefined ? '—' : typeof v === 'string' ? v : JSON.stringify(v);

export default async function ImportDetailPage({ params }: Props) {
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) notFound();
  await requireAdminPage(`/admin/sync/imports/${id}`);
  const row = await getImport(getPrisma(), id);
  if (!row) notFound();

  const changes = Object.entries(row.changes);
  // Shown for a new record: the facts the source supplies (long text is cut to keep the page calm).
  const fields = Object.entries(row.payload).filter(([, v]) => v !== null && v !== '');

  return (
    <div className="space-y-8">
      <header>
        <Link
          href="/admin/sync/imports"
          className="text-fg-2 hover:text-fg text-sm hover:underline"
        >
          ← Imports
        </Link>
        <h1 className="t-h2 mt-2 break-words">{row.title}</h1>
        <p className="text-fg-2 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span>{row.entityType}</span>
          <span>{row.kind === 'new' ? 'New record' : 'Changes a stored record'}</span>
          <span>from {row.source}</span>
          <span className="text-muted font-mono text-xs">{utc(row.stagedAt)}</span>
          <TrustPill trust={row.trust} />
        </p>
        <p className="text-muted mt-1 font-mono text-xs break-all">{row.key}</p>
      </header>

      {row.status !== 'PENDING' ? (
        <p
          role="status"
          className="border-line bg-card text-fg rounded-lg border px-4 py-3 text-sm"
        >
          This import was {row.status.toLowerCase()} on {utc(row.reviewedAt)}.
        </p>
      ) : (
        <ImportReview id={row.id} downgrade={row.trust === 'downgrade'} />
      )}

      {row.kind === 'update' ? (
        <section aria-labelledby="changes">
          <h2 id="changes" className="t-h3 mb-3">
            What would change
          </h2>
          <p className="text-fg-2 mb-3 text-sm">
            Curated fields (summary, related models, classification) are never overwritten by an
            import; only the fields below differ.
          </p>
          <div className="border-line overflow-x-auto rounded-xl border">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">
                Fields that differ between the stored record and the import
              </caption>
              <thead className="text-muted text-xs">
                <tr>
                  <th scope="col" className="px-4 py-2 font-normal">
                    Field
                  </th>
                  <th scope="col" className="px-4 py-2 font-normal">
                    Stored now
                  </th>
                  <th scope="col" className="px-4 py-2 font-normal">
                    After approval
                  </th>
                </tr>
              </thead>
              <tbody className="divide-line divide-y">
                {changes.map(([field, c]) => (
                  <tr key={field}>
                    <th scope="row" className="text-fg px-4 py-2 font-mono text-xs font-normal">
                      {field}
                    </th>
                    <td className="text-fg-2 px-4 py-2 break-words">{show(c.before)}</td>
                    <td className="text-fg px-4 py-2 break-words">{show(c.after)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section aria-labelledby="record">
          <h2 id="record" className="t-h3 mb-3">
            The record
          </h2>
          <dl className="border-line grid grid-cols-1 gap-x-8 gap-y-3 rounded-xl border p-4 text-sm sm:grid-cols-[12rem_minmax(0,1fr)]">
            {fields.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted font-mono text-xs">{k}</dt>
                <dd className="text-fg-2 break-words">{show(v)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}
