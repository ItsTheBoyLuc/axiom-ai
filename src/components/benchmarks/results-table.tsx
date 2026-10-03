'use client';

import Link from 'next/link';
import { useId, useMemo, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { EvaluationBadge } from '@/components/ui/badges';
import { formatDate } from '@/lib/format';
import { formatScore } from '@/lib/benchmarks/format';
import type { BenchmarkResultRow } from '@/types/catalog';

const SORTS = {
  newest: 'Newest evaluation',
  oldest: 'Oldest evaluation',
  model: 'Model name',
  'score-desc': 'Score, high to low',
  'score-asc': 'Score, low to high',
} as const;
type SortKey = keyof typeof SORTS;

const compare: Record<SortKey, (a: BenchmarkResultRow, b: BenchmarkResultRow) => number> = {
  newest: (a, b) =>
    b.evaluationDate.localeCompare(a.evaluationDate) || a.model.name.localeCompare(b.model.name),
  oldest: (a, b) =>
    a.evaluationDate.localeCompare(b.evaluationDate) || a.model.name.localeCompare(b.model.name),
  model: (a, b) =>
    a.model.name.localeCompare(b.model.name) || b.evaluationDate.localeCompare(a.evaluationDate),
  'score-desc': (a, b) => b.score - a.score || a.model.name.localeCompare(b.model.name),
  'score-asc': (a, b) => a.score - b.score || a.model.name.localeCompare(b.model.name),
};

const th = 'px-4 py-3 text-left text-xs font-medium tracking-wide text-muted uppercase';

/**
 * Every result of the benchmark, one row each, with all the context a score needs: evaluation
 * type (badge with icon), evaluation date, the model version it was measured on, the benchmark
 * version, the methodology note and the source. Sorting is a view choice only; no rank is shown.
 */
export function ResultsTable({ rows }: { rows: BenchmarkResultRow[] }) {
  const [sort, setSort] = useState<SortKey>('newest');
  const id = useId();
  const sorted = useMemo(() => [...rows].sort(compare[sort]), [rows, sort]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted text-xs" role="status">
          {rows.length} {rows.length === 1 ? 'result' : 'results'}
        </p>
        <div className="flex items-center gap-2">
          <label htmlFor={`${id}-sort`} className="text-fg-2 text-sm">
            Sort by
          </label>
          <select
            id={`${id}-sort`}
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="border-line-strong bg-elevated text-fg h-10 rounded-lg border px-3 text-sm"
          >
            {(Object.keys(SORTS) as SortKey[]).map((k) => (
              <option key={k} value={k}>
                {SORTS[k]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div
        tabIndex={0}
        role="region"
        aria-label="Benchmark results table"
        className="border-line bg-card overflow-x-auto rounded-2xl border"
      >
        <table className="w-full min-w-[1040px] border-collapse text-sm">
          <caption className="sr-only">
            Benchmark results, sorted by {SORTS[sort].toLowerCase()}
          </caption>
          <thead>
            <tr className="border-line border-b">
              {[
                'Model',
                'Score',
                'Evaluation',
                'Evaluated',
                'Model version',
                'Benchmark version',
                'Methodology',
                'Source',
              ].map((h) => (
                <th key={h} scope="col" className={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr
                key={`${r.model.slug}-${r.evaluationDate}-${i}`}
                className="border-line/60 border-b align-top last:border-0"
              >
                <th scope="row" className="px-4 py-3 text-left font-normal">
                  <Link href={`/models/${r.model.slug}`} className="text-fg hover:underline">
                    {r.model.name}
                  </Link>
                  <span className="text-muted block text-xs">{r.provider.name}</span>
                </th>
                <td className="text-fg px-4 py-3 font-mono whitespace-nowrap">
                  {formatScore(r.score, r.scoreUnit)}
                </td>
                <td className="px-4 py-3">
                  <EvaluationBadge type={r.evaluationType} />
                </td>
                <td className="text-fg-2 px-4 py-3 font-mono text-xs whitespace-nowrap">
                  {formatDate(r.evaluationDate)}
                </td>
                <td className="text-fg-2 px-4 py-3 font-mono text-xs">{r.modelVersion}</td>
                <td className="text-fg-2 px-4 py-3 font-mono text-xs">
                  {r.benchmarkVersion ?? 'Not publicly disclosed'}
                </td>
                <td className="text-fg-2 max-w-72 px-4 py-3 text-xs">
                  {r.methodologyNotes ?? 'Not publicly disclosed'}
                </td>
                <td className="px-4 py-3 text-xs">
                  {r.sourceUrl ? (
                    <a
                      href={r.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent inline-flex items-center gap-1 hover:underline"
                    >
                      Source <ArrowUpRight size={12} aria-hidden />
                    </a>
                  ) : (
                    <span className="text-fg-2">No source (demo)</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
