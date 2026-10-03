import { BENCHMARK_CATEGORIES, type BenchmarkCategoryKey } from '@/types/catalog';
import type { EvaluationType } from '@/types/model';

/**
 * URL state of the benchmark explorer (`/benchmarks?...`). Every control lives in the URL so a
 * view is shareable and the back button works. Parsing is tolerant (a hand-edited or stale URL
 * never errors; unknown values are dropped), mirroring the directory's URL parser.
 */

export const EVALUATION_TYPES = ['INDEPENDENT', 'PROVIDER_REPORTED', 'COMMUNITY'] as const;

export type ExplorerQuery = {
  category: BenchmarkCategoryKey | null;
  /** Selected benchmark slug; null shows the index. */
  benchmark: string | null;
  provider: string | null;
  family: string | null;
  /** Model version the result was measured on. */
  version: string | null;
  type: EvaluationType | null;
  /** Inclusive evaluation date range, YYYY-MM-DD. */
  from: string | null;
  to: string | null;
};

export const emptyQuery: ExplorerQuery = {
  category: null,
  benchmark: null,
  provider: null,
  family: null,
  version: null,
  type: null,
  from: null,
  to: null,
};

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TEXT = 100;

const first = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

function text(v: string | string[] | undefined): string | null {
  const s = first(v)?.trim();
  return s && s.length <= MAX_TEXT ? s : null;
}

/** A real calendar date in YYYY-MM-DD form, or null. */
function date(v: string | string[] | undefined): string | null {
  const s = first(v)?.trim();
  if (!s || !DATE.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : s;
}

export function parseExplorerQuery(
  sp: Record<string, string | string[] | undefined>,
): ExplorerQuery {
  const category = first(sp.category);
  const benchmark = text(sp.benchmark);
  const type = first(sp.type);
  let from = date(sp.from);
  let to = date(sp.to);
  if (from && to && from > to) [from, to] = [to, from]; // an inverted range is a typo, not an empty result
  return {
    category: BENCHMARK_CATEGORIES.includes(category as BenchmarkCategoryKey)
      ? (category as BenchmarkCategoryKey)
      : null,
    benchmark: benchmark && SLUG.test(benchmark) ? benchmark : null,
    provider: (() => {
      const p = text(sp.provider);
      return p && SLUG.test(p) ? p : null;
    })(),
    family: text(sp.family),
    version: text(sp.version),
    type: EVALUATION_TYPES.includes(type as EvaluationType) ? (type as EvaluationType) : null,
    from,
    to,
  };
}

/** Builds `/benchmarks?...` from a query, omitting empty values. */
export function explorerHref(q: Partial<ExplorerQuery>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v) params.set(k, v);
  const s = params.toString();
  return s ? `/benchmarks?${s}` : '/benchmarks';
}

/** True when any result filter (not category/benchmark) is active. */
export const hasFilters = (q: ExplorerQuery): boolean =>
  !!(q.provider || q.family || q.version || q.type || q.from || q.to);
