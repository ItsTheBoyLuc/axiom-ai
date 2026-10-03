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
import type { EvaluationType } from '@/types/model';
import { ChartFrame } from './chart-frame';
import { chartCsv, csvFilename, downloadCsv } from './download';
import { Marker, tooltipStyle, type Shape } from './series-style';

export type Dot = {
  /** Row index of the group (provider). */
  y: number;
  provider: string;
  model: string;
  score: number;
  type: EvaluationType;
  date: string;
};

/** Evaluation type -> marker shape, so independent and provider-reported dots differ without colour. */
const typeShape: Record<EvaluationType, Shape> = {
  PROVIDER_REPORTED: 'circle',
  INDEPENDENT: 'diamond',
  COMMUNITY: 'square',
};
const typeName: Record<EvaluationType, string> = {
  PROVIDER_REPORTED: 'Provider reported',
  INDEPENDENT: 'Independent',
  COMMUNITY: 'Community reported',
};

/**
 * One dot per model, in a row per provider, along the score axis. Nothing is aggregated and no
 * score direction is assumed. Dot shape encodes the evaluation type. Has a table view and CSV.
 */
export function ProviderDotChart({
  title,
  unit,
  providers,
  dots,
  footnote,
}: {
  title: string;
  unit: string;
  providers: string[];
  dots: Dot[];
  footnote: React.ReactNode;
}) {
  const types = [...new Set(dots.map((d) => d.type))];
  const height = Math.max(200, providers.length * 48 + 72);
  const summary = `${title}. ${providers
    .map(
      (p) =>
        `${p}: ${dots
          .filter((d) => d.provider === p)
          .map((d) => `${d.model} ${d.score}${unit} (${typeName[d.type].toLowerCase()})`)
          .join(', ')}`,
    )
    .join('; ')}.`;

  return (
    <ChartFrame
      title={title}
      unit={unit}
      summary={summary}
      onDownload={() =>
        downloadCsv(
          csvFilename(title),
          chartCsv([
            ['Provider', 'Model', `Score (${unit})`, 'Evaluation', 'Evaluated'],
            ...dots.map((d) => [d.provider, d.model, d.score, typeName[d.type], d.date]),
          ]),
        )
      }
      legend={
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5" aria-label="Legend">
          {types.map((t) => (
            <li key={t} className="text-fg-2 flex items-center gap-2 text-xs">
              <svg width="14" height="14" aria-hidden>
                <g transform="translate(7,7)">
                  <Marker shape={typeShape[t]} color="var(--accent)" size={4} />
                </g>
              </svg>
              {typeName[t]}
            </li>
          ))}
        </ul>
      }
      footnote={footnote}
      table={
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-line text-fg-2 border-b text-left">
              {['Provider', 'Model', unit, 'Evaluation', 'Evaluated'].map((h, i) => (
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
            {dots.map((d) => (
              <tr key={`${d.model}-${d.date}`} className="border-line/60 border-b">
                <th scope="row" className="text-fg py-2 text-left font-normal">
                  {d.provider}
                </th>
                <td className="text-fg-2 py-2">{d.model}</td>
                <td className="text-fg py-2 text-right font-mono">{d.score}</td>
                <td className="text-fg-2 py-2 text-xs">{typeName[d.type]}</td>
                <td className="text-fg-2 py-2 font-mono text-xs">{formatDate(d.date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 20, bottom: 8, left: 4 }}>
            <CartesianGrid stroke="var(--border)" />
            <XAxis
              type="number"
              dataKey="score"
              domain={['auto', 'auto']}
              stroke="var(--text-muted)"
              tick={{ fill: 'var(--text-2)', fontSize: 12 }}
              name="Score"
            />
            <YAxis
              type="number"
              dataKey="y"
              domain={[-0.5, providers.length - 0.5]}
              ticks={providers.map((_, i) => i)}
              tickFormatter={(i: number) => providers[i] ?? ''}
              interval={0}
              width={128}
              stroke="var(--text-muted)"
              tick={{ fill: 'var(--text-2)', fontSize: 12 }}
              reversed
            />
            <Tooltip
              cursor={{ stroke: 'var(--border-strong)' }}
              {...tooltipStyle}
              content={({ active, payload }) => {
                const d = active ? (payload?.[0]?.payload as Dot | undefined) : undefined;
                if (!d) return null;
                return (
                  <div
                    className="rounded-lg border px-3 py-2 text-xs"
                    style={tooltipStyle.contentStyle}
                  >
                    <p style={{ color: 'var(--text)' }} className="font-medium">
                      {d.model}: {d.score}
                      {unit === '%' ? '%' : ` ${unit}`}
                    </p>
                    <p style={{ color: 'var(--text-2)' }}>{typeName[d.type]}</p>
                    <p style={{ color: 'var(--text-muted)' }}>Evaluated {formatDate(d.date)}</p>
                  </div>
                );
              }}
            />
            <Scatter
              data={dots}
              isAnimationActive
              animationDuration={700}
              shape={(p: { cx?: number; cy?: number; payload?: Dot }) => (
                <g transform={`translate(${p.cx},${p.cy})`}>
                  <Marker
                    shape={typeShape[p.payload?.type ?? 'PROVIDER_REPORTED']}
                    color="var(--accent)"
                    size={6}
                  />
                </g>
              )}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
