import type { BenchmarkResult } from '@/types/model';
import { EVALUATION_TRUST } from './ordering';

/** Minimal shape needed to pick a "latest" result (lets SQL rows reuse this rule). */
export type ResultLike = Pick<BenchmarkResult, 'evaluationDate' | 'evaluationType'>;

/**
 * The single result that represents a model on one benchmark: newest evaluation date wins;
 * on the same date the more trusted evaluation type wins (independent > provider-reported >
 * community); any remaining tie keeps the first. Different benchmarks are never combined, so
 * there is no overall score anywhere.
 */
export function pickLatest<T extends ResultLike>(results: T[]): T | null {
  let best: T | null = null;
  for (const r of results) {
    if (
      !best ||
      r.evaluationDate > best.evaluationDate ||
      (r.evaluationDate === best.evaluationDate &&
        EVALUATION_TRUST[r.evaluationType] > EVALUATION_TRUST[best.evaluationType])
    ) {
      best = r;
    }
  }
  return best;
}

export function latestBenchmarkResult(
  results: BenchmarkResult[],
  benchmarkSlug: string,
): BenchmarkResult | null {
  return pickLatest(results.filter((r) => r.benchmarkSlug === benchmarkSlug));
}
