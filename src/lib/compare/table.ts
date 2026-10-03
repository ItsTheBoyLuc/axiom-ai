import { formatDate, formatTokens } from '@/lib/format';
import { latestBenchmarkResult } from '@/lib/models/benchmarks';
import { NOT_DISCLOSED, verificationLabel } from '@/lib/verification';
import { benchmarkCategoryLabel, type BenchmarkCategoryKey } from '@/types/catalog';
import {
  deploymentLabel,
  modalityLabel,
  pricingKindLabel,
  type ModelDetail,
  type PricingType,
} from '@/types/model';
import { evaluationTypeLabel, hasPriceOfType, priceLines, yesNo } from './values';

/**
 * The comparison table as plain data (docs/PROMPT.md 7.5): groups of rows, one cell per model,
 * plus a `differs` flag per row for the "highlight differences" toggle. Pure, so the layout
 * logic is unit tested without React. Benchmarks are one row each and are never merged.
 */

export type CompareCell = {
  /** Main value lines. */
  lines: string[];
  /** Secondary small lines (evaluation type and date, model version, units). */
  sub: string[];
  /** External source link for this value, when there is one. */
  href: string | null;
  /** Visible text of that link ("Source" for data, "Documentation" for the docs row). */
  hrefLabel: string;
  /** False when the value is missing ("Not publicly disclosed" / "No verified data"). */
  disclosed: boolean;
  /** Equality key used for the `differs` flag. */
  key: string;
};

export type CompareRow = {
  id: string;
  label: string;
  /** Small explanatory line under the label (e.g. "Scored separately, not blended"). */
  hint: string | null;
  /** Sub-heading the row belongs to inside its group (benchmark category). */
  section: string | null;
  /** Set when the models' results were produced under different conditions. */
  caveat: string | null;
  cells: CompareCell[];
  /** True when the models do not all show the same value. */
  differs: boolean;
};

export type CompareGroup = { id: string; title: string; rows: CompareRow[] };

const plain = (
  text: string,
  key = text,
  sub: string[] = [],
  href: string | null = null,
  hrefLabel = 'Source',
): CompareCell => ({
  lines: [text],
  sub,
  href,
  hrefLabel,
  disclosed: text !== NOT_DISCLOSED,
  key,
});

const missing = (text = NOT_DISCLOSED): CompareCell => ({
  lines: [text],
  sub: [],
  href: null,
  hrefLabel: 'Source',
  disclosed: false,
  key: '\u0000missing',
});

const textOrMissing = (v: string | null | undefined): CompareCell =>
  v === null || v === undefined || v === '' ? missing() : plain(v);

const list = (items: string[]): CompareCell => (items.length ? plain(items.join(', ')) : missing());

function row(
  id: string,
  label: string,
  models: ModelDetail[],
  cell: (m: ModelDetail) => CompareCell,
  extra: Partial<Pick<CompareRow, 'hint' | 'section' | 'caveat'>> = {},
): CompareRow {
  const cells = models.map(cell);
  return {
    id,
    label,
    hint: extra.hint ?? null,
    section: extra.section ?? null,
    caveat: extra.caveat ?? null,
    cells,
    differs: new Set(cells.map((c) => c.key)).size > 1,
  };
}

/** Readable host of a URL for link rows; falls back to the URL itself. */
const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

const categoryText = (key: string): string =>
  key in benchmarkCategoryLabel
    ? benchmarkCategoryLabel[key as BenchmarkCategoryKey]
    : key.charAt(0).toUpperCase() + key.slice(1).replaceAll('-', ' ');

/** Price rows beyond input/output/cached input appear only when a selected model lists them. */
const EXTRA_PRICE_ROWS: { type: PricingType; label: string }[] = [
  { type: 'BATCH_INPUT', label: 'Batch input price' },
  { type: 'BATCH_OUTPUT', label: 'Batch output price' },
  { type: 'IMAGE', label: 'Image price' },
  { type: 'AUDIO', label: 'Audio price' },
  { type: 'OTHER', label: 'Other prices' },
];

const priceCell = (m: ModelDetail, type: PricingType): CompareCell => {
  const lines = priceLines(m, type);
  return lines[0] === NOT_DISCLOSED
    ? missing()
    : { lines, sub: [], href: null, hrefLabel: 'Source', disclosed: true, key: lines.join('|') };
};

/** Why a benchmark row may not be a like-for-like comparison, or null when it is. */
export function benchmarkCaveat(
  results: ReturnType<typeof latestBenchmarkResult>[],
): string | null {
  const have = results.filter((r): r is NonNullable<typeof r> => r !== null);
  if (have.length < 2) return null;
  const same = (pick: (r: (typeof have)[number]) => string | null) =>
    new Set(have.map((r) => pick(r) ?? '')).size === 1;
  const reasons: string[] = [];
  if (!same((r) => r.evaluationType)) reasons.push('evaluation types');
  if (!same((r) => r.benchmarkVersion)) reasons.push('benchmark versions');
  if (!same((r) => r.scoreUnit)) reasons.push('score units');
  return reasons.length
    ? `The ${reasons.join(' and ')} differ between models, so these scores are not directly comparable.`
    : null;
}

