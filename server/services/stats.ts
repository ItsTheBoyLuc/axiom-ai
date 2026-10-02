import { getRepositories, type Repositories } from '../repositories';

export type PlatformStats = {
  totalModels: number;
  providers: number;
  releasedThisMonth: number;
  benchmarks: number;
  recentlyUpdated: number;
  /** True while the database holds placeholder rows; the UI must show a DEMO DATA badge. */
  isDemo: boolean;
  lastDataUpdate: string | null;
};

/** Platform statistics from the database, via the repository layer. */
export async function getStats(
  repos: Pick<Repositories, 'models' | 'providers'> = getRepositories(),
  now = new Date(),
): Promise<PlatformStats> {
  const [s, providers] = await Promise.all([repos.models.stats(now), repos.providers.listAll()]);
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
