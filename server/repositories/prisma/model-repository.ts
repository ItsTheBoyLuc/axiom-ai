import type { Prisma } from '../../../prisma/generated/client';
import type {
  Category as DbCategory,
  Deployment as DbDeployment,
  PricingKind as DbPricingKind,
} from '../../../prisma/generated/enums';
import { pickLatest } from '../../../src/lib/models/benchmarks';
import { escapeLike, searchTokens } from '../../../src/lib/text';
import {
  CAPABILITIES,
  CATEGORIES,
  DEPLOYMENTS,
  PRICING_KINDS,
  capabilityLabel,
  categoryLabel,
  deploymentLabel,
  pricingKindLabel,
  type BenchmarkOption,
  type Capability,
  type Category,
  type FacetOption,
  type ModelFacets,
  type ModelListItem,
  type ModelQuery,
  type ModelSuggestion,
} from '../../../src/types/model';
import type { Db } from '../../db/client';
import { fromDbEnums, isoDateTimeOrNull, toDbEnums } from '../../db/mappers';
import {
  byName,
  paginate,
  rankRelated,
  rankSuggestions,
  type Dimension,
  type SearchFields,
} from '../model-query';
import type { ModelRepository } from '../model-repository';
import { detailSelect, listSelect, toDetail, toListItem } from './model-mappers';

const TIE_BREAK = [{ sortName: 'asc' }, { slug: 'asc' }] as const;
/** Candidates fetched from SQL before in-memory ranking for suggest/related. */
const SUGGEST_CANDIDATES = 200;
const RELATED_CANDIDATES = 500;

/**
 * WHERE clause for a directory query. `skip` omits one filter group (used for facet counts).
 * Semantics match server/repositories/model-query.ts exactly: OR within a group, AND across.
 * Search is one substring test per token against the normalised `searchDocument` column
 * (backed by a pg_trgm GIN index).
 */
export function buildWhere(q: ModelQuery, skip?: Dimension): Prisma.ModelWhereInput {
  const and: Prisma.ModelWhereInput[] = searchTokens(q.q).map((t) => ({
    searchDocument: { contains: escapeLike(t) },
  }));

  if (skip !== 'provider' && q.provider.length) {
    const slugs = q.provider.filter((p) => p !== 'other');
    const or: Prisma.ModelWhereInput[] = [];
    if (slugs.length) or.push({ provider: { slug: { in: slugs } } });
    if (q.provider.includes('other')) or.push({ provider: { isListed: false } });
    and.push({ OR: or });
  }
  if (skip !== 'category' && q.category.length) {
    and.push({ categories: { hasSome: toDbEnums(q.category) as DbCategory[] } });
  }
  if (skip !== 'capability' && q.capability.length) {
    and.push({
      capabilities: {
        some: {
          availability: { not: 'NOT_AVAILABLE' },
          capability: { name: { in: q.capability } },
        },
      },
    });
  }
  if (skip !== 'deployment' && q.deployment.length) {
    and.push({ deployment: { hasSome: toDbEnums(q.deployment) as DbDeployment[] } });
  }
  if (skip !== 'pricing' && q.pricing.length) {
    and.push({ pricingKind: { in: toDbEnums(q.pricing) as DbPricingKind[] } });
  }
  return and.length ? { AND: and } : {};
}

function buildOrderBy(q: ModelQuery): Prisma.ModelOrderByWithRelationInput[] {
  switch (q.sort) {
    case 'alpha':
      return [...TIE_BREAK];
    case 'provider':
      return [{ provider: { sortName: 'asc' } }, ...TIE_BREAK];
    case 'updated':
      return [{ updatedAt: 'desc' }, ...TIE_BREAK];
    case 'context':
      return [{ contextWindow: { sort: 'desc', nulls: 'last' } }, ...TIE_BREAK];
    case 'recent':
    default:
      return [{ releaseDate: 'desc' }, ...TIE_BREAK];
  }
}

