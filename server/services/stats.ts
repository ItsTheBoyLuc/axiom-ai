import { demoModels, demoProviders } from '../../src/lib/demo-data';

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

/**
 * Platform statistics. Phase 1 derives them from demo data; Phase 3 replaces this with
 * database queries behind the same signature.
 */
export function getStats(): PlatformStats {
  const benchmarkNames = new Set(demoModels.flatMap((m) => m.benchmarks.map((b) => b.name)));
  return {
    totalModels: demoModels.length,
    providers: demoProviders.length,
    releasedThisMonth: 1, // demo placeholder
    benchmarks: benchmarkNames.size,
    recentlyUpdated: 3, // demo placeholder
    isDemo: true,
    lastDataUpdate: null, // no database yet: footer shows "No data loaded yet"
  };
}
