import { modalityLabel, type Modality, type ModelListItem } from '@/types/model';

/** Derived facts for a provider profile (modalities, API access, release span). Pure. */

export type ModalityCount = { modality: Modality; label: string; models: number };

/** Every modality any of the provider's models accepts or produces, with how many models do. */
export function modalitySummary(models: ModelListItem[]): ModalityCount[] {
  const counts = new Map<Modality, number>();
  for (const m of models)
    for (const mod of new Set(m.modalities)) counts.set(mod, (counts.get(mod) ?? 0) + 1);
  return [...counts]
    .map(([modality, n]) => ({ modality, label: modalityLabel[modality], models: n }))
    .sort((a, b) => b.models - a.models || a.label.localeCompare(b.label));
}

export type AvailabilityGroup = { availability: string; models: { slug: string; name: string }[] };

/** Models grouped by how they are accessed (Cloud API, Open weights, ...). */
export function availabilityGroups(models: ModelListItem[]): AvailabilityGroup[] {
  const map = new Map<string, { slug: string; name: string }[]>();
  for (const m of models) {
    map.set(m.availability, [...(map.get(m.availability) ?? []), { slug: m.slug, name: m.name }]);
  }
  return [...map]
    .map(([availability, ms]) => ({ availability, models: ms }))
    .sort(
      (a, b) => b.models.length - a.models.length || a.availability.localeCompare(b.availability),
    );
}

export type PortfolioFilter = {
  q: string;
  category: string;
  availability: string;
  openWeightsOnly: boolean;
};

export const emptyPortfolioFilter: PortfolioFilter = {
  q: '',
  category: '',
  availability: '',
  openWeightsOnly: false,
};

/** Client-side filter of the model portfolio on a provider profile. */
export function filterPortfolio(models: ModelListItem[], f: PortfolioFilter): ModelListItem[] {
  const tokens = f.q.toLowerCase().split(/\s+/).filter(Boolean);
  return models.filter((m) => {
    if (f.category && !m.categories.includes(f.category as ModelListItem['categories'][number])) {
      return false;
    }
    if (f.availability && m.availability !== f.availability) return false;
    if (f.openWeightsOnly && !m.openWeights) return false;
    if (tokens.length === 0) return true;
    const hay = `${m.name} ${m.family} ${m.version ?? ''} ${m.description}`.toLowerCase();
    return tokens.every((t) => hay.includes(t));
  });
}
