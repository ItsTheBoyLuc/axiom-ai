'use client';

import dynamic from 'next/dynamic';
import { useId, useMemo, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  MAX_RADAR_AXES,
  benchmarkOptions,
  benchmarkSeries,
  contextSeries,
  priceSeries,
  radarData,
} from '@/lib/compare/charts';
import type { ModelDetail } from '@/types/model';

/** Recharts is heavy: each wrapper is its own client-only chunk. */
const loading = () => <Skeleton className="h-72 w-full" />;
const BarChart = dynamic(() => import('@/components/charts/bar-chart').then((m) => m.BarChart), {
  ssr: false,
  loading,
});
const RadarChart = dynamic(
  () => import('@/components/charts/radar-chart').then((m) => m.RadarChart),
  { ssr: false, loading },
);

const Note = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="border-line-strong text-fg-2 rounded-2xl border border-dashed p-5 text-sm">
    <p className="text-fg font-medium">{title}</p>
    <p className="mt-1">{children}</p>
  </div>
);

const omittedText = (names: string[], what: string) =>
  names.length ? ` Not shown (${what}): ${names.join(', ')}.` : '';

/**
 * Charts for the selected models: context window, input and output price, one benchmark at a
 * time (never blended), and a radar for benchmarks that share an explicit 0-100 % scale.
 * Every chart carries units, a source/method note, a table view and a CSV download. A model
 * without a value is named under the chart, never drawn as zero.
 */
export function CompareCharts({ models }: { models: ModelDetail[] }) {
  const id = useId();
  const demo = models.some((m) => m.isDemo);
  const demoNote = demo ? 'Demo values for layout testing. ' : '';

  const context = useMemo(() => contextSeries(models), [models]);
  const input = useMemo(() => priceSeries(models, 'INPUT'), [models]);
  const output = useMemo(() => priceSeries(models, 'OUTPUT'), [models]);
  const options = useMemo(() => benchmarkOptions(models), [models]);
  const radar = useMemo(() => radarData(models), [models]);

  const [picked, setPicked] = useState<string | null>(null);
  const slug = options.some((o) => o.slug === picked) ? picked! : (options[0]?.slug ?? null);
  const bench = useMemo(() => (slug ? benchmarkSeries(models, slug) : null), [models, slug]);

  const priceChart = (title: string, s: typeof input) =>
    s.ok ? (
      <BarChart
        title={title}
        unit={`${s.currency} per 1M tokens`}
        data={s.data}
        yAxisWidth={150}
        footnote={`${demoNote}Current list prices; the tier or deployment type is shown under each name. Sources are in the pricing rows above.${omittedText(s.omitted, 'no flat per-token price or not publicly disclosed')}`}
      />
    ) : (
      <Note title={title}>
        {s.reason}
        {omittedText(s.omitted, 'no flat per-token price or not publicly disclosed')}
      </Note>
    );

  return (
    <section aria-labelledby={`${id}-h`} className="mt-12">
      <h2 id={`${id}-h`} className="t-h2">
        Charts
      </h2>
      <p className="text-fg-2 mt-2 max-w-2xl text-sm">
        Each chart has a table view and a CSV download. Benchmarks are charted one at a time; no
        score is combined or averaged.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {context.data.length > 0 ? (
          <BarChart
            title="Context window"
            unit="tokens"
            data={context.data}
            valueFormat="tokens"
            footnote={`${demoNote}Maximum input context as stated by each provider (see the profiles).${omittedText(context.omitted, 'not publicly disclosed')}`}
          />
        ) : (
          <Note title="Context window">Not publicly disclosed for the selected models.</Note>
        )}

        {priceChart('Input price', input)}
        {priceChart('Output price', output)}

        <div className="lg:col-span-2">
          {options.length === 0 || !bench ? (
            <Note title="Benchmark comparison">
              No benchmark has a verified result for two or more of the selected models, so there is
              nothing to put side by side.
            </Note>
          ) : (
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <label htmlFor={`${id}-bench`} className="text-fg text-sm font-medium">
                  Benchmark
                </label>
                <select
                  id={`${id}-bench`}
                  value={slug ?? ''}
                  onChange={(e) => setPicked(e.target.value)}
                  className="border-line-strong bg-elevated text-fg h-10 max-w-full rounded-lg border px-3 text-sm"
                >
                  {options.map((o) => (
                    <option key={o.slug} value={o.slug}>
                      {o.name} ({o.count} models)
                    </option>
                  ))}
                </select>
              </div>
              {bench.ok ? (
                <>
                  <BarChart
                    title={bench.name}
                    unit={bench.unit}
                    data={bench.data}
                    yAxisWidth={190}
                    footnote={`${demoNote}Latest result per model; the evaluation type and date are under each name, and the sources are linked in the table above.${omittedText(bench.omitted, 'no verified result')}`}
                  />
                  {bench.caveat && (
                    <p className="text-fg-2 mt-2 text-xs" role="note">
                      {bench.caveat}
                    </p>
                  )}
                </>
              ) : (
                <Note title="Benchmark comparison">{bench.reason}</Note>
              )}
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          {radar.ok ? (
            <RadarChart
              title="Benchmark profile"
              unit="%"
              axes={radar.axes.map((a) => a.name)}
              series={radar.series}
              footnote={`${demoNote}Only benchmarks that every selected model has, scored in % (a fixed 0 to 100 scale) under the same evaluation type and benchmark version. This is not an overall score: nothing is averaged or weighted.${
                radar.eligible > MAX_RADAR_AXES
                  ? ` Showing ${MAX_RADAR_AXES} of ${radar.eligible} qualifying benchmarks (alphabetical); the table above lists them all.`
                  : ''
              }`}
            />
          ) : (
            <Note title="Benchmark profile (radar)">{radar.reason}</Note>
          )}
        </div>
      </div>
    </section>
  );
}