/** Builds every table group for the selected models (order = the order given). */
export function buildCompareTable(models: ModelDetail[]): CompareGroup[] {
  const groups: CompareGroup[] = [];

  groups.push({
    id: 'general',
    title: 'General',
    rows: [
      row('provider', 'Provider', models, (m) => plain(m.providerName)),
      row('family', 'Family', models, (m) => plain(m.family)),
      row('version', 'Version', models, (m) => textOrMissing(m.version)),
      row('release-date', 'Release date', models, (m) =>
        plain(formatDate(m.releaseDate), m.releaseDate),
      ),
      row('availability', 'Availability', models, (m) => plain(m.availability)),
      row('open-weights', 'Open weights', models, (m) => plain(yesNo(m.openWeights))),
      row('verification', 'Verification status', models, (m) =>
        plain(verificationLabel[m.verificationStatus]),
      ),
      ...(models.some((m) => m.isDemo)
        ? [row('demo', 'Demo data', models, (m) => plain(m.isDemo ? 'Yes (DEMO DATA)' : 'No'))]
        : []),
    ],
  });

  groups.push({
    id: 'technical',
    title: 'Technical',
    rows: [
      row('context', 'Context window', models, (m) =>
        m.contextWindow === null
          ? missing()
          : plain(`${formatTokens(m.contextWindow)} tokens`, String(m.contextWindow)),
      ),
      row('max-output', 'Max output', models, (m) =>
        m.specs.maxOutputTokens === null
          ? missing()
          : plain(
              `${formatTokens(m.specs.maxOutputTokens)} tokens`,
              String(m.specs.maxOutputTokens),
            ),
      ),
      row('input-modalities', 'Input modalities', models, (m) =>
        list(m.specs.inputModalities.map((x) => modalityLabel[x])),
      ),
      row('output-modalities', 'Output modalities', models, (m) =>
        list(m.specs.outputModalities.map((x) => modalityLabel[x])),
      ),
      row('tool-calling', 'Tool calling', models, (m) => plain(yesNo(m.specs.toolCalling))),
      row('structured-output', 'Structured output', models, (m) =>
        plain(yesNo(m.specs.structuredOutput)),
      ),
      row('function-calling', 'Function calling', models, (m) =>
        plain(yesNo(m.specs.functionCalling)),
      ),
      row('streaming', 'Streaming', models, (m) => plain(yesNo(m.specs.streaming))),
      row('knowledge-cutoff', 'Knowledge cutoff', models, (m) =>
        textOrMissing(m.specs.knowledgeCutoff),
      ),
    ],
  });

  // Performance: one row per benchmark that at least one selected model has a result for.
  const benchmarks = new Map<string, { name: string; category: string }>();
  for (const m of models) {
    for (const b of m.benchmarks) {
      if (!benchmarks.has(b.benchmarkSlug)) {
        benchmarks.set(b.benchmarkSlug, { name: b.benchmarkName, category: b.category });
      }
    }
  }
  const perfRows = [...benchmarks]
    .sort(
      ([, a], [, b]) =>
        categoryText(a.category).localeCompare(categoryText(b.category)) ||
        a.name.localeCompare(b.name),
    )
    .map(([slug, b]) => {
      const results = models.map((m) => latestBenchmarkResult(m.benchmarks, slug));
      return row(
        `benchmark-${slug}`,
        b.name,
        models,
        (m) => {
          const r = results[models.indexOf(m)];
          if (!r) return missing('No verified data');
          return {
            lines: [`${r.score}${r.scoreUnit}`],
            sub: [
              `${evaluationTypeLabel[r.evaluationType]} · ${formatDate(r.evaluationDate)}`,
              `Model ${r.modelVersion}${r.benchmarkVersion ? ` · benchmark ${r.benchmarkVersion}` : ''}`,
            ],
            href: r.sourceUrl,
            hrefLabel: 'Source',
            disclosed: true,
            key: `${r.score}${r.scoreUnit}`,
          };
        },
        {
          hint: 'Scored separately, never blended',
          section: categoryText(b.category),
          caveat: benchmarkCaveat(results),
        },
      );
    });
  groups.push({ id: 'performance', title: 'Performance', rows: perfRows });

  groups.push({
    id: 'pricing',
    title: 'Pricing',
    rows: [
      row('pricing-model', 'Pricing model', models, (m) => plain(pricingKindLabel[m.pricingKind])),
      row('price-input', 'Input price', models, (m) => priceCell(m, 'INPUT')),
      row('price-output', 'Output price', models, (m) => priceCell(m, 'OUTPUT')),
      row('price-cached', 'Cached input price', models, (m) => priceCell(m, 'CACHED_INPUT')),
      ...EXTRA_PRICE_ROWS.filter((e) => models.some((m) => hasPriceOfType(m, e.type))).map((e) =>
        row(`price-${e.type.toLowerCase()}`, e.label, models, (m) => priceCell(m, e.type)),
      ),
    ],
  });

  groups.push({
    id: 'availability',
    title: 'Availability',
    rows: [
      row('deployment', 'Deployment options', models, (m) =>
        list(m.deployment.map((d) => deploymentLabel[d])),
      ),
      row('api', 'API availability', models, (m) => textOrMissing(m.specs.apiAvailability)),
      row('docs', 'Documentation', models, (m) =>
        m.documentationUrl
          ? plain(
              hostOf(m.documentationUrl),
              m.documentationUrl,
              [],
              m.documentationUrl,
              'Documentation',
            )
          : missing(),
      ),
    ],
  });

  return groups;
}
