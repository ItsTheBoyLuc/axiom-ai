import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RecordForm } from '@/components/admin/record-form';
import { ENTITY_FIELDS } from '@/lib/admin/fields';
import { DEFINITIONS, isAdminEntity } from '../../../../../server/admin/definitions';
import { loadRefs } from '../../../../../server/admin/overview';
import { requireAdminPage } from '../../../../../server/auth/current-user';
import { getPrisma } from '../../../../../server/db/client';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ entity: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { entity } = await params;
  return { title: isAdminEntity(entity) ? `New ${DEFINITIONS[entity].singular}` : 'Admin' };
}

export default async function NewRecordPage({ params }: Props) {
  const { entity } = await params;
  if (!isAdminEntity(entity)) notFound();
  await requireAdminPage(`/admin/${entity}/new`);
  const def = DEFINITIONS[entity];
  return (
    <div className="space-y-6">
      <header>
        <Link href={`/admin/${entity}`} className="text-fg-2 hover:text-fg text-sm hover:underline">
          ← {def.label}
        </Link>
        <h1 className="t-h2 mt-2">New {def.singular}</h1>
      </header>
      <RecordForm
        entity={entity}
        singular={def.singular}
        fields={ENTITY_FIELDS[entity]!}
        refs={await loadRefs(getPrisma())}
        id={null}
        record={null}
      />
    </div>
  );
}
