import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { SourceActions } from '@/components/admin/source-actions';
import { RunStatus, utc } from '@/components/admin/status';
import { ADAPTERS } from '../../../../server/adapters';
import { listSources, listRuns } from '../../../../server/admin/sync-sources';
import { requireAdminPage } from '../../../../server/auth/current-user';
import { getPrisma } from '../../../../server/db/client';
import { workerStatus } from '../../../../server/jobs/queue';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Data sync' };

export default async function SyncDashboardPage() {
  await requireAdminPage('/admin/sync');
  const db = getPrisma();
  const [sources, runs, worker, pending] = await Promise.all([
    listSources(db),
    listRuns(db, {}),
    workerStatus(),
    db.importedRecord.count({ where: { status: 'PENDING' } }),
  ]);

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="t-h2">Data sync</h1>
          <p className="text-fg-2 mt-2 max-w-2xl text-sm">
            Sources are official feeds and public APIs. The worker fetches them politely (robots.txt
            and rate limits respected), validates what it finds and stages it here for your
            approval. Nothing is published automatically, and an import can never lower the trust of
            stored data without your explicit override.
          </p>
        </div>
        <Link
          href="/admin/sync/sources/new"
          className="bg-accent text-accent-fg inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium hover:brightness-110"
        >
          <Plus size={16} aria-hidden /> New source
        </Link>
      </header>

      <section aria-label="Overview" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="border-line bg-card rounded-xl border p-4">
          <p className="text-fg-2 text-sm">Worker</p>
          <p className="text-fg mt-1 text-lg">
            <span
              aria-hidden
              className={`mr-2 inline-block size-2.5 rounded-full ${worker.online ? 'bg-accent-2' : 'bg-danger'}`}
            />
            {worker.online ? 'Online' : 'Offline'}
          </p>
          <p className="text-muted mt-1 text-xs">
            {worker.online
              ? `Last seen ${utc(worker.lastSeen)}`
              : 'No heartbeat. Scheduled and manual runs wait until the worker is running.'}
          </p>
        </div>
        <Link
          href="/admin/sync/imports"
          className="border-line bg-card hover:border-line-strong rounded-xl border p-4 transition-colors"
        >
          <p className="text-fg-2 text-sm">Imports waiting for review</p>
          <p className="text-fg mt-1 font-mono text-2xl">{pending}</p>
          <p className="text-accent mt-1 text-xs">Review imports</p>
        </Link>
        <div className="border-line bg-card rounded-xl border p-4">
          <p className="text-fg-2 text-sm">Sources</p>
          <p className="text-fg mt-1 font-mono text-2xl">
            {sources.filter((s) => s.enabled).length}
            <span className="text-muted text-base"> / {sources.length} enabled</span>
          </p>
          <p className="text-muted mt-1 text-xs">
            {Object.keys(ADAPTERS).length} source types available
          </p>
        </div>
      </section>

      <section aria-labelledby="sources">
        <h2 id="sources" className="t-h3 mb-3">
          Sources
        </h2>
        {sources.length === 0 ? (
          <p className="border-line text-fg-2 rounded-xl border p-8 text-center text-sm">
            No sources yet. Add an official feed or API to start staging news and releases for
            review.
          </p>
        ) : (
          <ul className="border-line divide-line divide-y rounded-xl border">
            {sources.map((s) => (
              <li key={s.id} className="space-y-3 px-4 py-4">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-fg text-sm font-medium">{s.name}</span>
                  <span className="text-muted font-mono text-xs">{s.kind}</span>
                  <span className="text-fg-2 font-mono text-xs">{s.schedule}</span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs ${s.enabled ? 'border-accent text-fg' : 'border-line text-muted'}`}
                  >
                    {s.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt className="text-muted">Last run</dt>
                    <dd className="text-fg-2 mt-0.5 flex flex-wrap items-center gap-2">
                      {s.lastRun ? (
                        <>
                          <RunStatus status={s.lastRun.status} />
                          <Link
                            href={`/admin/sync/runs/${s.lastRun.id}`}
                            className="hover:text-fg underline-offset-2 hover:underline"
                          >
                            {utc(s.lastRun.startedAt)}
                          </Link>
                        </>
                      ) : (
                        'Never'
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Next run</dt>
                    <dd className="text-fg-2 mt-0.5">
                      {s.enabled
                        ? s.nextRunAt
                          ? utc(s.nextRunAt)
                          : 'Manual only'
                        : 'Not scheduled'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Last 7 days</dt>
                    <dd className="text-fg-2 mt-0.5">
                      {s.recent.succeeded} succeeded · {s.recent.partial} partial ·{' '}
                      {s.recent.failed} failed
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Waiting for review</dt>
                    <dd className="text-fg-2 mt-0.5">{s.pendingImports}</dd>
                  </div>
                </dl>
                {s.lastRun?.error && (
                  <p className="text-danger text-xs break-words">Last error: {s.lastRun.error}</p>
                )}
                <SourceActions
                  id={s.id}
                  name={s.name}
                  enabled={s.enabled}
                  workerOnline={worker.online}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="runs">
        <h2 id="runs" className="t-h3 mb-3">
          Recent runs
        </h2>
        {runs.rows.length === 0 ? (
          <p className="text-fg-2 text-sm">No runs yet.</p>
        ) : (
          <ul className="border-line divide-line divide-y rounded-xl border">
            {runs.rows.slice(0, 10).map((r) => (
              <li key={r.id}>
                <Link
                  href={`/admin/sync/runs/${r.id}`}
                  className="hover:bg-elevated flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm transition-colors"
                >
                  <RunStatus status={r.status} />
                  <span className="text-fg">{r.source}</span>
                  <span className="text-muted font-mono text-xs">{utc(r.startedAt)}</span>
                  <span className="text-fg-2 text-xs">
                    {r.recordsSeen} seen · {r.imports} staged · {r.issues} issue
                    {r.issues === 1 ? '' : 's'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
