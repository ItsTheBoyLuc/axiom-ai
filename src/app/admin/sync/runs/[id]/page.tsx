import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RunStatus, utc } from '@/components/admin/status';
import { getRun } from '../../../../../../server/admin/sync-sources';
import { requireAdminPage } from '../../../../../../server/auth/current-user';
import { getPrisma } from '../../../../../../server/db/client';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Sync run' };

type Props = { params: Promise<{ id: string }> };

export default async function RunPage({ params }: Props) {
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) notFound();
  await requireAdminPage(`/admin/sync/runs/${id}`);
  const db = getPrisma();
  const run = await getRun(db, id);
  if (!run) notFound();
  const staged = await db.importedRecord.count({ where: { runId: id } });

  return (
    <div className="space-y-8">
      <header>
        <Link href="/admin/sync" className="text-fg-2 hover:text-fg text-sm hover:underline">
          ← Data sync
        </Link>
        <h1 className="t-h2 mt-2">Sync run</h1>
        <p className="text-fg-2 mt-1 text-sm">
          {run.source.name}{' '}
          <span className="text-muted font-mono text-xs">({run.source.kind})</span>
        </p>
      </header>

      <dl className="border-line grid grid-cols-1 gap-x-8 gap-y-3 rounded-xl border p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted text-xs">Status</dt>
          <dd className="mt-1">
            <RunStatus status={run.status} />
          </dd>
        </div>
        <div>
          <dt className="text-muted text-xs">Started</dt>
          <dd className="text-fg-2 mt-1">{utc(run.startedAt.toISOString())}</dd>
        </div>
        <div>
          <dt className="text-muted text-xs">Finished</dt>
          <dd className="text-fg-2 mt-1">{utc(run.finishedAt?.toISOString())}</dd>
        </div>
        <div>
          <dt className="text-muted text-xs">Records seen / staged</dt>
          <dd className="text-fg-2 mt-1">
            {run.recordsSeen} / {run.recordsChanged}
          </dd>
        </div>
      </dl>

      {run.error && (
        <p
          role="alert"
          className="border-danger/40 bg-danger/5 text-fg rounded-lg border p-4 text-sm break-words"
        >
          <span className="font-medium">The run failed:</span> {run.error}
        </p>
      )}

      {staged > 0 && (
        <p className="text-sm">
          <Link href={`/admin/sync/imports?run=${run.id}`} className="text-accent hover:underline">
            Review the {staged} import{staged === 1 ? '' : 's'} staged by this run
          </Link>
        </p>
      )}

      <section aria-labelledby="issues">
        <h2 id="issues" className="t-h3 mb-3">
          Validation issues ({run.issues.length})
        </h2>
        {run.issues.length === 0 ? (
          <p className="text-fg-2 text-sm">Every record the source returned was valid.</p>
        ) : (
          <ul className="border-line divide-line divide-y rounded-xl border">
            {run.issues.map((i) => (
              <li key={i.id} className="space-y-2 px-4 py-3">
                <p className="text-fg text-sm break-words">
                  <span className="text-muted font-mono text-xs">{i.entityType}</span> {i.message}
                </p>
                <details>
                  <summary className="text-accent cursor-pointer text-xs">Show the record</summary>
                  <pre className="bg-elevated text-fg-2 mt-2 max-h-72 overflow-auto rounded-lg p-3 text-xs">
                    {JSON.stringify(i.payload, null, 2)}
                  </pre>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
