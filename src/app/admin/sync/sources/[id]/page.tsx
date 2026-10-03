import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SourceForm } from '@/components/admin/source-form';
import { ADAPTERS } from '../../../../../../server/adapters';
import { getSource } from '../../../../../../server/admin/sync-sources';
import { requireAdminPage } from '../../../../../../server/auth/current-user';
import { getPrisma } from '../../../../../../server/db/client';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Edit sync source' };

type Props = { params: Promise<{ id: string }> };

export default async function EditSourcePage({ params }: Props) {
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) notFound();
  await requireAdminPage(`/admin/sync/sources/${id}`);
  const source = await getSource(getPrisma(), id);
  if (!source) notFound();
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
        <h1 className="t-h2 mt-2">Edit sync source</h1>
        <p className="text-muted mt-1 text-xs">
          Run history of this source is listed on the data sync page.
        </p>
      </header>
      <SourceForm
        key={source.id}
        adapters={adapters}
        id={source.id}
        initial={{
          name: source.name,
          kind: source.kind,
          schedule: source.schedule,
          enabled: source.enabled,
          config: source.config,
        }}
      />
    </div>
  );
}
