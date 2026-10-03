'use client';

import { useId, useState } from 'react';
import {
  Bar,
  BarChart as RBarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatTokens } from '@/lib/format';
import { Download, Table2, BarChart3 } from 'lucide-react';
import { chartCsv, csvFilename, downloadCsv } from './download';

/** Serializable format key (functions cannot cross the server/client boundary). */
export type ValueFormat = 'number' | 'tokens';

const formatters: Record<ValueFormat, (v: number) => string> = {
  number: (v) => v.toLocaleString('en-US'),
  tokens: formatTokens,
};

/** `label` may contain "\n" to render a second, dimmer line on the axis (e.g. evaluation type). */
export type BarDatum = { label: string; value: number };

/** Bar fills. Meaning never relies on color alone: every bar has an axis label, and the table view lists values. */
const fills = ['var(--accent)', 'var(--accent-2)', 'var(--accent-3)', 'var(--text-2)'];

const plain = (s: string) => s.replaceAll('\n', ' · ');

/** Two-line axis tick: first line normal, second line dimmer. */
function AxisTick({
  x = 0,
  y = 0,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value: string };
}) {
  const lines = String(payload?.value ?? '').split('\n');
  return (
    <g transform={`translate(${x},${y})`}>
      <text textAnchor="end" fill="var(--text-2)" fontSize={12}>
        {lines.map((l, i) => (
          <tspan
            key={i}
            x={-4}
            dy={i === 0 ? (lines.length > 1 ? '-0.1em' : '0.32em') : '1.25em'}
            fillOpacity={i === 0 ? 1 : 0.75}
          >
            {l}
          </tspan>
        ))}
      </text>
    </g>
  );
}

/**
 * Themed horizontal bar chart (Recharts) with units, tooltip, source/methodology footnote,
 * a table alternative, CSV download and a text summary for screen readers.
 */
export function BarChart({
  title,
  unit,
  data,
  footnote,
  valueFormat = 'number',
  showTableToggle = true,
  yAxisWidth = 124,
  rowHeader = 'Model',
  uniform = false,
}: {
  title: string;
  unit: string;
  data: BarDatum[];
  footnote: React.ReactNode;
  valueFormat?: ValueFormat;
  /** Hide the built-in chart/table switch when the parent provides its own table. */
  showTableToggle?: boolean;
  yAxisWidth?: number;
  rowHeader?: string;
  /** One series: draw every bar in the same colour (colour must not suggest groups that do not exist). */
  uniform?: boolean;
}) {
  const formatValue = formatters[valueFormat];
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const id = useId();
  const summary = `${title}. ${data.map((d) => `${plain(d.label)}: ${formatValue(d.value)} ${unit}`).join('; ')}.`;
  const height = Math.max(224, data.length * 52 + 48);

  const download = () =>
    downloadCsv(
      csvFilename(title),
      chartCsv([[`Label`, `${title} (${unit})`], ...data.map((r) => [plain(r.label), r.value])]),
    );

  const btn =
    'inline-flex h-8 items-center gap-1.5 rounded-md border border-line px-2.5 text-xs text-fg-2 hover:border-line-strong hover:text-fg';

  return (
    <figure aria-labelledby={`${id}-t`} className="border-line bg-card rounded-2xl border p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <figcaption id={`${id}-t`} className="text-fg text-sm font-medium">
          {title} <span className="text-muted font-normal">({unit})</span>
        </figcaption>
        <div className="flex gap-2">
          {showTableToggle && (
            <button
              type="button"
              className={btn}
              onClick={() => setView(view === 'chart' ? 'table' : 'chart')}
            >
              {view === 'chart' ? (
                <Table2 size={14} aria-hidden />
              ) : (
                <BarChart3 size={14} aria-hidden />
              )}
              {view === 'chart' ? 'Table view' : 'Chart view'}
            </button>
          )}
          <button type="button" className={btn} onClick={download}>
            <Download size={14} aria-hidden />
            CSV
          </button>
        </div>
      </div>

      {view === 'chart' ? (
        <div role="img" aria-label={summary} className="w-full" style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <RBarChart
              data={data}
              layout="vertical"
              margin={{ left: 8, right: 16, top: 4, bottom: 4 }}
            >
              <CartesianGrid horizontal={false} stroke="var(--border)" />
              <XAxis
                type="number"
                stroke="var(--text-muted)"
                tick={{ fill: 'var(--text-2)', fontSize: 12 }}
                tickFormatter={formatValue}
              />
              <YAxis
                type="category"
                dataKey="label"
                width={yAxisWidth}
                interval={0}
                stroke="var(--text-muted)"
                tick={<AxisTick />}
              />
              <Tooltip
                cursor={{ fill: 'var(--border)' }}
                formatter={(v) => [`${formatValue(Number(v))} ${unit}`, title]}
                labelFormatter={(l) => plain(String(l))}
                contentStyle={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 10,
                  color: 'var(--text)',
                }}
                labelStyle={{ color: 'var(--text)' }}
                itemStyle={{ color: 'var(--text-2)' }}
              />
              <Bar
                dataKey="value"
                radius={[0, 6, 6, 0]}
                isAnimationActive
                animationDuration={700}
                animationEasing="ease-out"
                stroke="var(--bg-card)"
                strokeWidth={2}
              >
                {data.map((d, i) => (
                  <Cell
                    key={`${d.label}-${i}`}
                    fill={uniform ? fills[0] : fills[i % fills.length]}
                  />
                ))}
              </Bar>
            </RBarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-line text-fg-2 border-b text-left">
              <th scope="col" className="py-2 font-medium">
                {rowHeader}
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                {unit}
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((d, i) => (
              <tr key={`${d.label}-${i}`} className="border-line/60 border-b">
                <th scope="row" className="text-fg py-2 text-left font-normal">
                  {plain(d.label)}
                </th>
                <td className="text-fg py-2 text-right font-mono">{formatValue(d.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="text-muted mt-3 text-xs">{footnote}</p>
    </figure>
  );
}
