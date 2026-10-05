import type { BackgroundSeed } from '../../src/components/cinematic/background';
import { getRepositories } from '../repositories';

/**
 * What the cinematic background needs to know: every provider and the models of those providers
 * (a dense network reads as a network). Two small queries through the repository layer; the
 * models are capped so the canvas stays cheap.
 */
export async function getCinematicSeed(
  maxModels = 48,
): Promise<BackgroundSeed & { isDemo: boolean }> {
  const repos = getRepositories();
  const [models, providers] = await Promise.all([
    repos.models.featured(maxModels),
    repos.providers.listAll(),
  ]);
  return {
    providers: providers
      .filter((p) => models.some((m) => m.providerSlug === p.slug))
      .map((p) => ({ slug: p.slug, name: p.name })),
    models: models.map((m) => ({ slug: m.slug, name: m.name, providerSlug: m.providerSlug })),
    isDemo: models.some((m) => m.isDemo),
  };
}
