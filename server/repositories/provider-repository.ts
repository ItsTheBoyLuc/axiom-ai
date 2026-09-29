import { demoProviders, type DemoProvider } from '../../src/lib/demo-data';
import { getModelRepository } from './model-repository';

export type ProviderSummary = DemoProvider & { modelCount: number };

/** Providers with their model counts. Phase 3 swaps the source for Prisma. */
export async function listProviders(): Promise<ProviderSummary[]> {
  const { items } = await getModelRepository().list({
    q: '',
    provider: [],
    category: [],
    capability: [],
    deployment: [],
    pricing: [],
    sort: 'alpha',
    benchmark: null,
    page: 1,
    pageSize: 1000,
  });
  return demoProviders.map((p) => ({
    ...p,
    modelCount: items.filter((m) => m.providerSlug === p.slug).length,
  }));
}
