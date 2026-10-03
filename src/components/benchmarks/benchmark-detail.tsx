import Link from 'next/link';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { DemoBadge, EvaluationBadge } from '@/components/ui/badges';
import { facetsOf, filterRows, typeMix } from '@/lib/benchmarks/analysis';
import { explorerHref, hasFilters, type ExplorerQuery } from '@/lib/benchmarks/query';
import { formatDate } from '@/lib/format';
import {
  benchmarkCategoryLabel,
  type BenchmarkCategoryKey,
  type BenchmarkResultRow,
  type BenchmarkSummary,
} from '@/types/catalog';
import type { EvaluationType } from '@/types/model';
import { DetailCharts } from './detail-charts';
import { ExplorerFilters } from './filters';
import { ResultsTable } from './results-table';

const TYPES: EvaluationType[] = ['INDEPENDENT', 'PROVIDER_REPORTED', 'COMMUNITY'];

/**
 * One benchmark: what it measures and where its methodology is documented, a filter bar, four
 * views of the results and the full results table. Every result keeps its own evaluation type,
 * date, model version, benchmark version, methodology note and source.
 */
export function BenchmarkDetail({
  summary,
  rows,
  query,
  truncated,
}: {
  summary: BenchmarkSummary;
  rows: BenchmarkResultRow[];
  query: ExplorerQuery;
  truncated: boolean;
}) {
  const facets = facetsOf(rows);
  const filtered = filterRows(rows, query);
  const mix = typeMix(filtered);
  const category =
    summary.category in benchmarkCategoryLabel
      ? benchmarkCategoryLabel[summary.category as BenchmarkCategoryKey]
      : summary.category;
  const onlyProviderReported = filtered.length > 0 && mix.INDEPENDENT === 0 && mix.COMMUNITY === 0;

  return (
    <div>
      <Link
        href={explorerHref({ category: query.category })}
        className="text-fg-2 hover:text-fg mb-5 inline-flex items-center gap-1.5 text-sm hover:underline"
      >
        <ArrowLeft size={14} aria-hidden /> All benchmarks
      </Link>

      <header className="border-line bg-card mb-6 rounded-2xl border p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="t-h2">{summary.name}</h2>
          {summary.version && (
            <span className="text-muted font-mono text-sm">v{summary.version}</span>
          )}
          {summary.isDemo && <DemoBadge />}
        </div>
        <p className="text-muted mt-1 text-sm">
          {category}
          {summary.units.length > 0 && <> &middot; scored in {summary.units.join(', ')}</>}
        </p>
        <p className="text-fg-2 mt-3 max-w-3xl text-sm">{summary.description}</p>
        <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          {summary.methodologyUrl ? (
            <a
              href={summary.methodologyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent inline-flex items-center gap-1 hover:underline"
            >
              Methodology <ArrowUpRight size={13} aria-hidden />
            </a>
          ) : (
            <span className="text-fg-2">Methodology: Not publicly disclosed</span>
          )}
          <span className="text-muted">
            {summary.resultCount} {summary.resultCount === 1 ? 'result' : 'results'} from{' '}
            {summary.modelCount} {summary.modelCount === 1 ? 'model' : 'models'}
            {summary.latestDate && <>, latest evaluated {formatDate(summary.latestDate)}</>}
          </span>
        </p>
        <p className="mt-3 flex flex-wrap gap-2">
          {TYPES.filter((t) => summary.byType[t] > 0).map((t) => (
            <span key={t} className="inline-flex items-center gap-1">
              <EvaluationBadge type={t} />
              <span className="text-muted font-mono text-xs">&times;{summary.byType[t]}</span>
            </span>
          ))}
        </p>
        <p className="text-muted mt-3 max-w-3xl text-xs">
          Methodologies differ between benchmarks and evaluators. Compare scores only within the
          same benchmark, benchmark version and evaluation type. There is no combined score.
        </p>
      </header>

      {truncated && (
        <p
          className="border-warn/40 bg-warn/5 text-fg-2 mb-6 rounded-xl border px-4 py-3 text-sm"
          role="note"
        >
          This benchmark has more results than can be shown at once; the newest are listed.
        </p>
      )}

      <ExplorerFilters facets={facets} query={query} />

      <div className="mt-8 space-y-10" aria-live="polite">
        {filtered.length === 0 ? (
          <p className="border-line-strong text-fg-2 rounded-2xl border border-dashed p-8 text-center text-sm">
            No results match these filters.{' '}
            {hasFilters(query) && (
              <Link
                href={explorerHref({ category: query.category, benchmark: query.benchmark })}
                replace
                scroll={false}
                className="text-accent underline"
              >
                Clear all filters
              </Link>
            )}
          </p>
        ) : (
          <>
            {onlyProviderReported && (
              <p className="text-fg-2 max-w-3xl text-sm" role="note">
                Every result shown was reported by the model&apos;s own provider; none has been
                independently evaluated.
              </p>
            )}
            <DetailCharts rows={filtered} demo={summary.isDemo} />
            <section aria-labelledby="results-title">
              <h3 id="results-title" className="t-h3 mb-4">
                Results
              </h3>
              <ResultsTable rows={filtered} />
            </section>
          </>
        )}
      </div>
    </div>
  );
}
