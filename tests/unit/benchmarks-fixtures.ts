import type { BenchmarkResultRow, BenchmarkSummary } from '@/types/catalog';

/** Builders for the benchmark explorer unit tests. */
export const row = (
  over: Partial<Omit<BenchmarkResultRow, 'model' | 'provider'>> & {
    model?: Partial<BenchmarkResultRow['model']>;
    provider?: Partial<BenchmarkResultRow['provider']>;
  } = {},
): BenchmarkResultRow => {
  const { model, provider, ...rest } = over;
  return {
    benchmarkSlug: 'bench-a',
    benchmarkName: 'Bench A',
    category: 'coding',
    benchmarkVersion: 'v1',
    score: 50,
    scoreUnit: '%',
    evaluationDate: '2026-09-01',
    modelVersion: 'm1',
    methodologyNotes: 'Reported by the provider.',
    evaluationType: 'PROVIDER_REPORTED',
    sourceUrl: 'https://example.invalid/source',
    isDemo: true,
    model: { slug: 'model-a', name: 'Model A', family: 'Family A', version: null, ...model },
    provider: { slug: 'prov-a', name: 'Provider A', ...provider },
    ...rest,
  };
};

export const summary = (over: Partial<BenchmarkSummary> = {}): BenchmarkSummary => ({
  slug: 'bench-a',
  name: 'Bench A',
  category: 'coding',
  version: '1.0',
  description: 'Solve coding tasks.',
  methodologyUrl: 'https://example.invalid/method',
  resultCount: 3,
  modelCount: 2,
  latestDate: '2026-09-22',
  byType: { INDEPENDENT: 0, PROVIDER_REPORTED: 3, COMMUNITY: 0 },
  units: ['%'],
  verificationStatus: 'PROVIDER_REPORTED',
  isDemo: false,
  ...over,
});

/** `n` rows, each a different model, with the given scores. */
export const rows = (scores: number[], over: Parameters<typeof row>[0] = {}) =>
  scores.map((score, i) =>
    row({
      score,
      model: { slug: `m${i}`, name: `M${i}`, family: `F${i % 3}` },
      provider: { slug: `p${i % 3}`, name: `P${i % 3}` },
      evaluationDate: `2026-0${(i % 8) + 1}-15`,
      ...over,
    }),
  );
