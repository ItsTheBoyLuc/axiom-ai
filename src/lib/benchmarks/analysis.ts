import { pickLatest } from '@/lib/models/benchmarks';
import type { BenchmarkResultRow } from '@/types/catalog';
import type { EvaluationType } from '@/types/model';
import type { ExplorerQuery } from './query';

/**
 * Pure analysis of the results of ONE benchmark for the explorer charts. Nothing here averages
 * or ranks across benchmarks, and nothing assumes a score direction (there is no "best"):
 * values are shown as published, per model, with their evaluation type.
 */

export type Row = BenchmarkResultRow;

/** Applies the explorer filters in memory (the API supports the same filters server-side). */
export function filterRows(rows: Row[], q: ExplorerQuery): Row[] {
  return rows.filter(
    (r) =>
      (!q.provider || r.provider.slug === q.provider) &&
      (!q.family || r.model.family.toLowerCase() === q.family.toLowerCase()) &&
      (!q.version || r.modelVersion === q.version) &&
      (!q.type || r.evaluationType === q.type) &&
      (!q.from || r.evaluationDate >= q.from) &&
      (!q.to || r.evaluationDate <= q.to),
  );
}

export type Facet = { value: string; label: string; count: number };
export type Facets = {
  providers: Facet[];
  families: Facet[];
  versions: Facet[];
  types: Facet[];
  minDate: string | null;
  maxDate: string | null;
};

const typeLabel: Record<EvaluationType, string> = {
  INDEPENDENT: 'Independent',
  PROVIDER_REPORTED: 'Provider reported',
  COMMUNITY: 'Community reported',
};

function tally(items: { value: string; label: string }[]): Facet[] {
  const map = new Map<string, Facet>();
  for (const i of items) {
    const cur = map.get(i.value);
    if (cur) cur.count++;
    else map.set(i.value, { ...i, count: 1 });
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/** Filter options for one benchmark's (unfiltered) results. */
export function facetsOf(rows: Row[]): Facets {
  const dates = rows.map((r) => r.evaluationDate).sort();
  return {
    providers: tally(rows.map((r) => ({ value: r.provider.slug, label: r.provider.name }))),
    families: tally(rows.map((r) => ({ value: r.model.family, label: r.model.family }))),
    versions: tally(rows.map((r) => ({ value: r.modelVersion, label: r.modelVersion }))),
    types: tally(
      rows.map((r) => ({ value: r.evaluationType, label: typeLabel[r.evaluationType] })),
    ),
    minDate: dates[0] ?? null,
    maxDate: dates[dates.length - 1] ?? null,
  };
}

/** The result that represents each model: newest date, then the more trusted evaluation type. */
export function latestPerModel(rows: Row[]): Row[] {
  const byModel = new Map<string, Row[]>();
  for (const r of rows) byModel.set(r.model.slug, [...(byModel.get(r.model.slug) ?? []), r]);
  return [...byModel.values()].map((g) => pickLatest(g)!);
}

/**
 * Charts need one unit. Returns the unit used by most rows (ties: alphabetical) with only the
 * rows in that unit, and lists the other units so the page can say what was left out.
 */
export function chartRows(rows: Row[]): { unit: string | null; rows: Row[]; otherUnits: string[] } {
  if (rows.length === 0) return { unit: null, rows: [], otherUnits: [] };
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.scoreUnit, (counts.get(r.scoreUnit) ?? 0) + 1);
  const [unit] = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]!;
  return {
    unit,
    rows: rows.filter((r) => r.scoreUnit === unit),
    otherUnits: [...counts.keys()].filter((u) => u !== unit).sort(),
  };
}

export const typeMix = (rows: Row[]): Record<EvaluationType, number> => {
  const out: Record<EvaluationType, number> = {
    INDEPENDENT: 0,
    PROVIDER_REPORTED: 0,
    COMMUNITY: 0,
  };
  for (const r of rows) out[r.evaluationType]++;
  return out;
};

// ---------------------------------------------------------------- history

