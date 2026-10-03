'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  MAX_HISTORY_SERIES,
  MIN_DISTRIBUTION,
  chartRows,
  distribution,
  historySeries,
  latestPerModel,
  providerDots,
  type Row,
} from '@/lib/benchmarks/analysis';
import { unitLabel } from '@/lib/benchmarks/format';
import { evaluationTypeLabel } from '@/lib/compare/values';

/** Recharts is heavy: every chart is its own client-only chunk. */
const loading = () => <Skeleton className="h-72 w-full" />;
const BarChart = dynamic(() => import('@/components/charts/bar-chart').then((m) => m.BarChart), {
  ssr: false,
  loading,
});
const TimeChart = dynamic(() => import('@/components/charts/line-chart').then((m) => m.TimeChart), {
  ssr: false,
  loading,
});
const DistributionChart = dynamic(
  () => import('@/components/charts/distribution-chart').then((m) => m.DistributionChart),
  { ssr: false, loading },
);
const ProviderDotChart = dynamic(
  () => import('@/components/charts/dot-chart').then((m) => m.ProviderDotChart),
  { ssr: false, loading },
);

const Note = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="border-line-strong text-fg-2 rounded-2xl border border-dashed p-5 text-sm">
    <p className="text-fg font-medium">{title}</p>
    <p className="mt-1">{children}</p>
  </div>
);

/**
 * The four views of one benchmark's results: the latest result per model, how scores moved over
 * evaluation dates, how many models fall in each score range, and every model grouped by
 * provider. Only real results are drawn; where there is too little data to say anything the
 * chart is replaced by a note that says why. Nothing is averaged, and no direction of "better"
 * is assumed.
 */
export function DetailCharts({ rows, demo }: { rows: Row[]; demo: boolean }) {
  const chart = useMemo(() => chartRows(rows), [rows]);
  const latest = useMemo(() => latestPerModel(chart.rows), [chart.rows]);
  const history = useMemo(() => historySeries(chart.rows), [chart.rows]);
  const dist = useMemo(() => distribution(latest), [latest]);
  const dots = useMemo(() => providerDots(latest), [latest]);
  const demoNote = demo ? 'Demo values for layout testing. ' : '';

  if (!chart.unit || latest.length === 0) return null;
  const unit = chart.unit;
  const label = unitLabel(unit);
  const bars = [...latest].sort(
    (a, b) =>
      a.provider.name.localeCompare(b.provider.name) || a.model.name.localeCompare(b.model.name),
  );
  const mixedTypes = new Set(bars.map((r) => r.evaluationType)).size > 1;
  const onlyType = bars[0]?.evaluationType;
  const sourceNote =
    'Each point is a published result; see the table below for its source and methodology.';

  return (
    <section aria-label="Charts" className="space-y-6">
      {chart.otherUnits.length > 0 && (
        <p
          className="border-warn/40 bg-warn/5 text-fg-2 rounded-xl border px-4 py-3 text-sm"
          role="note"
        >
          Results use more than one score unit. The charts show {unit} only; results in{' '}
          {chart.otherUnits.join(', ')} are in the table.
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <BarChart
            title="Latest result per model"
            unit={label}
            uniform
            yAxisWidth={mixedTypes ? 190 : 132}
            data={bars.map((r) => ({
              // The evaluation type goes on the axis only when it varies; otherwise it is stated once below.
              label: mixedTypes
                ? `${r.model.name}\n${evaluationTypeLabel[r.evaluationType]} · ${r.evaluationDate}`
                : r.model.name,
              value: r.score,
            }))}
            footnote={`${demoNote}One bar per model, ordered by provider and name (not by score).${
              mixedTypes || !onlyType
                ? ''
                : ` All results shown are ${evaluationTypeLabel[onlyType].toLowerCase()}.`
            } ${sourceNote}`}
          />
        </div>

        {history.series.length > 0 ? (
          <div className="lg:col-span-2">
            <TimeChart
              title="Scores over time"
              unit={label}
              series={history.series.map((s) => ({
                name: s.name,
                points: s.points.map((p) => ({
                  t: p.t,
                  value: p.value,
                  date: p.date,
                  label: `${p.model} · ${evaluationTypeLabel[p.type]}`,
                })),
              }))}
              footnote={`${demoNote}One line per model family, joining its results in evaluation order; a family with one result is a single marker. Different models, versions and evaluation conditions share the axis, so read changes as context, not as progress of one model.${
                history.omitted.length
                  ? ` Not drawn (the chart shows ${MAX_HISTORY_SERIES} families): ${history.omitted.join(', ')}.`
                  : ''
              }`}
            />
          </div>
        ) : (
          <div className="lg:col-span-2">
            <Note title="Scores over time">
              All results were evaluated on the same date, so there is no history to chart yet.
            </Note>
          </div>
        )}

        {dist ? (
          <DistributionChart
            title="Score distribution"
            unit={label}
            bins={dist.bins}
            footnote={`${demoNote}How many of the ${dist.n} models (latest result each) fall in each score range.`}
          />
        ) : (
          <Note title="Score distribution">
            A distribution needs at least {MIN_DISTRIBUTION} models with a result; this view has{' '}
            {latest.length}.
          </Note>
        )}

        {dots.dots.length > 0 ? (
          <ProviderDotChart
            title="Provider comparison"
            unit={label}
            providers={dots.providers}
            dots={dots.dots}
            footnote={`${demoNote}Every model's latest result, grouped by provider. Dots are not averaged or ranked. ${sourceNote}`}
          />
        ) : (
          <Note title="Provider comparison">
            Needs results from at least two providers; this view has{' '}
            {new Set(latest.map((r) => r.provider.slug)).size}.
          </Note>
        )}
      </div>
    </section>
  );
}
