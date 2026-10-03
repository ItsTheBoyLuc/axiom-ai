import { latestBenchmarkResult } from '@/lib/models/benchmarks';
import { TOKEN_UNIT, estimatorUnit } from '@/lib/pricing';
import type { BenchmarkResult, ModelDetail } from '@/types/model';
import { benchmarkCaveat } from './table';
import { evaluationTypeLabel } from './values';

/**
 * Chart data for /compare as plain objects (docs/PROMPT.md 7.5 and 8). Pure, so every rule that
 * keeps a chart honest is unit tested: a model without a value is left out and named, never
 * drawn as zero; incompatible values are never put on one axis.
 */

export type BarPoint = { label: string; value: number };

export const MAX_RADAR_AXES = 8;
export const MIN_RADAR_AXES = 3;

export type ContextSeries = { data: BarPoint[]; omitted: string[] };

export function contextSeries(models: ModelDetail[]): ContextSeries {
  const data: BarPoint[] = [];
  const omitted: string[] = [];
  for (const m of models) {
    if (m.contextWindow === null) omitted.push(m.name);
    else data.push({ label: m.name, value: m.contextWindow });
  }
  return { data, omitted };
}

export type PriceSeries =
  | { ok: true; data: BarPoint[]; currency: string; omitted: string[] }
  | { ok: false; reason: string; omitted: string[] };

/** The part of a unit after "per 1M tokens", e.g. "(Standard tier)" -> "Standard tier". */
const qualifierOf = (unit: string): string =>
  unit.startsWith(TOKEN_UNIT)
    ? unit
        .slice(TOKEN_UNIT.length)
        .trim()
        .replace(/^\(|\)$/g, '')
    : unit;

/**
 * Current per-1M-token price of one type per model, using the same single-unit rule as the
 * cost estimator. Models with tiers, no price or an undisclosed price are named in `omitted`.
 * Mixed currencies are never put on one axis.
 */
export function priceSeries(models: ModelDetail[], type: 'INPUT' | 'OUTPUT'): PriceSeries {
  const data: (BarPoint & { currency: string })[] = [];
  const omitted: string[] = [];
  for (const m of models) {
    const unit = estimatorUnit(m.pricing);
    const entry = unit
      ? m.pricing.find((p) => p.isCurrent && p.type === type && p.unit === unit)
      : undefined;
    if (!entry || entry.price === null || !unit) {
      omitted.push(m.name);
      continue;
    }
    const q = qualifierOf(unit);
    data.push({
      label: q ? `${m.name}\n${q}` : m.name,
      value: entry.price,
      currency: entry.currency,
    });
  }
  const currencies = new Set(data.map((d) => d.currency));
  if (currencies.size > 1) {
    return { ok: false, reason: 'The models list prices in different currencies.', omitted };
  }
  if (data.length === 0) {
    return { ok: false, reason: 'No selected model lists a flat per-token price.', omitted };
  }
  return {
    ok: true,
    data: data.map(({ label, value }) => ({ label, value })),
    currency: [...currencies][0]!,
    omitted,
  };
}

export type BenchmarkOption = { slug: string; name: string; count: number };

/** Benchmarks at least two selected models have a result for (a chart needs something to compare). */
export function benchmarkOptions(models: ModelDetail[]): BenchmarkOption[] {
  const seen = new Map<string, BenchmarkOption>();
  for (const m of models) {
    for (const slug of new Set(m.benchmarks.map((b) => b.benchmarkSlug))) {
      const name = m.benchmarks.find((b) => b.benchmarkSlug === slug)!.benchmarkName;
      const cur = seen.get(slug);
      seen.set(slug, { slug, name, count: (cur?.count ?? 0) + 1 });
    }
  }
  return [...seen.values()]
    .filter((o) => o.count >= 2)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export type BenchmarkSeries =
  | {
      ok: true;
      name: string;
      unit: string;
      data: BarPoint[];
      omitted: string[];
      caveat: string | null;
      sources: { model: string; result: BenchmarkResult }[];
    }
  | { ok: false; reason: string };

/**
 * One benchmark across the selected models. Each bar's label carries the evaluation type and
 * date so provider-reported and independent scores are never visually equated. Models without a
 * result are listed in `omitted`. Different score units cannot share an axis.
 */
export function benchmarkSeries(models: ModelDetail[], slug: string): BenchmarkSeries {
  const found = models
    .map((m) => ({ model: m.name, result: latestBenchmarkResult(m.benchmarks, slug) }))
    .filter((x): x is { model: string; result: BenchmarkResult } => x.result !== null);
  const omitted = models.filter((m) => !found.some((f) => f.model === m.name)).map((m) => m.name);
  if (found.length === 0) return { ok: false, reason: 'No selected model has a result.' };
  if (new Set(found.map((f) => f.result.scoreUnit)).size > 1) {
    return { ok: false, reason: 'The models report this benchmark in different units.' };
  }
  return {
    ok: true,
    name: found[0]!.result.benchmarkName,
    unit: found[0]!.result.scoreUnit,
    data: found.map((f) => ({
      label: `${f.model}\n${evaluationTypeLabel[f.result.evaluationType]} · ${f.result.evaluationDate}`,
      value: f.result.score,
    })),
    omitted,
    caveat: benchmarkCaveat(found.map((f) => f.result)),
    sources: found,
  };
}

export type RadarData =
  | {
      ok: true;
      axes: { slug: string; name: string }[];
      series: { name: string; values: number[] }[];
      /** How many benchmarks qualified (axes shown is capped at MAX_RADAR_AXES). */
      eligible: number;
    }
  | { ok: false; reason: string };

/**
 * Radar chart input. A benchmark becomes an axis only when every selected model has a result,
 * the unit is "%" (an intrinsic 0-100 scale, so nothing is rescaled), the scores are inside
 * 0-100, and all results share one evaluation type and benchmark version. No averaging, no
 * weights, no combined score. Otherwise the radar is not offered and the reason is stated.
 */
export function radarData(models: ModelDetail[]): RadarData {
  if (models.length < 2) return { ok: false, reason: 'Select at least two models.' };
  const slugs = [...new Set(models.flatMap((m) => m.benchmarks.map((b) => b.benchmarkSlug)))];
  const axes: { slug: string; name: string; scores: number[] }[] = [];
  for (const slug of slugs) {
    const results = models.map((m) => latestBenchmarkResult(m.benchmarks, slug));
    if (results.some((r) => r === null)) continue;
    const rs = results as BenchmarkResult[];
    const ok =
      rs.every((r) => r.scoreUnit === '%' && r.score >= 0 && r.score <= 100) &&
      new Set(rs.map((r) => r.evaluationType)).size === 1 &&
      new Set(rs.map((r) => r.benchmarkVersion ?? '')).size === 1;
    if (ok) axes.push({ slug, name: rs[0]!.benchmarkName, scores: rs.map((r) => r.score) });
  }
  if (axes.length < MIN_RADAR_AXES) {
    return {
      ok: false,
      reason: `A radar needs at least ${MIN_RADAR_AXES} benchmarks that every selected model has, scored in % under the same evaluation type and version. Only ${axes.length} qualify.`,
    };
  }
  axes.sort((a, b) => a.name.localeCompare(b.name));
  const shown = axes.slice(0, MAX_RADAR_AXES);
  return {
    ok: true,
    axes: shown.map(({ slug, name }) => ({ slug, name })),
    series: models.map((m, i) => ({ name: m.name, values: shown.map((a) => a.scores[i]!) })),
    eligible: axes.length,
  };
}
