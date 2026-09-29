'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { BarChart3, Table2 } from 'lucide-react';
import { EvaluationBadge } from '@/components/ui/badges';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/format';
import type { BenchmarkResult } from '@/types/model';

const BarChart = dynamic(() => import('@/components/charts/bar-chart').then((m) => m.BarChart), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full" />,
});

const evalShort = {
  INDEPENDENT: 'independent',
  PROVIDER_REPORTED: 'provider',
  COMMUNITY: 'community',
} as const;

/**
 * Benchmark results as chart or table. Every row keeps its own benchmark name/version,
 * date, model version, methodology, source and evaluation type. Results with different units
 * are charted separately, and nothing is averaged or ranked across benchmarks.
 */
export function BenchmarksView({ results }: { results: BenchmarkResult[] }) {
  const [view, setView] = useState<'chart' | 'table'>('table');

  if (results.length === 0) {
    return (
      <p className="border-line-strong text-fg-2 rounded-2xl border border-dashed p-6 text-sm">
        No verified data: no benchmark results are published for this model.
      </p>
    );
  }

  const sorted = [...results].sort(
    (a, b) =>
      a.benchmarkName.localeCompare(b.benchmarkName) ||
      b.evaluationDate.localeCompare(a.evaluationDate),
  );
  const units = [...new Set(sorted.map((r) => r.scoreUnit))];
  const th = 'px-4 py-3 text-left text-xs font-medium tracking-wide text-muted uppercase';
  const tab = (on: boolean) =>
    `inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm transition-colors ${
      on ? 'bg-elevated text-fg' : 'text-fg-2 hover:text-fg'
    }`;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Benchmark view"
          className="border-line bg-card inline-flex rounded-lg border p-1"
        >
          <button
            type="button"
            aria-pressed={view === 'table'}
            onClick={() => setView('table')}
            className={tab(view === 'table')}
          >
            <Table2 size={15} aria-hidden /> Table
          </button>
          <button
            type="button"
            aria-pressed={view === 'chart'}
            onClick={() => setView('chart')}
            className={tab(view === 'chart')}
          >
            <BarChart3 size={15} aria-hidden /> Chart
          </button>
        </div>
        <p className="text-muted max-w-md text-xs">
          Methodologies differ between benchmarks and evaluators. Compare scores only within the
          same benchmark, version and evaluation type.
        </p>
      </div>

      {view === 'table' ? (
        <div
          tabIndex={0}
          role="region"
          aria-label="Benchmark results table"
          className="border-line bg-card overflow-x-auto rounded-2xl border"
        >
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <caption className="sr-only">Benchmark results</caption>
            <thead>
              <tr className="border-line border-b">
                <th scope="col" className={th}>
                  Benchmark
                </th>
                <th scope="col" className={th}>
                  Score
                </th>
                <th scope="col" className={th}>
                  Evaluated
                </th>
                <th scope="col" className={th}>
                  Model version
                </th>
                <th scope="col" className={th}>
                  Evaluation
                </th>
                <th scope="col" className={th}>
                  Methodology
                </th>
                <th scope="col" className={th}>
                  Source
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => (
                <tr
                  key={`${r.benchmarkSlug}-${r.evaluationDate}-${i}`}
                  className="border-line/60 border-b align-top last:border-0"
                >
                  <th scope="row" className="text-fg px-4 py-3 text-left font-normal">
                    {r.benchmarkName}
                    {r.benchmarkVersion && (
                      <span className="text-muted block text-xs">version {r.benchmarkVersion}</span>
                    )}
                  </th>
                  <td className="text-fg px-4 py-3 font-mono">
                    {r.score}
                    {r.scoreUnit}
                  </td>
                  <td className="text-fg-2 px-4 py-3 font-mono text-xs whitespace-nowrap">
                    {formatDate(r.evaluationDate)}
                  </td>
                  <td className="text-fg-2 px-4 py-3 font-mono text-xs">{r.modelVersion}</td>
                  <td className="px-4 py-3">
                    <EvaluationBadge type={r.evaluationType} />
                  </td>
                  <td className="text-fg-2 max-w-64 px-4 py-3 text-xs">
                    {r.methodologyNotes ?? 'Not publicly disclosed'}
                  </td>
                  <td className="text-fg-2 px-4 py-3 text-xs">
                    {r.sourceUrl ? (
                      <a
                        href={r.sourceUrl}
                        rel="noopener noreferrer"
                        target="_blank"
                        className="text-accent hover:underline"
                      >
                        Source
                      </a>
                    ) : (
                      'No source (demo)'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        // Different units are charted separately; a single unit gets the full width.
        <div className={`grid grid-cols-1 gap-5 ${units.length > 1 ? 'lg:grid-cols-2' : ''}`}>
          {units.map((unit) => (
            <BarChart
              key={unit}
              title="Benchmark scores"
              unit={unit}
              rowHeader="Benchmark"
              showTableToggle={false}
              yAxisWidth={168}
              data={sorted
                .filter((r) => r.scoreUnit === unit)
                .map((r) => ({
                  label: `${r.benchmarkName}\n${evalShort[r.evaluationType]} · ${r.evaluationDate}`,
                  value: r.score,
                }))}
              footnote="Each bar is a separate benchmark result; bars are not averaged or ranked against each other. Demo values."
            />
          ))}
        </div>
      )}
    </div>
  );
}
