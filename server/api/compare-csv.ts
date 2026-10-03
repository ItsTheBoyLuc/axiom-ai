import { latestBenchmarkResult } from '../../src/lib/models/benchmarks';
import { NOT_DISCLOSED } from '../../src/lib/verification';
import {
  deploymentLabel,
  modalityLabel,
  pricingKindLabel,
  type ModelDetail,
  type PricingType,
} from '../../src/types/model';
import { benchmarkText, priceLines } from '../../src/lib/compare/values';
import { toCsv } from './csv';

const orDisclosed = (v: string | number | boolean | null | undefined): string | number =>
  v === null || v === undefined || v === ''
    ? NOT_DISCLOSED
    : typeof v === 'boolean'
      ? v
        ? 'Yes'
        : 'No'
      : v;

/** Current price variants of one type, one per tier or deployment type, or undisclosed. */
const priceOf = (m: ModelDetail, type: PricingType): string => priceLines(m, type).join('; ');

/**
 * Rows for the comparison export: one column per model. Each benchmark is its own row (never
 * merged or averaged) and states its evaluation type and date. Missing data reads
 * "Not publicly disclosed" or "No verified data", never blank or zero.
 */
export function buildCompareRows(models: ModelDetail[]): (string | number)[][] {
  const row = (
    label: string,
    get: (m: ModelDetail) => string | number | boolean | null | undefined,
  ) => [label, ...models.map((m) => orDisclosed(get(m)))];

  const benchmarks = [
    ...new Map(
      models.flatMap((m) => m.benchmarks.map((b) => [b.benchmarkSlug, b.benchmarkName] as const)),
    ),
  ];

  return [
    ['Attribute', ...models.map((m) => m.name)],
    row('Provider', (m) => m.providerName),
    row('Family', (m) => m.family),
    row('Version', (m) => m.version),
    row('Release date', (m) => m.releaseDate),
    row('Availability', (m) => m.availability),
    row('Open weights', (m) => m.openWeights),
    row('Deployment', (m) => m.deployment.map((d) => deploymentLabel[d]).join('; ')),
    row('Context window (tokens)', (m) => m.contextWindow),
    row('Max output (tokens)', (m) => m.specs.maxOutputTokens),
    row('Input modalities', (m) => m.specs.inputModalities.map((x) => modalityLabel[x]).join('; ')),
    row('Output modalities', (m) =>
      m.specs.outputModalities.map((x) => modalityLabel[x]).join('; '),
    ),
    row('Tool calling', (m) => m.specs.toolCalling),
    row('Structured output', (m) => m.specs.structuredOutput),
    row('Function calling', (m) => m.specs.functionCalling),
    row('Streaming', (m) => m.specs.streaming),
    row('Knowledge cutoff', (m) => m.specs.knowledgeCutoff),
    row('Pricing model', (m) => pricingKindLabel[m.pricingKind]),
    row('Input price', (m) => priceOf(m, 'INPUT')),
    row('Output price', (m) => priceOf(m, 'OUTPUT')),
    row('Cached input price', (m) => priceOf(m, 'CACHED_INPUT')),
    ...benchmarks.map(([slug, name]) => [
      `Benchmark: ${name}`,
      ...models.map((m) => {
        const r = latestBenchmarkResult(m.benchmarks, slug);
        return r ? benchmarkText(r) : 'No verified data';
      }),
    ]),
    row('Verification status', (m) => m.verificationStatus.replaceAll('_', ' ').toLowerCase()),
    row('Demo data', (m) => m.isDemo),
  ];
}

export function compareCsv(models: ModelDetail[]): string {
  return toCsv(buildCompareRows(models));
}
