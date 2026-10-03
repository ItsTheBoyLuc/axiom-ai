import type { Metadata } from 'next';
import Link from 'next/link';
import { SourceForm } from '@/components/admin/source-form';
import { ADAPTERS } from '../../../../../../server/adapters';
import { requireAdminPage } from '../../../../../../server/auth/current-user';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'New sync source' };

export default async function NewSourcePage() {
  await requireAdminPage('/admin/sync/sources/new');
  const adapters = Object.values(ADAPTERS).map((a) => ({
    kind: a.kind,
    label: a.label,
    help: a.help,
    exampleConfig: a.exampleConfig,
  }));
  return (
    <div className="space-y-6">
      <header>
        <Link href="/admin/sync" className="text-fg-2 hover:text-fg text-sm hover:underline">
          ← Data sync
        </Link>
        <h1 className="t-h2 mt-2">New sync source</h1>
      </header>
      <SourceForm adapters={adapters} id={null} initial={null} />
    </div>
  );
}