const toFacet = <T extends string>(
  values: readonly T[],
  labels: Record<T, string>,
  counts: Map<string, number>,
): FacetOption[] => values.map((v) => ({ value: v, label: labels[v], count: counts.get(v) ?? 0 }));

function tally(values: string[][]): Map<string, number> {
  const m = new Map<string, number>();
  for (const list of values) for (const v of new Set(list)) m.set(v, (m.get(v) ?? 0) + 1);
  return m;
}

/**
 * PostgreSQL implementation of ModelRepository.
 *
 * Query budget (constant, independent of page size or result count, so no N+1):
 *   list        ~ 2 + relations for the page + 6 facet queries (run in parallel)
 *   getBySlug   1 + relations (capabilities, pricing, results, releases)
 *   suggest     1 + relations
 * `select` is always explicit (see model-mappers.ts): the search blob is never returned.
 */
export function createPrismaModelRepository(db: Db): ModelRepository {
  async function loadItems(ids: string[]): Promise<ModelListItem[]> {
    if (ids.length === 0) return [];
    const rows = await db.model.findMany({
      where: { id: { in: ids } },
      select: { id: true, ...listSelect },
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids.flatMap((id) => {
      const r = byId.get(id);
      return r ? [toListItem(r)] : [];
    });
  }

  async function facets(q: ModelQuery): Promise<ModelFacets> {
    const [providers, prov, cat, cap, dep, price] = await Promise.all([
      db.provider.findMany({
        where: { models: { some: {} } },
        select: { slug: true, name: true, sortName: true, isListed: true },
      }),
      db.model.findMany({
        where: buildWhere(q, 'provider'),
        select: { provider: { select: { slug: true, isListed: true } } },
      }),
      db.model.findMany({ where: buildWhere(q, 'category'), select: { categories: true } }),
      db.model.findMany({
        where: buildWhere(q, 'capability'),
        select: {
          capabilities: {
            where: { availability: { not: 'NOT_AVAILABLE' } },
            select: { capability: { select: { name: true } } },
          },
        },
      }),
      db.model.findMany({ where: buildWhere(q, 'deployment'), select: { deployment: true } }),
      db.model.groupBy({
        by: ['pricingKind'],
        where: buildWhere(q, 'pricing'),
        _count: { _all: true },
      }),
    ]);

    const listed = providers
      .filter((p) => p.isListed)
      .sort((a, b) => (a.sortName < b.sortName ? -1 : a.sortName > b.sortName ? 1 : 0));
    const provCounts = new Map<string, number>();
    let otherCount = 0;
    for (const r of prov) {
      if (r.provider.isListed)
        provCounts.set(r.provider.slug, (provCounts.get(r.provider.slug) ?? 0) + 1);
      else otherCount++;
    }
    const provider: FacetOption[] = listed.map((p) => ({
      value: p.slug,
      label: p.name,
      count: provCounts.get(p.slug) ?? 0,
    }));
    if (providers.some((p) => !p.isListed))
      provider.push({ value: 'other', label: 'Other', count: otherCount });

    return {
      provider,
      category: toFacet(
        CATEGORIES,
        categoryLabel,
        tally(cat.map((r) => fromDbEnums<Category>(r.categories))),
      ),
      capability: toFacet(
        CAPABILITIES,
        capabilityLabel,
        tally(cap.map((r) => r.capabilities.map((c) => c.capability.name))),
      ),
      deployment: toFacet(
        DEPLOYMENTS,
        deploymentLabel,
        tally(dep.map((r) => fromDbEnums(r.deployment))),
      ),
      pricing: toFacet(
        PRICING_KINDS,
        pricingKindLabel,
        new Map(
          price.map((g) => [g.pricingKind.toLowerCase().replaceAll('_', '-'), g._count._all]),
        ),
      ),
    };
  }

  /** Sort by ONE benchmark: latest result per model (see pickLatest), models without one last. */
  async function benchmarkPage(q: ModelQuery, where: Prisma.ModelWhereInput) {
    const models = await db.model.findMany({
      where,
      select: { id: true, slug: true, sortName: true },
    });
    const results = await db.benchmarkResult.findMany({
      where: { benchmark: { slug: q.benchmark! }, modelId: { in: models.map((m) => m.id) } },
      select: { modelId: true, score: true, evaluationDate: true, evaluationType: true },
    });
    const byModel = new Map<string, typeof results>();
    for (const r of results) byModel.set(r.modelId, [...(byModel.get(r.modelId) ?? []), r]);
    const score = (id: string) => {
      const latest = pickLatest(
        (byModel.get(id) ?? []).map((r) => ({
          score: r.score.toNumber(),
          evaluationDate: r.evaluationDate.toISOString().slice(0, 10),
          evaluationType: r.evaluationType,
        })),
      );
      return latest ? latest.score : null;
    };
    const ranked = models
      .map((m) => ({ ...m, s: score(m.id) }))
      .sort((a, b) => {
        if (a.s === null && b.s === null)
          return byName({ name: a.sortName, slug: a.slug }, { name: b.sortName, slug: b.slug });
        if (a.s === null) return 1;
        if (b.s === null) return -1;
        return (
          b.s - a.s ||
          byName({ name: a.sortName, slug: a.slug }, { name: b.sortName, slug: b.slug })
        );
      });
    return ranked.map((m) => m.id);
  }

  return {
    async list(q) {
      const where = buildWhere(q);
      const usesBenchmark = q.sort === 'benchmark' && !!q.benchmark;

      let total: number;
      let items: ModelListItem[];
      let page: number;
      let pageCount: number;

      if (usesBenchmark) {
        const ids = await benchmarkPage(q, where);
        total = ids.length;
        ({ page, pageCount } = paginate(total, q.page, q.pageSize));
        const start = (page - 1) * q.pageSize;
        items = await loadItems(ids.slice(start, start + q.pageSize));
      } else {
        total = await db.model.count({ where });
        const p = paginate(total, q.page, q.pageSize);
        page = p.page;
        pageCount = p.pageCount;
        const rows = await db.model.findMany({
          where,
          orderBy: buildOrderBy(q),
          skip: p.start,
          take: q.pageSize,
          select: listSelect,
        });
        items = rows.map(toListItem);
      }

      return {
        items,
        total,
        page,
        pageSize: q.pageSize,
        pageCount,
        facets: await facets(q),
        hasDemo: items.some((m) => m.isDemo),
      };
    },

    async getBySlug(slug) {
      const row = await db.model.findUnique({ where: { slug }, select: detailSelect });
      return row ? toDetail(row) : null;
    },

    async getManyBySlugs(slugs) {
      if (slugs.length === 0) return [];
      const rows = await db.model.findMany({
        where: { slug: { in: slugs } },
        select: detailSelect,
      });
      const bySlug = new Map(rows.map((r) => [r.slug, r]));
      return slugs.flatMap((s) => {
        const r = bySlug.get(s);
        return r ? [toDetail(r)] : [];
      });
    },

    async suggest(q, limit = 6): Promise<ModelSuggestion[]> {
      const tokens = searchTokens(q);
      if (tokens.length === 0) return [];
      const rows = await db.model.findMany({
        where: { AND: tokens.map((t) => ({ searchDocument: { contains: escapeLike(t) } })) },
        orderBy: [...TIE_BREAK],
        take: SUGGEST_CANDIDATES,
        select: {
          slug: true,
          name: true,
          family: true,
          description: true,
          categories: true,
          isDemo: true,
          provider: { select: { name: true } },
          capabilities: {
            where: { availability: { not: 'NOT_AVAILABLE' } },
            select: { capability: { select: { name: true } } },
          },
        },
      });
      const candidates = rows.map((r) => ({
        slug: r.slug,
        name: r.name,
        family: r.family,
        description: r.description,
        providerName: r.provider.name,
        categories: fromDbEnums<Category>(r.categories),
        capabilities: r.capabilities.map((c) => c.capability.name as Capability),
        isDemo: r.isDemo,
      })) satisfies (SearchFields & { slug: string; isDemo: boolean })[];
      return rankSuggestions(candidates, q, limit).map((m) => ({
        slug: m.slug,
        name: m.name,
        providerName: m.providerName,
        family: m.family,
        isDemo: m.isDemo,
      }));
    },

    async related(slug, limit = 3) {
      const self = await db.model.findUnique({
        where: { slug },
        select: {
          id: true,
          providerId: true,
          slug: true,
          name: true,
          categories: true,
          provider: { select: { slug: true } },
          capabilities: {
            where: { availability: { not: 'NOT_AVAILABLE' } },
            select: { capability: { select: { name: true } } },
          },
        },
      });
      if (!self) return [];
      const selfCaps = self.capabilities.map((c) => c.capability.name);
      const or: Prisma.ModelWhereInput[] = [{ providerId: self.providerId }];
      if (self.categories.length) or.push({ categories: { hasSome: self.categories } });
      if (selfCaps.length) {
        or.push({
          capabilities: {
            some: {
              availability: { not: 'NOT_AVAILABLE' },
              capability: { name: { in: selfCaps } },
            },
          },
        });
      }
      const rows = await db.model.findMany({
        where: { slug: { not: slug }, OR: or },
        orderBy: [...TIE_BREAK],
        take: RELATED_CANDIDATES,
        select: {
          id: true,
          slug: true,
          name: true,
          categories: true,
          provider: { select: { slug: true } },
          capabilities: {
            where: { availability: { not: 'NOT_AVAILABLE' } },
            select: { capability: { select: { name: true } } },
          },
        },
      });
      const shape = (r: {
        id: string;
        slug: string;
        name: string;
        categories: string[];
        provider: { slug: string };
        capabilities: { capability: { name: string } }[];
      }) => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        providerSlug: r.provider.slug,
        categories: fromDbEnums<Category>(r.categories),
        capabilities: r.capabilities.map((c) => c.capability.name as Capability),
      });
      const top = rankRelated(shape(self), rows.map(shape), limit);
      return loadItems(top.map((t) => t.id));
    },

    async benchmarks(): Promise<BenchmarkOption[]> {
      const rows = await db.benchmark.findMany({
        select: {
          slug: true,
          name: true,
          category: true,
          version: true,
          description: true,
          methodologyUrl: true,
        },
      });
      return rows.sort(byName);
    },

    async slugs() {
      const rows = await db.model.findMany({ select: { slug: true }, orderBy: { slug: 'asc' } });
      return rows.map((r) => r.slug);
    },

    async featured(limit) {
      const rows = await db.model.findMany({
        orderBy: [{ releaseDate: 'desc' }, ...TIE_BREAK],
        take: limit,
        select: listSelect,
      });
      return rows.map(toListItem);
    },

    async stats(now = new Date()) {
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
      const since = new Date(now.getTime() - 30 * 86_400_000);
      const [total, released, recent, benchmarks, demo, latest] = await Promise.all([
        db.model.count(),
        db.model.count({ where: { releaseDate: { gte: monthStart, lt: nextMonth } } }),
        db.model.count({ where: { updatedAt: { gte: since, lte: now } } }),
        db.benchmark.count(),
        db.model.count({ where: { isDemo: true } }),
        db.model.aggregate({ _max: { updatedAt: true } }),
      ]);
      return {
        total,
        releasedThisMonth: released,
        recentlyUpdated: recent,
        benchmarks,
        isDemo: demo > 0,
        lastDataUpdate: isoDateTimeOrNull(latest._max.updatedAt),
      };
    },
  };
}
