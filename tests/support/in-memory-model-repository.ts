import { demoBenchmarks, demoModelDetails } from '../../prisma/seed/demo/models';
import {
  listModels,
  relatedModels,
  suggestModels,
  byName,
} from '../../server/repositories/model-query';
import type { ModelRepository } from '../../server/repositories/model-repository';
import type { ModelDetail, ModelListItem } from '../../src/types/model';

/** Strips a detail record down to what list cards need. */
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

const daysAgo = (from: Date, iso: string) =>
  (from.getTime() - new Date(iso).getTime()) / 86_400_000;

/**
 * TEST-ONLY reference implementation of ModelRepository over the in-memory fixtures.
 * Production code never imports it (the app reads the database); integration tests compare the
 * Prisma repository against it to prove filters, sorting and pagination behave identically.
 */
export function createInMemoryModelRepository(
  details: ModelDetail[] = demoModelDetails,
): ModelRepository {
  const all = details.map(toListItem);
  return {
    async list(query) {
      return listModels(all, query);
    },
    async getBySlug(slug) {
      return details.find((m) => m.slug === slug) ?? null;
    },
    async getManyBySlugs(slugs) {
      return slugs.flatMap((s) => {
        const d = details.find((m) => m.slug === s);
        return d ? [d] : [];
      });
    },
    async suggest(q, limit = 6) {
      return suggestModels(all, q, limit);
    },
    async related(slug, limit = 3) {
      return relatedModels(all, slug, limit);
    },
    async benchmarks() {
      return [...demoBenchmarks].sort(byName);
    },
    async slugs() {
      return all.map((m) => m.slug).sort();
    },
    async featured(limit) {
      return [...all]
        .sort((a, b) => b.releaseDate.localeCompare(a.releaseDate) || byName(a, b))
        .slice(0, limit);
    },
    async stats(now = new Date()) {
      const month = now.toISOString().slice(0, 7);
      return {
        total: all.length,
        releasedThisMonth: all.filter((m) => m.releaseDate.startsWith(month)).length,
        recentlyUpdated: all.filter((m) => {
          const d = daysAgo(now, m.updatedAt);
          return d <= 30 && d >= 0;
        }).length,
        benchmarks: demoBenchmarks.length,
        isDemo: true,
        lastDataUpdate: null,
      };
    },
  };
}
