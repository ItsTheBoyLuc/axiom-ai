/**
 * Shared look of multi-series charts. Series are told apart by colour AND line dash AND marker
 * shape (docs/PROMPT.md 8: patterns or markers in addition to colour). Index i always maps to
 * the same triple, and the six triples are all different.
 */
const STROKES = [
  'var(--accent)',
  'var(--accent-2)',
  'var(--accent-3)',
  'var(--text-2)',
  'var(--ok)',
  'var(--warn)',
];
const DASHES = [undefined, '6 3', '2 3', '10 3 2 3'];
const SHAPES = ['circle', 'square', 'triangle', 'diamond'] as const;

export type Shape = (typeof SHAPES)[number];
export const MAX_STYLED_SERIES = STROKES.length;

export function seriesStyle(i: number): { stroke: string; dash: string | undefined; shape: Shape } {
  return {
    stroke: STROKES[i % STROKES.length]!,
    dash: DASHES[i % DASHES.length],
    shape: SHAPES[i % SHAPES.length]!,
  };
}

/**
 * A marker centred on (0, 0); wrap in a translated <g>. `hollow` draws an outline instead of a
 * fill (used for "unconfirmed" on the release timeline, so the state never depends on colour).
 */
export function Marker({
  shape,
  color,
  size = 5,
  hollow = false,
}: {
  shape: Shape;
  color: string;
  size?: number;
  hollow?: boolean;
}) {
  const s = size;
  const paint = hollow
    ? { fill: 'var(--bg-card)', stroke: color, strokeWidth: 2 }
    : { fill: color };
  switch (shape) {
    case 'square':
      return <rect x={-s} y={-s} width={s * 2} height={s * 2} {...paint} />;
    case 'triangle':
      return <polygon points={`0,${-s - 1} ${s + 1},${s} ${-s - 1},${s}`} {...paint} />;
    case 'diamond':
      return <polygon points={`0,${-s - 1} ${s + 1},0 0,${s + 1} ${-s - 1},0`} {...paint} />;
    default:
      return <circle r={s} {...paint} />;
  }
}

/** Legend: one entry per series with its line sample and marker. */
export function SeriesLegend({ names }: { names: string[] }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5" aria-label="Legend">
      {names.map((name, i) => {
        const s = seriesStyle(i);
        return (
          <li key={name} className="text-fg-2 flex items-center gap-2 text-xs">
            <svg width="28" height="12" aria-hidden>
              <line
                x1="0"
                y1="6"
                x2="28"
                y2="6"
                stroke={s.stroke}
                strokeWidth="2"
                strokeDasharray={s.dash}
              />
              <g transform="translate(14,6)">
                <Marker shape={s.shape} color={s.stroke} size={4} />
              </g>
            </svg>
            {name}
          </li>
        );
      })}
    </ul>
  );
}

export const tooltipStyle = {
  contentStyle: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-strong)',
    borderRadius: 10,
    color: 'var(--text)',
  },
  labelStyle: { color: 'var(--text)' },
  itemStyle: { color: 'var(--text-2)' },
} as const;

/** Chart header button style shared by the Table view / CSV controls. */
export const chartButton =
  'inline-flex h-8 items-center gap-1.5 rounded-md border border-line px-2.5 text-xs text-fg-2 hover:border-line-strong hover:text-fg';
