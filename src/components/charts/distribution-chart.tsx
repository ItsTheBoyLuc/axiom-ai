'use client';

import {
  Bar,
  BarChart as RBarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartFrame } from './chart-frame';
import { chartCsv, csvFilename, downloadCsv } from './download';
import { tooltipStyle } from './series-style';

export type DistributionBin = { from: number; to: number; count: number; models: string[] };

/** Bin edges with just enough precision to tell neighbouring bins apart. */
function edgeFormatter(bins: DistributionBin[]) {
  const widths = bins.map((b) => b.to - b.from).filter((w) => w > 0);
  const w = widths.length ? Math.min(...widths) : 1;
  const digits = w >= 10 ? 0 : w >= 1 ? 1 : 2;
  return (n: number) => n.toFixed(digits);
}

/**
 * Histogram of how many models fall in each score range (one score per model). Counts are
 * exact; a table view lists every bin with the models in it. The caller decides whether there
 * are enough models to draw one (see distribution() in lib/benchmarks).
 */
export function DistributionChart({
  title,
  unit,
  bins,
  footnote,
}: {
  title: string;
  unit: string;
  bins: DistributionBin[];
  footnote: React.ReactNode;
}) {
  const fmt = edgeFormatter(bins);
  const data = bins.map((b) => ({
    range: b.from === b.to ? fmt(b.from) : `${fmt(b.from)} to ${fmt(b.to)}`,
    count: b.count,
    models: b.models,
  }));
  const summary = `${title}. ${data.map((d) => `${d.range}: ${d.count} ${d.count === 1 ? 'model' : 'models'}`).join('; ')}.`;

  return (
    <ChartFrame
      title={title}
      unit={unit}
      summary={summary}
      onDownload={() =>
        downloadCsv(
          csvFilename(title),
          chartCsv([
            [`Score range (${unit})`, 'Models', 'Model names'],
            ...data.map((d) => [d.range, d.count, d.models.join('; ')]),
          ]),
        )
      }
      footnote={footnote}
      table={
        <table className="w-full min-w-[320px] text-sm">
          <thead>
            <tr className="border-line text-fg-2 border-b text-left">
              <th scope="col" className="py-2 font-medium">
                Score range
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Models
              </th>
              <th scope="col" className="py-2 pl-4 font-medium">
                Which
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.range} className="border-line/60 border-b">
                <th scope="row" className="text-fg py-2 text-left font-mono text-xs font-normal">
                  {d.range}
                </th>
                <td className="text-fg py-2 text-right font-mono">{d.count}</td>
                <td className="text-fg-2 py-2 pl-4 text-xs">{d.models.join(', ') || 'None'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RBarChart data={data} margin={{ top: 8, right: 12, bottom: 24, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="range"
              interval={0}
              stroke="var(--text-muted)"
              tick={{ fill: 'var(--text-2)', fontSize: 11 }}
              label={{
                value: `Score (${unit})`,
                position: 'insideBottom',
                offset: -16,
                fill: 'var(--text-muted)',
                fontSize: 11,
              }}
            />
            <YAxis
              allowDecimals={false}
              stroke="var(--text-muted)"
              tick={{ fill: 'var(--text-2)', fontSize: 12 }}
              width={32}
            />
            <Tooltip
              cursor={{ fill: 'var(--border)' }}
              {...tooltipStyle}
              content={({ active, payload }) => {
                const d = active ? (payload?.[0]?.payload as (typeof data)[number]) : undefined;
                if (!d) return null;
                return (
                  <div
                    className="rounded-lg border px-3 py-2 text-xs"
                    style={tooltipStyle.contentStyle}
                  >
                    <p style={{ color: 'var(--text)' }} className="font-medium">
                      {d.range}: {d.count} {d.count === 1 ? 'model' : 'models'}
                    </p>
                    {d.models.length > 0 && (
                      <p style={{ color: 'var(--text-2)' }}>{d.models.join(', ')}</p>
                    )}
                  </div>
                );
              }}
            />
            <Bar
              dataKey="count"
              fill="var(--accent)"
              radius={[6, 6, 0, 0]}
              stroke="var(--bg-card)"
              strokeWidth={2}
              isAnimationActive
              animationDuration={700}
              animationEasing="ease-out"
            />
          </RBarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
