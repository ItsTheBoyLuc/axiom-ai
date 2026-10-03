import type { ReleaseItem } from '@/types/catalog';
import type { ReleaseKind } from '@/types/model';
import type { Shape } from '@/components/charts/series-style';

/**
 * Layout of a provider's release timeline chart (docs/PROMPT.md 7.4): positions along a time
 * axis, lanes so close releases do not overlap, and axis ticks. Pure geometry in 0..1 units;
 * the component maps it to SVG. Release kind is encoded by marker shape (never colour alone)
 * and confirmation by filled vs outlined.
 */

export const kindShape: Record<ReleaseKind, Shape> = {
  MAJOR: 'diamond',
  MINOR: 'circle',
  CAPABILITY: 'square',
  API_CHANGE: 'square',
  DOCS_UPDATE: 'square',
  DEPRECATION: 'triangle',
  PRICING_CHANGE: 'triangle',
};

export type TimelinePoint = {
  id: string;
  /** 0..1 along the axis. */
  x: number;
  /** Lane index, 0 is the top lane. */
  lane: number;
  date: string;
  title: string;
  kind: ReleaseKind;
  confirmed: boolean;
};
export type TimelineTick = { x: number; label: string };

export const MAX_LANES = 4;
/** Minimum horizontal distance (fraction of the axis) between two markers in one lane. */
const MIN_GAP = 0.04;
const PAD = 0.04;

const MS_DAY = 86_400_000;
const monthStart = (t: number) => {
  const d = new Date(t);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
};
const label = (t: number, withYear: boolean) =>
  new Date(t).toLocaleDateString('en-GB', {
    month: 'short',
    ...(withYear ? { year: '2-digit' as const } : {}),
    timeZone: 'UTC',
  });

/**
 * Weekly ticks ("4 Sep") for spans up to ~11 weeks, month ticks up to 9 months, quarter ticks up
 * to about 3 years, year ticks beyond that.
 */
export function axisTicks(minT: number, maxT: number): { t: number; label: string }[] {
  const spanDays = (maxT - minT) / MS_DAY;
  if (spanDays <= 75) {
    const out: { t: number; label: string }[] = [];
    for (let t = minT; t <= maxT; t += 7 * MS_DAY) {
      out.push({
        t,
        label: new Date(t).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          timeZone: 'UTC',
        }),
      });
    }
    return out;
  }
  const start = new Date(monthStart(minT));
  const out: { t: number; label: string }[] = [];
  const stepMonths = spanDays <= 270 ? 1 : spanDays <= 1100 ? 3 : 12;
  let y = start.getUTCFullYear();
  let m = start.getUTCMonth();
  if (stepMonths > 1) m -= m % (stepMonths === 12 ? 12 : stepMonths);
  for (let guard = 0; guard < 80; guard++) {
    const t = Date.UTC(y, m, 1);
    if (t > maxT) break;
    if (t >= minT) out.push({ t, label: label(t, stepMonths !== 1 || spanDays > 300) });
    m += stepMonths;
    y += Math.floor(m / 12);
    m %= 12;
  }
  return out;
}

export function layoutTimeline(releases: ReleaseItem[]): {
  points: TimelinePoint[];
  ticks: TimelineTick[];
  lanes: number;
  from: string | null;
  to: string | null;
} {
  if (releases.length === 0) return { points: [], ticks: [], lanes: 1, from: null, to: null };
  const sorted = [...releases].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  );
  const times = sorted.map((r) => Date.parse(`${r.date}T00:00:00Z`));
  const minT = times[0]!;
  const maxT = times[times.length - 1]!;
  const span = maxT - minT;
  const xOf = (t: number) => (span === 0 ? 0.5 : PAD + ((t - minT) / span) * (1 - 2 * PAD));

  const lastX: number[] = [];
  const points = sorted.map((r, i): TimelinePoint => {
    const x = xOf(times[i]!);
    let lane = lastX.findIndex((lx) => x - lx >= MIN_GAP);
    if (lane === -1)
      lane = lastX.length < MAX_LANES ? lastX.length : lastX.indexOf(Math.min(...lastX));
    lastX[lane] = x;
    return {
      id: r.id,
      x,
      lane,
      date: r.date,
      title: r.title,
      kind: r.kind,
      confirmed: r.confirmed,
    };
  });

  const ticks =
    span === 0
      ? [{ x: 0.5, label: label(minT, true) }]
      : axisTicks(minT, maxT).map((t) => ({ x: xOf(t.t), label: t.label }));
  return {
    points,
    ticks,
    lanes: Math.max(1, Math.min(MAX_LANES, lastX.length)),
    from: sorted[0]!.date,
    to: sorted[sorted.length - 1]!.date,
  };
}