export type HistoryPoint = {
  /** Evaluation date as epoch milliseconds (UTC midnight). */
  t: number;
  value: number;
  date: string;
  model: string;
  type: EvaluationType;
};
export type HistorySeries = { name: string; points: HistoryPoint[] };

export const MAX_HISTORY_SERIES = 6;

/**
 * Score over evaluation date, one series per model family (its model versions in time order).
 * A family with a single result is a single marker. Shows at most MAX_HISTORY_SERIES families
 * (most results first, then name); the rest are named in `omitted`. Needs at least two distinct
 * dates to say anything about time, otherwise `series` is empty.
 */
export function historySeries(rows: Row[]): { series: HistorySeries[]; omitted: string[] } {
  if (new Set(rows.map((r) => r.evaluationDate)).size < 2) return { series: [], omitted: [] };
  const byFamily = new Map<string, HistoryPoint[]>();
  for (const r of rows) {
    const p: HistoryPoint = {
      t: Date.parse(`${r.evaluationDate}T00:00:00Z`),
      value: r.score,
      date: r.evaluationDate,
      model: r.model.name,
      type: r.evaluationType,
    };
    byFamily.set(r.model.family, [...(byFamily.get(r.model.family) ?? []), p]);
  }
  const all = [...byFamily]
    .map(([name, points]) => ({ name, points: points.sort((a, b) => a.t - b.t) }))
    .sort((a, b) => b.points.length - a.points.length || a.name.localeCompare(b.name));
  return {
    series: all.slice(0, MAX_HISTORY_SERIES),
    omitted: all.slice(MAX_HISTORY_SERIES).map((s) => s.name),
  };
}

// ---------------------------------------------------------- distribution

export type Bin = { from: number; to: number; count: number; models: string[] };
export const MIN_DISTRIBUTION = 5;
export const MAX_BINS = 8;

/**
 * Histogram of one score per model. Needs at least MIN_DISTRIBUTION values (a histogram of two
 * or three numbers is noise); returns null below that. The bin count follows Sturges' rule,
 * limited to 3..MAX_BINS; the last bin includes the maximum.
 */
export function distribution(rows: Row[]): { bins: Bin[]; n: number } | null {
  const n = rows.length;
  if (n < MIN_DISTRIBUTION) return null;
  const values = rows.map((r) => r.score);
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max)
    return { bins: [{ from: min, to: max, count: n, models: rows.map((r) => r.model.name) }], n };
  const k = Math.min(MAX_BINS, Math.max(3, Math.ceil(Math.log2(n) + 1)));
  const width = (max - min) / k;
  const bins: Bin[] = Array.from({ length: k }, (_, i) => ({
    from: min + i * width,
    to: i === k - 1 ? max : min + (i + 1) * width,
    count: 0,
    models: [],
  }));
  for (const r of rows) {
    const i = Math.min(k - 1, Math.floor((r.score - min) / width));
    bins[i]!.count++;
    bins[i]!.models.push(r.model.name);
  }
  return { bins, n };
}

// ------------------------------------------------------ provider dots

export type ProviderDot = {
  /** Row index of the provider (alphabetical). */
  y: number;
  provider: string;
  model: string;
  score: number;
  type: EvaluationType;
  date: string;
};

/**
 * One dot per model (its latest result) grouped by provider, alphabetically. A dot plot rather
 * than a summary: nothing is aggregated and no direction of "better" is assumed. Needs two or
 * more providers to be a comparison.
 */
export function providerDots(rows: Row[]): { providers: string[]; dots: ProviderDot[] } {
  const providers = [...new Set(rows.map((r) => r.provider.name))].sort((a, b) =>
    a.localeCompare(b),
  );
  if (providers.length < 2) return { providers: [], dots: [] };
  return {
    providers,
    dots: rows
      .map((r) => ({
        y: providers.indexOf(r.provider.name),
        provider: r.provider.name,
        model: r.model.name,
        score: r.score,
        type: r.evaluationType,
        date: r.evaluationDate,
      }))
      .sort((a, b) => a.y - b.y || a.model.localeCompare(b.model)),
  };
}
