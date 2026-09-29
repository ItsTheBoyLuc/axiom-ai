import type { BenchmarkResult } from '@/types/model';

/**
 * Latest result of ONE benchmark for a model (by evaluation date; ties keep the first).
 * Different benchmarks are never combined, so there is no overall score anywhere.
 */
export function latestBenchmarkResult(
  results: BenchmarkResult[],
  benchmarkSlug: string,
): BenchmarkResult | null {
  let best: BenchmarkResult | null = null;
  for (const r of results) {
    if (r.benchmarkSlug !== benchmarkSlug) continue;
    if (!best || r.evaluationDate > best.evaluationDate) best = r;
  }
  return best;
}
