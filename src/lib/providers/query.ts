import type { ProviderSummary } from '@/types/catalog';

/**
 * URL state and filtering for the provider directory (`/providers?q&type&page`). Tolerant
 * parsing like the other explorers; filtering is pure so it is unit tested without a database.
 */

export const PROVIDERS_PAGE_SIZE = 24;

export const orgTypeLabel: Record<string, string> = {
  COMPANY: 'Company',
  NONPROFIT: 'Non-profit',
  ACADEMIC: 'Academic',
  RESEARCH_LAB: 'Research lab',
  OPEN_SOURCE: 'Open source',
  GOVERNMENT: 'Government',
  OTHER: 'Other',
};

export const orgTypeText = (t: string): string =>
  orgTypeLabel[t] ?? t.charAt(0) + t.slice(1).toLowerCase().replaceAll('_', ' ');

export type ProvidersQuery = { q: string; type: string | null; page: number };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const TYPE = /^[A-Z_]{2,30}$/;

export function parseProvidersQuery(
  sp: Record<string, string | string[] | undefined>,
): ProvidersQuery {
  const type = first(sp.type)?.trim().toUpperCase();
  const page = Number(first(sp.page));
  return {
    q: (first(sp.q) ?? '').trim().slice(0, 100),
    type: type && TYPE.test(type) ? type : null,
    page: Number.isInteger(page) && page >= 1 && page <= 10_000 ? page : 1,
  };
}

export function providersHref(q: Partial<ProvidersQuery>): string {
  const params = new URLSearchParams();
  if (q.q) params.set('q', q.q);
  if (q.type) params.set('type', q.type.toLowerCase());
  if (q.page && q.page > 1) params.set('page', String(q.page));
  const s = params.toString();
  return s ? `/providers?${s}` : '/providers';
}

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');

/** Every whitespace-separated search token must appear in the name, description or org type. */
export function filterProviders(all: ProviderSummary[], q: ProvidersQuery): ProviderSummary[] {
  const tokens = norm(q.q).split(/\s+/).filter(Boolean);
  return all.filter((p) => {
    if (q.type && p.orgType !== q.type) return false;
    if (tokens.length === 0) return true;
    const hay = norm(`${p.name} ${p.description} ${orgTypeText(p.orgType)}`);
    return tokens.every((t) => hay.includes(t));
  });
}

/** Org types present, with counts, for the type chips. */
export function orgTypeFacets(all: ProviderSummary[]): { type: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const p of all) counts.set(p.orgType, (counts.get(p.orgType) ?? 0) + 1);
  return [...counts]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => orgTypeText(a.type).localeCompare(orgTypeText(b.type)));
}

export function pageOf<T>(items: T[], page: number, size: number) {
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(page, pageCount);
  return { items: items.slice((current - 1) * size, current * size), page: current, pageCount };
}
