'use client';

import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatDate } from '@/lib/format';
import { ChartFrame } from './chart-frame';
import { chartCsv, csvFilename, downloadCsv } from './download';
import { Marker, SeriesLegend, seriesStyle, tooltipStyle } from './series-style';

export type TimePoint = {
  /** Epoch milliseconds (UTC midnight of the evaluation date). */
  t: number;
  value: number;
  /** Evaluation date, YYYY-MM-DD. */
  date: string;
  /** Shown in the tooltip and the table, e.g. the model and its evaluation type. */
  label: string;
};
export type TimeSeries = { name: string; points: TimePoint[] };

const shortDate = (t: number) =>
  new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/**
 * Score over time, one line per series (for example a model family). Points are real results
 * on their evaluation dates: a series with one result is a single marker, and nothing is
 * interpolated or smoothed. Has a table view, CSV and a screen-reader summary.
 */
export function TimeChart({
  title,
  unit,
  series,
  footnote,
}: {
  title: string;
  unit: string;
  series: TimeSeries[];
  footnote: React.ReactNode;
}) {
  const all = series.flatMap((s) => s.points);
  const min = Math.min(...all.map((p) => p.t));
  const max = Math.max(...all.map((p) => p.t));
  const pad = Math.max((max - min) * 0.06, 86_400_000);
  const summary = `${title}. ${series
    .map(
      (s) =>
        `${s.name}: ${s.points.map((p) => `${p.value}${unit} on ${p.date} (${p.label})`).join('; ')}`,
    )
    .join('. ')}.`;

  const rows = series.flatMap((s) => s.points.map((p) => ({ series: s.name, ...p })));

  return (
    <ChartFrame
      title={title}
      unit={unit}
      summary={summary}
      onDownload={() =>
        downloadCsv(
          csvFilename(title),
          chartCsv([
            ['Series', 'Evaluation date', `Score (${unit})`, 'Result'],
            ...rows.map((r) => [r.series, r.date, r.value, r.label]),
          ]),
        )
      }
      legend={<SeriesLegend names={series.map((s) => s.name)} />}
      footnote={footnote}
      table={
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="border-line text-fg-2 border-b text-left">
              {['Series', 'Evaluated', unit, 'Result'].map((h, i) => (
                <th
                  key={h}
                  scope="col"
                  className={`py-2 font-medium ${i === 2 ? 'text-right' : ''}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.series}-${r.date}-${i}`} className="border-line/60 border-b">
                <th scope="row" className="text-fg py-2 text-left font-normal">
                  {r.series}
                </th>
                <td className="text-fg-2 py-2 font-mono text-xs">{formatDate(r.date)}</td>
                <td className="text-fg py-2 text-right font-mono">{r.value}</td>
                <td className="text-fg-2 py-2 text-xs">{r.label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 20, bottom: 8, left: 4 }}>
            <CartesianGrid stroke="var(--border)" />
            <XAxis
              type="number"
              dataKey="t"
              domain={[min - pad, max + pad]}
              scale="time"
              tickFormatter={shortDate}
              stroke="var(--text-muted)"
              tick={{ fill: 'var(--text-2)', fontSize: 12 }}
              name="Evaluated"
            />
            <YAxis
              type="number"
              dataKey="value"
              domain={['auto', 'auto']}
              stroke="var(--text-muted)"
              tick={{ fill: 'var(--text-2)', fontSize: 12 }}
              width={48}
              name="Score"
              unit={unit === '%' ? '%' : ''}
            />
            <Tooltip
              cursor={{ stroke: 'var(--border-strong)' }}
              {...tooltipStyle}
              content={({ active, payload }) => {
                const p = active ? (payload?.[0]?.payload as TimePoint | undefined) : undefined;
                if (!p) return null;
                return (
                  <div
                    className="rounded-lg border px-3 py-2 text-xs"
                    style={{ ...tooltipStyle.contentStyle }}
                  >
                    <p style={{ color: 'var(--text)' }} className="font-medium">
                      {p.value}
                      {unit === '%' ? '%' : ` ${unit}`}
                    </p>
                    <p style={{ color: 'var(--text-2)' }}>{p.label}</p>
                    <p style={{ color: 'var(--text-muted)' }}>Evaluated {formatDate(p.date)}</p>
                  </div>
                );
              }}
            />
            {series.map((s, i) => {
              const st = seriesStyle(i);
              return (
                <Scatter
                  key={s.name}
                  name={s.name}
                  data={s.points}
                  line={{ stroke: st.stroke, strokeWidth: 2, strokeDasharray: st.dash }}
                  isAnimationActive
                  animationDuration={700}
                  shape={(p: { cx?: number; cy?: number }) => (
                    <g transform={`translate(${p.cx},${p.cy})`}>
                      <Marker shape={st.shape} color={st.stroke} />
                    </g>
                  )}
                />
              );
            })}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
