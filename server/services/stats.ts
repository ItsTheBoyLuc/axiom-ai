import { getModelRepository } from '../repositories/model-repository';
import { listProviders } from '../repositories/provider-repository';

export type PlatformStats = {
  totalModels: number;
  providers: number;
  releasedThisMonth: number;
  benchmarks: number;
  recentlyUpdated: number;
  /** True while values come from placeholder data; the UI must show a DEMO DATA badge. */
  isDemo: boolean;
  lastDataUpdate: string | null;
};

/** Platform statistics, derived through the repository layer (demo data until Phase 3). */
export async function getStats(now = new Date()): Promise<PlatformStats> {
  const [s, providers] = await Promise.all([getModelRepository().stats(now), listProviders()]);
  return {
    totalModels: s.total,
    providers: providers.length,
    releasedThisMonth: s.releasedThisMonth,
    benchmarks: s.benchmarks,
    recentlyUpdated: s.recentlyUpdated,
    isDemo: s.isDemo,
    lastDataUpdate: s.lastDataUpdate,
  };
}
