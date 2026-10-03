import Link from 'next/link';
import { ADMIN_ENTITIES, DEFINITIONS } from '../../../server/admin/definitions';
import { listAudit } from '../../../server/admin/audit-log';
import { recordCounts } from '../../../server/admin/overview';
import { requireAdminPage } from '../../../server/auth/current-user';
import { getPrisma } from '../../../server/db/client';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const user = await requireAdminPage('/admin');
  const db = getPrisma();
  const [counts, audit] = await Promise.all([recordCounts(db), listAudit(db, {})]);

  return (
    <div className="space-y-10">
      <header>
        <h1 className="t-h2">Admin</h1>
        <p className="text-fg-2 mt-2 text-sm">
          Signed in as <span className="text-fg font-mono">{user.email}</span>. Every change you
          make is validated like seed data and recorded in the audit log.
        </p>
      </header>

      <section aria-labelledby="counts">
        <h2 id="counts" className="t-h3 mb-3">
          Records
        </h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {ADMIN_ENTITIES.map((e) => (
            <li key={e}>
              <Link
                href={`/admin/${e}`}
                className="border-line bg-card hover:border-line-strong block rounded-xl border p-4 transition-colors"
              >
                <span className="text-fg-2 text-sm">{DEFINITIONS[e].label}</span>
                <span className="text-fg mt-1 block font-mono text-2xl">{counts[e]}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="recent">
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h2 id="recent" className="t-h3">
            Recent changes
          </h2>
          <Link href="/admin/audit" className="text-accent text-sm hover:underline">
            Full audit log
          </Link>
        </div>
        {audit.rows.length === 0 ? (
          <p className="text-fg-2 text-sm">Nothing has been changed through the admin yet.</p>
        ) : (
          <ul className="border-line divide-line divide-y rounded-xl border">
            {audit.rows.slice(0, 8).map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 text-sm"
              >
                <time dateTime={r.createdAt} className="text-muted font-mono text-xs">
                  {r.createdAt.slice(0, 16).replace('T', ' ')} UTC
                </time>
                <span className="text-fg font-mono">{r.action}</span>
                <span className="text-fg-2">{r.actor ?? 'system'}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
