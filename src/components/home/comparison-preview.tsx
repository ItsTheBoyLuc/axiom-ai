'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Check } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, formatTokens } from '@/lib/format';
import { latestBenchmarkResult } from '@/lib/models/benchmarks';
import { modalitiesText, pricingSummary } from '@/lib/models/display';
import { NOT_DISCLOSED } from '@/lib/verification';
import type { ModelListItem } from '@/types/model';

/** Recharts is heavy: load it as its own chunk, client-side only. */
const BarChart = dynamic(() => import('@/components/charts/bar-chart').then((m) => m.BarChart), {
  ssr: false,
  loading: () => <Skeleton className="h-72 w-full" />,
});

const MAX = 4;

/**
 * Homepage comparison preview: pick up to 4 models, see a compact table and a chart.
 * Benchmarks are listed separately (never blended) and labelled with their evaluation type.
 */
export function ComparisonPreview({ models: all }: { models: ModelListItem[] }) {
  const [selected, setSelected] = useState<string[]>(all.slice(0, 3).map((m) => m.slug));
  const models = all.filter((m) => selected.includes(m.slug));

  const toggle = (slug: string) =>
    setSelected((cur) =>
      cur.includes(slug) ? cur.filter((s) => s !== slug) : cur.length < MAX ? [...cur, slug] : cur,
    );

  const benchmarks = [
    ...new Map(
      models.flatMap((m) => m.benchmarks.map((b) => [b.benchmarkSlug, b.benchmarkName] as const)),
    ),
  ];
  const th = 'px-4 py-3 text-left text-xs font-medium tracking-wide text-muted uppercase';
  const rowHead = 'px-4 py-3 text-left text-sm font-normal text-fg-2';
  const chartModels = models.filter((m) => m.contextWindow !== null);
  const undisclosed = models.filter((m) => m.contextWindow === null);

  return (
    <div>
      <div
        role="group"
        aria-label={`Choose up to ${MAX} models to compare`}
        className="mb-6 flex flex-wrap gap-2"
      >
        {all.map((m) => {
          const on = selected.includes(m.slug);
          const full = !on && selected.length >= MAX;
          return (
            <button
              key={m.slug}
              type="button"
              aria-pressed={on}
              disabled={full}
              onClick={() => toggle(m.slug)}
              className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                on
                  ? 'border-accent bg-accent/10 text-fg'
                  : 'border-line text-fg-2 hover:border-line-strong hover:text-fg'
              }`}
            >
              {on && <Check size={14} aria-hidden />}
              {m.name}
            </button>
          );
        })}
        <span className="text-muted self-center text-xs" aria-live="polite">
          {selected.length}/{MAX} selected
        </span>
      </div>

      {models.length === 0 ? (
        <p className="border-line-strong text-fg-2 rounded-2xl border border-dashed p-10 text-center">
          Select at least one model to see the comparison.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.35fr_1fr]">
          <div
            tabIndex={0}
            role="region"
            aria-label="Comparison table"
            className="border-line bg-card overflow-x-auto rounded-2xl border"
          >
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <caption className="sr-only">Comparison of selected demo models</caption>
              <thead>
                <tr className="border-line border-b">
                  <th scope="col" className={th}>
                    Attribute
                  </th>
                  {models.map((m) => (
                    <th
                      key={m.slug}
                      scope="col"
                      className="text-fg px-4 py-3 text-left font-medium"
                    >
                      {m.name}
                      <span className="text-muted block text-xs font-normal">{m.providerName}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="[&_tr]:border-line/60 [&_tr]:border-b [&_tr:last-child]:border-0">
                <tr>
                  <th scope="row" className={rowHead}>
                    Released
                  </th>
                  {models.map((m) => (
                    <td key={m.slug} className="text-fg px-4 py-3 font-mono">
                      {formatDate(m.releaseDate)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row" className={rowHead}>
                    Context window
                  </th>
                  {models.map((m) => (
                    <td key={m.slug} className="text-fg px-4 py-3 font-mono">
                      {m.contextWindow === null ? (
                        <span className="text-fg-2 font-sans">{NOT_DISCLOSED}</span>
                      ) : (
                        formatTokens(m.contextWindow)
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row" className={rowHead}>
                    Modalities
                  </th>
                  {models.map((m) => (
                    <td key={m.slug} className="text-fg px-4 py-3">
                      {modalitiesText(m).join(', ')}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row" className={rowHead}>
                    Pricing
                  </th>
                  {models.map((m) => {
                    const p = pricingSummary(m);
                    return (
                      <td key={m.slug} className="text-fg px-4 py-3">
                        {p.lines.map((l) => (
                          <span key={l} className="block font-mono text-[13px] leading-5">
                            {l}
                          </span>
                        ))}
                        {p.note && <span className="text-muted block text-xs">{p.note}</span>}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <th scope="row" className={rowHead}>
                    Open weights
                  </th>
                  {models.map((m) => (
                    <td key={m.slug} className="text-fg px-4 py-3">
                      {m.openWeights ? 'Yes' : 'No'}
                    </td>
                  ))}
                </tr>
                {benchmarks.map(([slug, name]) => (
                  <tr key={slug}>
                    <th scope="row" className={rowHead}>
                      {name}
                      <span className="text-muted block text-xs">
                        Scored separately, not blended
                      </span>
                    </th>
                    {models.map((m) => {
                      const b = latestBenchmarkResult(m.benchmarks, slug);
                      return (
                        <td key={m.slug} className="text-fg px-4 py-3">
                          {b ? (
                            <>
                              <span className="font-mono">
                                {b.score}
                                {b.scoreUnit}
                              </span>
                              <span className="text-muted block text-xs">
                                {b.evaluationType === 'INDEPENDENT'
                                  ? 'Independent'
                                  : b.evaluationType === 'COMMUNITY'
                                    ? 'Community reported'
                                    : 'Provider reported'}
                              </span>
                            </>
                          ) : (
                            <span className="text-fg-2">No verified data</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {chartModels.length > 0 ? (
            <BarChart
              title="Context window"
              unit="tokens"
              data={chartModels.map((m) => ({ label: m.name, value: m.contextWindow ?? 0 }))}
              valueFormat="tokens"
              footnote={`Demo values for layout testing.${
                undisclosed.length
                  ? ` Not shown (${NOT_DISCLOSED.toLowerCase()}): ${undisclosed.map((m) => m.name).join(', ')}.`
                  : ''
              }`}
            />
          ) : (
            <p className="border-line-strong text-fg-2 self-start rounded-2xl border border-dashed p-8 text-center text-sm">
              Context window: {NOT_DISCLOSED.toLowerCase()} for the selected models.
            </p>
          )}
        </div>
      )}

      <div className="mt-8">
        <ButtonLink href={`/compare?models=${selected.join(',')}`} variant="secondary" arrow>
          Open full comparison
        </ButtonLink>
      </div>
    </div>
  );
}
