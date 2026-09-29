import { z } from 'zod';
import {
  CAPABILITIES,
  CATEGORIES,
  DEPLOYMENTS,
  PRICING_KINDS,
  SORTS,
  type ModelQuery,
} from '@/types/model';

export const DEFAULT_PAGE_SIZE = 9;
export const MAX_PAGE_SIZE = 48;
export const MAX_Q_LENGTH = 100;

export const defaultQuery: ModelQuery = {
  q: '',
  provider: [],
  category: [],
  capability: [],
  deployment: [],
  pricing: [],
  sort: 'recent',
  benchmark: null,
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
};

type RawParams = Record<string, string | string[] | undefined> | URLSearchParams;

function get(params: RawParams, key: string): string | undefined {
  if (params instanceof URLSearchParams) return params.get(key) ?? undefined;
  const v = params[key];
  return Array.isArray(v) ? v[0] : v;
}

/** "a,b,c" -> unique values that are members of `allowed` (unknown values are dropped). */
function list<T extends string>(raw: string | undefined, allowed: readonly T[]): T[] {
  if (!raw) return [];
  const set = new Set<T>();
  for (const part of raw.split(',')) {
    const v = part.trim() as T;
    if ((allowed as readonly string[]).includes(v)) set.add(v);
  }
  return [...set];
}

const slug = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/);
const intParam = (min: number, max: number, fallback: number) =>
  z
    .string()
    .regex(/^\d{1,6}$/)
    .transform(Number)
    .pipe(z.number().int().min(min).max(max))
    .catch(fallback);

/**
 * Parses URL search params into a validated ModelQuery. Never throws: invalid or unknown
 * values fall back to defaults so shared or hand-edited URLs still render.
 * `provider` accepts any slug plus the special value "other".
 */
export function parseModelQuery(params: RawParams): ModelQuery {
  const q = (get(params, 'q') ?? '').trim().slice(0, MAX_Q_LENGTH);

  const providerRaw = get(params, 'provider');
  const provider = providerRaw
    ? [
        ...new Set(
          providerRaw
            .split(',')
            .map((s) => s.trim())
            .filter((s) => slug.safeParse(s).success),
        ),
      ]
    : [];

  const sortRaw = get(params, 'sort');
  const sort = (SORTS as readonly string[]).includes(sortRaw ?? '')
    ? (sortRaw as ModelQuery['sort'])
    : defaultQuery.sort;

  const benchRaw = get(params, 'benchmark');
  const benchmark = benchRaw && slug.safeParse(benchRaw).success ? benchRaw : null;

  return {
    q,
    provider,
    category: list(get(params, 'category'), CATEGORIES),
    capability: list(get(params, 'capability'), CAPABILITIES),
    deployment: list(get(params, 'deployment'), DEPLOYMENTS),
    pricing: list(get(params, 'pricing'), PRICING_KINDS),
    // A benchmark sort without a benchmark is meaningless: fall back to the default.
    sort: sort === 'benchmark' && !benchmark ? defaultQuery.sort : sort,
    benchmark,
    page: intParam(1, 10_000, 1).parse(get(params, 'page') ?? '1'),
    pageSize: intParam(3, MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE).parse(
      get(params, 'pageSize') ?? String(DEFAULT_PAGE_SIZE),
    ),
  };
}

/**
 * Serialises a query to canonical search params: defaults omitted, list values sorted,
 * so equal queries always produce equal URLs.
 */
export function toSearchParams(query: Partial<ModelQuery>): URLSearchParams {
  const merged = { ...defaultQuery, ...query };
  const out = new URLSearchParams();
  if (merged.q) out.set('q', merged.q);
  for (const key of ['provider', 'category', 'capability', 'deployment', 'pricing'] as const) {
    const values = merged[key] as string[];
    if (values.length) out.set(key, [...values].sort().join(','));
  }
  if (merged.sort !== defaultQuery.sort) out.set('sort', merged.sort);
  if (merged.sort === 'benchmark' && merged.benchmark) out.set('benchmark', merged.benchmark);
  if (merged.page > 1) out.set('page', String(merged.page));
  if (merged.pageSize !== DEFAULT_PAGE_SIZE) out.set('pageSize', String(merged.pageSize));
  return out;
}

/** Number of active filter values (search and sort are not counted). */
export function activeFilterCount(q: ModelQuery): number {
  return (
    q.provider.length +
    q.category.length +
    q.capability.length +
    q.deployment.length +
    q.pricing.length
  );
}
