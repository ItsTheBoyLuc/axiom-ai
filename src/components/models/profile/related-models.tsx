import { ModelCard } from '@/components/models/model-card';
import type { ModelListItem } from '@/types/model';
import { ProfileSection } from './profile-section';

/** Models from the same provider or with similar categories and capabilities. */
export function RelatedModels({ models, demo }: { models: ModelListItem[]; demo: boolean }) {
  return (
    <ProfileSection id="related" title="Related models" demo={demo}>
      {models.length === 0 ? (
        <p className="text-fg-2 text-sm">No related models yet.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {models.map((m) => (
            <li key={m.slug}>
              <ModelCard model={m} />
            </li>
          ))}
        </ul>
      )}
    </ProfileSection>
  );
}
