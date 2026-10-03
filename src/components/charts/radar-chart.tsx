'use client';

import { useId, useState } from 'react';
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart as RRadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { BarChart3, Download, Table2 } from 'lucide-react';
import { chartCsv, csvFilename, downloadCsv } from './download';

/** Series colours; each series also gets its own marker shape and dash pattern. */
const strokes = ['var(--accent)', 'var(--accent-2)', 'var(--accent-3)', 'var(--text-2)'];
const dashes = [undefined, '6 3', '2 3', '10 3 2 3'];
const shapes = ['circle', 'square', 'triangle', 'diamond'] as const;
type Shape = (typeof shapes)[number];

function Marker({ shape, color, size = 5 }: { shape: Shape; color: string; size?: number }) {
  const s = size;
  switch (shape) {
    case 'square':
      return <rect x={-s} y={-s} width={s * 2} height={s * 2} fill={color} />;
    case 'triangle':
      return <polygon points={`0,${-s - 1} ${s + 1},${s} ${-s - 1},${s}`} fill={color} />;
    case 'diamond':
      return <polygon points={`0,${-s - 1} ${s + 1},0 0,${s + 1} ${-s - 1},0`} fill={color} />;
    default:
      return <circle r={s} fill={color} />;
  }
}

/** Axis label that wraps onto up to three short lines so it is never clipped at the chart edge. */
function AngleTick({
  x = 0,
  y = 0,
  cx = 0,
  cy = 0,
  payload,
}: {
  x?: number;
  y?: number;
  cx?: number;
  cy?: number;
  payload?: { value: string };
}) {
  const words = String(payload?.value ?? '').split(' ');
  const lines: string[] = [];
  for (const w of words) {
    const last = lines[lines.length - 1];
    if (last !== undefined && (last + ' ' + w).length <= 13)
      lines[lines.length - 1] = last + ' ' + w;
    else lines.push(w);
  }
  // Labels above the centre grow upward so they never wrap into the plot.
  const firstDy = (y < cy - 8 ? -(lines.length - 1) * 1.2 : 0) + 0.32;
  const anchor = Math.abs(x - cx) < 8 ? 'middle' : x > cx ? 'start' : 'end';
  return (
    <text x={x} y={y} textAnchor={anchor} fill="var(--text-2)" fontSize={11}>
      {lines.map((l, i) => (
        <tspan key={i} x={x} dy={i === 0 ? `${firstDy}em` : '1.2em'}>
          {l}
        </tspan>
      ))}
    </text>
  );
}

export type RadarSeries = { name: string; values: number[] };

/**
 * Themed radar chart (Recharts) for benchmarks that share one explicit 0-100 scale. Series are
 * told apart by colour, marker shape and line dash; there is a table view, a CSV download and a
 * text summary for screen readers. Callers must only pass comparable axes (see radarData()).
 */
export function RadarChart({
  title,
  unit,
  axes,
  series,
  footnote,
}: {
  title: string;
  unit: string;
  axes: string[];
  series: RadarSeries[];
  footnote: React.ReactNode;
}) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const id = useId();
  const data = axes.map((axis, i) => ({
    axis,
    ...Object.fromEntries(series.map((s, j) => [`s${j}`, s.values[i]])),
  }));
  const summary = `${title}. ${series
    .map((s) => `${s.name}: ${axes.map((a, i) => `${a} ${s.values[i]}${unit}`).join(', ')}`)
    .join('. ')}.`;

  const download = () =>
    downloadCsv(
      csvFilename(title),
      chartCsv([
        ['Benchmark', ...series.map((s) => `${s.name} (${unit})`)],
        ...axes.map((a, i) => [a, ...series.map((s) => s.values[i]!)]),
      ]),
    );

  const btn =
    'inline-flex h-8 items-center gap-1.5 rounded-md border border-line px-2.5 text-xs text-fg-2 hover:border-line-strong hover:text-fg';

  return (
    <figure aria-labelledby={`${id}-t`} className="border-line bg-card rounded-2xl border p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <figcaption id={`${id}-t`} className="text-fg text-sm font-medium">
          {title} <span className="text-muted font-normal">({unit}, 0 to 100)</span>
        </figcaption>
        <div className="flex gap-2">
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
          <button type="button" className={btn} onClick={download}>
            <Download size={14} aria-hidden />
            CSV
          </button>
        </div>
      </div>

      {view === 'chart' ? (
        <>
          <div role="img" aria-label={summary} className="h-[28rem] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RRadarChart
                data={data}
                outerRadius="66%"
                margin={{ top: 16, right: 56, bottom: 16, left: 56 }}
              >
                <PolarGrid stroke="var(--border-strong)" />
                <PolarAngleAxis dataKey="axis" tick={<AngleTick />} />
                <PolarRadiusAxis
                  // Between two spokes, so the value labels never sit under an axis label.
                  angle={90 - 180 / axes.length}
                  domain={[0, 100]}
                  tickCount={5}
                  tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                  stroke="var(--border-strong)"
                />
                {series.map((s, j) => (
                  <Radar
                    key={s.name}
                    name={s.name}
                    dataKey={`s${j}`}
                    stroke={strokes[j % strokes.length]}
                    strokeWidth={2}
                    strokeDasharray={dashes[j % dashes.length]}
                    fill={strokes[j % strokes.length]}
                    fillOpacity={0.08}
                    isAnimationActive
                    animationDuration={700}
                    dot={(p: { cx?: number; cy?: number }) => (
                      <g key={`${j}-${p.cx}-${p.cy}`} transform={`translate(${p.cx},${p.cy})`}>
                        <Marker
                          shape={shapes[j % shapes.length]!}
                          color={strokes[j % strokes.length]!}
                        />
                      </g>
                    )}
                  />
                ))}
                <Tooltip
                  formatter={(v, n) => [`${v}${unit}`, String(n)]}
                  contentStyle={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 10,
                    color: 'var(--text)',
                  }}
                  labelStyle={{ color: 'var(--text)' }}
                  itemStyle={{ color: 'var(--text-2)' }}
                />
              </RRadarChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5" aria-label="Legend">
            {series.map((s, j) => (
              <li key={s.name} className="text-fg-2 flex items-center gap-2 text-xs">
                <svg width="28" height="12" aria-hidden>
                  <line
                    x1="0"
                    y1="6"
                    x2="28"
                    y2="6"
                    stroke={strokes[j % strokes.length]}
                    strokeWidth="2"
                    strokeDasharray={dashes[j % dashes.length]}
                  />
                  <g transform="translate(14,6)">
                    <Marker
                      shape={shapes[j % shapes.length]!}
                      color={strokes[j % strokes.length]!}
                      size={4}
                    />
                  </g>
                </svg>
                {s.name}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[320px] text-sm">
            <thead>
              <tr className="border-line text-fg-2 border-b text-left">
                <th scope="col" className="py-2 font-medium">
                  Benchmark
                </th>
                {series.map((s) => (
                  <th key={s.name} scope="col" className="py-2 text-right font-medium">
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {axes.map((a, i) => (
                <tr key={a} className="border-line/60 border-b">
                  <th scope="row" className="text-fg py-2 text-left font-normal">
                    {a}
                  </th>
                  {series.map((s) => (
                    <td key={s.name} className="text-fg py-2 text-right font-mono">
                      {s.values[i]}
                      {unit}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-muted mt-3 text-xs">{footnote}</p>
    </figure>
  );
}
