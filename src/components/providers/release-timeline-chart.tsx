import { Marker } from '@/components/charts/series-style';
import { formatDate } from '@/lib/format';
import { kindShape, layoutTimeline } from '@/lib/providers/timeline';
import type { ReleaseItem } from '@/types/catalog';
import { releaseKindLabel, type ReleaseKind } from '@/types/model';

const W = 1000;
const LANE_H = 38;
const TOP = 22;
const AXIS_GAP = 20;

const legendItems: { kind: ReleaseKind; label: string }[] = [
  { kind: 'MAJOR', label: 'Major release' },
  { kind: 'MINOR', label: 'Minor update' },
  { kind: 'CAPABILITY', label: 'Capability, API or docs change' },
  { kind: 'DEPRECATION', label: 'Deprecation or pricing change' },
];

/**
 * A provider's releases along a time axis. Position is the date; marker shape is the kind
 * (diamond major, circle minor, square capability/API/docs, triangle deprecation/pricing);
 * filled means confirmed and outlined means unconfirmed. Every marker is a link to the entry
 * in the list below and has a text tooltip, so nothing depends on colour or on hovering.
 * Server-rendered SVG: no JavaScript is needed.
 */
export function ReleaseTimelineChart({ releases }: { releases: ReleaseItem[] }) {
  const { points, ticks, lanes, from, to } = layoutTimeline(releases);
  if (points.length === 0) return null;
  const H = TOP + lanes * LANE_H + AXIS_GAP + 26;
  const axisY = TOP + lanes * LANE_H + AXIS_GAP;

  return (
    <figure className="border-line bg-card rounded-2xl border p-5">
      <figcaption className="text-fg mb-3 text-sm font-medium">
        Release timeline{' '}
        <span className="text-muted font-normal">
          ({points.length} {points.length === 1 ? 'release' : 'releases'}, {formatDate(from!)} to{' '}
          {formatDate(to!)})
        </span>
      </figcaption>
      {/* Wide enough that the axis text stays readable; narrow screens scroll the chart sideways. */}
      <div
        tabIndex={0}
        role="region"
        aria-label="Release timeline chart"
        className="overflow-x-auto"
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="group"
          aria-label={`Timeline of ${points.length} releases. Each marker links to its entry below.`}
          className="h-auto w-full min-w-[720px]"
        >
          <line x1="0" x2={W} y1={axisY} y2={axisY} stroke="var(--border-strong)" />
          {ticks.map((t) => (
            <g key={t.x} transform={`translate(${t.x * W},0)`}>
              <line y1={TOP - 8} y2={axisY} stroke="var(--border)" strokeDasharray="2 4" />
              <text
                y={axisY + 18}
                textAnchor="middle"
                fill="var(--text-2)"
                fontSize="16"
                fontFamily="var(--font-mono, monospace)"
              >
                {t.label}
              </text>
            </g>
          ))}
          {points.map((p) => (
            <a
              key={p.id}
              href={`#release-${p.id}`}
              className="outline-none [&:focus-visible_.ring]:opacity-100"
              aria-label={`${p.title}, ${formatDate(p.date)}, ${releaseKindLabel[p.kind]}, ${
                p.confirmed ? 'confirmed' : 'unconfirmed'
              }`}
            >
              <title>
                {`${p.title} (${formatDate(p.date)}) - ${releaseKindLabel[p.kind]}, ${
                  p.confirmed ? 'confirmed' : 'unconfirmed'
                }`}
              </title>
              <g transform={`translate(${p.x * W},${TOP + p.lane * LANE_H + LANE_H / 2})`}>
                <circle
                  className="ring"
                  r="17"
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="2"
                  opacity="0"
                />
                <circle r="18" fill="transparent" />
                <Marker
                  shape={kindShape[p.kind]}
                  color="var(--accent)"
                  size={7}
                  hollow={!p.confirmed}
                />
              </g>
            </a>
          ))}
        </svg>
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5" aria-label="Legend">
        {legendItems.map((l) => (
          <li key={l.kind} className="text-fg-2 flex items-center gap-2 text-xs">
            <svg width="16" height="16" aria-hidden>
              <g transform="translate(8,8)">
                <Marker shape={kindShape[l.kind]} color="var(--accent)" size={5} />
              </g>
            </svg>
            {l.label}
          </li>
        ))}
        <li className="text-fg-2 flex items-center gap-2 text-xs">
          <svg width="16" height="16" aria-hidden>
            <g transform="translate(8,8)">
              <Marker shape="circle" color="var(--accent)" size={5} hollow />
            </g>
          </svg>
          Outlined = unconfirmed
        </li>
      </ul>
      <p className="text-muted mt-3 text-xs">
        Position is the release date. Only releases confirmed by an official or independent source
        are drawn filled.
      </p>
    </figure>
  );
}
