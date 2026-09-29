import type { ModelDetail, ModelListItem } from '../../../src/types/model';
import type { ModelRepository } from '../model-repository';
import { listModels, relatedModels, suggestModels } from '../model-query';
import { demoBenchmarks, demoModelDetails } from './models';

/** Strips a detail record down to what list cards need (keeps payloads to clients small). */
export function toListItem(d: ModelDetail): ModelListItem {
  return {
    slug: d.slug,
    name: d.name,
    family: d.family,
    version: d.version,
    description: d.description,
    providerSlug: d.providerSlug,
    providerName: d.providerName,
    providerMonogram: d.providerMonogram,
    providerTier: d.providerTier,
    releaseDate: d.releaseDate,
    updatedAt: d.updatedAt,
    contextWindow: d.contextWindow,
    modalities: d.modalities,
    availability: d.availability,
    openWeights: d.openWeights,
    deployment: d.deployment,
    pricingKind: d.pricingKind,
    currentPricing: d.currentPricing,
    categories: d.categories,
    capabilities: d.capabilities,
    benchmarks: d.benchmarks,
    verificationStatus: d.verificationStatus,
    isDemo: d.isDemo,
  };
}

const all = demoModelDetails.map(toListItem);
const daysAgo = (from: Date, iso: string) =>
  (from.getTime() - new Date(iso).getTime()) / 86_400_000;

/** In-memory implementation over the fictional demo dataset. */
export const demoModelRepository: ModelRepository = {
  async list(query) {
    return listModels(all, query);
  },
  async getBySlug(slug) {
    return demoModelDetails.find((m) => m.slug === slug) ?? null;
  },
  async suggest(q, limit = 6) {
    return suggestModels(all, q, limit);
  },
  async related(slug, limit = 3) {
    return relatedModels(all, slug, limit);
  },
  async benchmarks() {
    return demoBenchmarks;
  },
  async slugs() {
    return all.map((m) => m.slug);
  },
  async featured(limit) {
    return [...all].sort((a, b) => b.releaseDate.localeCompare(a.releaseDate)).slice(0, limit);
  },
  async stats(now = new Date()) {
    const month = now.toISOString().slice(0, 7);
    return {
      total: all.length,
      releasedThisMonth: all.filter((m) => m.releaseDate.startsWith(month)).length,
      recentlyUpdated: all.filter(
        (m) => daysAgo(now, m.updatedAt) <= 30 && daysAgo(now, m.updatedAt) >= 0,
      ).length,
      benchmarks: demoBenchmarks.length,
      isDemo: true,
      lastDataUpdate: null, // no database yet: footer shows "No data loaded yet"
    };
  },
};
