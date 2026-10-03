import type { Metadata } from 'next';
import { SignOutButton } from '@/components/admin/sign-out-button';
import { AdminNav } from '@/components/admin/admin-nav';
import { Container } from '@/components/ui/section';
import { ADMIN_ENTITIES, DEFINITIONS } from '../../../server/admin/definitions';
import { requireAdminPage } from '../../../server/auth/current-user';

// Per-request and per-user: never prerendered, never indexed.
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s · Admin · AXIOM AI' },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // The layout does not re-render on client navigation, so every page below checks again.
  const user = await requireAdminPage('/admin');
  const groups = [
    { title: 'Overview', items: [{ href: '/admin', label: 'Dashboard' }] },
    {
      title: 'Data',
      items: ADMIN_ENTITIES.map((e) => ({ href: `/admin/${e}`, label: DEFINITIONS[e].label })),
    },
    {
      title: 'System',
      items: [
        { href: '/admin/users', label: 'Users' },
        { href: '/admin/audit', label: 'Audit log' },
      ],
    },
  ];
  return (
    <Container className="py-8 sm:py-12">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <AdminNav groups={groups} />
          <SignOutButton email={user.email} />
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </Container>
  );
}
