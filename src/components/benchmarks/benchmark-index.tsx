import Link from 'next/link';
import { DemoBadge, EvaluationBadge } from '@/components/ui/badges';
import { formatDate } from '@/lib/format';
import { explorerHref } from '@/lib/benchmarks/query';
import {
  BENCHMARK_CATEGORIES,
  benchmarkCategoryLabel,
  type BenchmarkCategoryKey,
  type BenchmarkSummary,
} from '@/types/catalog';
import type { EvaluationType } from '@/types/model';

const TYPES: EvaluationType[] = ['INDEPENDENT', 'PROVIDER_REPORTED', 'COMMUNITY'];

function BenchmarkCard({
  b,
  category,
}: {
  b: BenchmarkSummary;
  category: BenchmarkCategoryKey | null;
}) {
  return (
    <li className="h-full">
      <Link
        href={explorerHref({ category, benchmark: b.slug })}
        className="border-line bg-card hover:border-line-strong flex h-full flex-col rounded-2xl border p-5 transition-colors"
      >
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-fg text-base font-medium">{b.name}</span>
          {b.version && <span className="text-muted font-mono text-xs">v{b.version}</span>}
          {b.isDemo && <DemoBadge />}
        </span>
        <span className="text-fg-2 mt-2 line-clamp-2 flex-1 text-sm">{b.description}</span>
        <span className="text-muted mt-4 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs">
          <span>
            {b.resultCount} {b.resultCount === 1 ? 'result' : 'results'}
          </span>
          <span>
            {b.modelCount} {b.modelCount === 1 ? 'model' : 'models'}
          </span>
          {b.units.length > 0 && <span>{b.units.join(', ')}</span>}
          {b.latestDate && <span>{formatDate(b.latestDate)}</span>}
        </span>
        <span className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5">
          {TYPES.filter((t) => b.byType[t] > 0).map((t) => (
            <span key={t} className="inline-flex items-center gap-1">
              <EvaluationBadge type={t} />
              <span className="text-muted font-mono text-xs">&times;{b.byType[t]}</span>
            </span>
          ))}
          {b.resultCount === 0 && <span className="text-muted text-xs">No results yet</span>}
        </span>
      </Link>
    </li>
  );
}

const grid = 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3';

/**
 * The benchmark index. With a category chosen it is one grid; without, benchmarks are grouped
 * under their category headings. Each card links to that benchmark's detail view.
 */
export function BenchmarkIndex({
  summaries,
  category,
}: {
  summaries: BenchmarkSummary[];
  category: BenchmarkCategoryKey | null;
}) {
  const shown = category ? summaries.filter((s) => s.category === category) : summaries;
  if (shown.length === 0) {
    return (
      <p className="border-line-strong text-fg-2 rounded-2xl border border-dashed p-8 text-center text-sm">
        No benchmarks in this category yet.
      </p>
    );
  }
  if (category) {
    return (
      <ul className={grid}>
        {shown.map((b) => (
          <BenchmarkCard key={b.slug} b={b} category={category} />
        ))}
      </ul>
    );
  }
  const groups = BENCHMARK_CATEGORIES.map((c) => ({
    key: c,
    items: shown.filter((s) => s.category === c),
  })).filter((g) => g.items.length > 0);
  // Anything outside the controlled vocabulary still shows up, under "Other".
  const known = new Set<string>(BENCHMARK_CATEGORIES);
  const other = shown.filter((s) => !known.has(s.category));

  return (
    <div className="space-y-10">
      {groups.map((g) => (
        <section key={g.key} aria-labelledby={`cat-${g.key}`}>
          <h2 id={`cat-${g.key}`} className="t-h3 mb-4">
            {benchmarkCategoryLabel[g.key]}
          </h2>
          <ul className={grid}>
            {g.items.map((b) => (
              <BenchmarkCard key={b.slug} b={b} category={null} />
            ))}
          </ul>
        </section>
      ))}
      {other.length > 0 && (
        <section aria-labelledby="cat-other">
          <h2 id="cat-other" className="t-h3 mb-4">
            Other
          </h2>
          <ul className={grid}>
            {other.map((b) => (
              <BenchmarkCard key={b.slug} b={b} category={null} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
