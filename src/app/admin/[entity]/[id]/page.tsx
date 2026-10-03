import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RecordForm } from '@/components/admin/record-form';
import { ENTITY_FIELDS } from '@/lib/admin/fields';
import { DEFINITIONS, isAdminEntity } from '../../../../../server/admin/definitions';
import { loadRefs } from '../../../../../server/admin/overview';
import { getRecord } from '../../../../../server/admin/records';
import { requireAdminPage } from '../../../../../server/auth/current-user';
import { getPrisma } from '../../../../../server/db/client';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ entity: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = { title: 'Edit record' };

export default async function EditRecordPage({ params, searchParams }: Props) {
  const { entity, id } = await params;
  if (!isAdminEntity(entity) || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) notFound();
  await requireAdminPage(`/admin/${entity}/${id}`);
  const db = getPrisma();
  const record = await getRecord(db, entity, id);
  if (!record) notFound();
  const def = DEFINITIONS[entity];
  const sp = await searchParams;

  return (
    <div className="space-y-6">
      <header>
        <Link href={`/admin/${entity}`} className="text-fg-2 hover:text-fg text-sm hover:underline">
          ← {def.label}
        </Link>
        <h1 className="t-h2 mt-2">Edit {def.singular}</h1>
        <p className="text-muted mt-1 font-mono text-xs break-all">{def.keyOf(record)}</p>
      </header>
      <RecordForm
        key={id}
        entity={entity}
        singular={def.singular}
        fields={ENTITY_FIELDS[entity]!}
        refs={await loadRefs(db)}
        id={id}
        record={record}
        justCreated={Boolean(sp.created)}
      />
    </div>
  );
}
