import type { Metadata } from 'next';
import Link from 'next/link';
import { UserActions } from '@/components/admin/user-actions';
import { Pager } from '@/components/ui/pager';
import { listUsers } from '../../../../server/admin/users';
import { requireAdminPage } from '../../../../server/auth/current-user';
import { getPrisma } from '../../../../server/db/client';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Users' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AdminUsersPage({ searchParams }: Props) {
  const me = await requireAdminPage('/admin/users');
  const sp = await searchParams;
  const q = (first(sp.q) ?? '').slice(0, 100);
  const pageNo = Math.max(1, Number.parseInt(first(sp.page) ?? '1', 10) || 1);
  const data = await listUsers(getPrisma(), { q, page: pageNo });
  const pageCount = Math.max(1, Math.ceil(data.total / data.pageSize));
  const hrefFor = (p: number) => {
    const u = new URLSearchParams();
    if (q) u.set('q', q);
    if (p > 1) u.set('page', String(p));
    return `/admin/users${u.size ? `?${u}` : ''}`;
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="t-h2">Users</h1>
        <p className="text-fg-2 mt-1 text-sm">
          {data.total} account{data.total === 1 ? '' : 's'}. New administrators are created with{' '}
          <code className="font-mono">npm run admin:create</code>; sign-up arrives with the account
          features. You cannot change or delete your own account here, and the last administrator is
          protected.
        </p>
      </header>

      <form method="get" role="search" className="flex gap-2">
        <label htmlFor="user-q" className="sr-only">
          Search users
        </label>
        <input
          id="user-q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Search by email or name…"
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
            href="/admin/users"
            className="text-fg-2 hover:text-fg inline-flex h-10 items-center px-2 text-sm"
          >
            Clear
          </Link>
        )}
      </form>

      {data.rows.length === 0 ? (
        <p className="border-line text-fg-2 rounded-xl border p-8 text-center text-sm">
          No users match your search.
        </p>
      ) : (
        <ul className="border-line divide-line divide-y rounded-xl border">
          {data.rows.map((u) => (
            <li key={u.id} className="space-y-3 px-4 py-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-fg text-sm font-medium break-all">{u.email}</span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs ${u.role === 'ADMIN' ? 'border-accent text-fg' : 'border-line text-fg-2'}`}
                >
                  {u.role === 'ADMIN' ? 'Administrator' : 'User'}
                </span>
                {u.id === me.id && <span className="text-muted text-xs">(you)</span>}
              </div>
              <p className="text-fg-2 text-xs">
                Created <time dateTime={u.createdAt}>{u.createdAt.slice(0, 10)}</time> ·{' '}
                {u.activeSessions} active session{u.activeSessions === 1 ? '' : 's'} ·{' '}
                {u.hasPassword ? 'password set' : 'no password'}
              </p>
              <UserActions id={u.id} email={u.email} role={u.role} isSelf={u.id === me.id} />
            </li>
          ))}
        </ul>
      )}
      <Pager page={data.page} pageCount={pageCount} hrefFor={hrefFor} />
    </div>
  );
}
