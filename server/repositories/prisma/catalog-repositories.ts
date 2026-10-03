import type { Prisma } from '../../../prisma/generated/client';
import { escapeLike, searchTokens } from '../../../src/lib/text';
import type { VerificationStatus } from '../../../src/lib/verification';
import type {
  BenchmarkResultRow,
  BenchmarkSummary,
  NewsCategoryKey,
  NewsItem,
  Page,
  ProviderDetail,
  ProviderSummary,
  ReleaseItem,
  SearchHit,
  SearchResults,
  SearchType,
} from '../../../src/types/catalog';
import { SEARCH_TYPES } from '../../../src/types/catalog';
import type { EvaluationType, ReleaseKind } from '../../../src/types/model';
import type { Db } from '../../db/client';
import { isoDate, isoDateTime, isoDateTimeOrNull, monogramOf } from '../../db/mappers';
import type {
  BenchmarkRepository,
  NewsRepository,
  ProviderRepository,
  ReleaseRepository,
  SearchRepository,
} from '../catalog';
import { byName, paginate } from '../model-query';
import type { ModelRepository } from '../model-repository';
import { listSelect, toListItem } from './model-mappers';

const TIE = [{ sortName: 'asc' }, { slug: 'asc' }] as const;

/** Every token must appear (case-insensitively) in at least one of the given text columns. */
function tokenFilter(q: string | undefined, fields: string[]): Record<string, unknown>[] {
  return searchTokens(q ?? '').map((t) => ({
    OR: fields.map((f) => ({ [f]: { contains: escapeLike(t), mode: 'insensitive' } })),
  }));
}

const pageOf = <T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
  pageCount: number,
): Page<T> => ({
  items,
  total,
  page,
  pageSize,
  pageCount,
});

// ------------------------------------------------------------------ providers

const providerSelect = {
  slug: true,
  name: true,
  monogram: true,
  description: true,
  isListed: true,
  officialWebsite: true,
  headquarters: true,
  orgType: true,
  verificationStatus: true,
  isDemo: true,
  _count: { select: { models: true } },
} satisfies Prisma.ProviderSelect;

type ProviderRow = Prisma.ProviderGetPayload<{ select: typeof providerSelect }>;

function mapProvider(r: ProviderRow): ProviderSummary {
  return {
    slug: r.slug,
    name: r.name,
    monogram: monogramOf(r.name, r.monogram),
    description: r.description,
    tier: r.isListed ? 'listed' : 'other',
    officialWebsite: r.officialWebsite,
    headquarters: r.headquarters,
    orgType: r.orgType,
    modelCount: r._count.models,
    verificationStatus: r.verificationStatus as VerificationStatus,
    isDemo: r.isDemo,
  };
}

const releaseSelect = {
  id: true,
  kind: true,
  releaseDate: true,
  title: true,
  description: true,
  announcementUrl: true,
  docsUrl: true,
  verificationStatus: true,
  isDemo: true,
  provider: { select: { slug: true, name: true } },
  model: { select: { slug: true, name: true } },
} satisfies Prisma.ReleaseSelect;

type ReleaseRow = Prisma.ReleaseGetPayload<{ select: typeof releaseSelect }>;

const CONFIRMED: VerificationStatus[] = ['OFFICIALLY_VERIFIED', 'INDEPENDENTLY_EVALUATED'];

function mapRelease(r: ReleaseRow): ReleaseItem {
  return {
    id: r.id,
    kind: r.kind as ReleaseKind,
    date: isoDate(r.releaseDate),
    title: r.title,
    description: r.description,
    announcementUrl: r.announcementUrl,
    docsUrl: r.docsUrl,
    provider: r.provider,
    model: r.model,
    confirmed: CONFIRMED.includes(r.verificationStatus as VerificationStatus),
    verificationStatus: r.verificationStatus as VerificationStatus,
    isDemo: r.isDemo,
  };
}

export function createPrismaProviderRepository(db: Db): ProviderRepository {
  return {
    async listAll() {
      const rows = await db.provider.findMany({ orderBy: [...TIE], select: providerSelect });
      return rows.map(mapProvider);
    },

    async list({ q, page, pageSize }) {
      const where = { AND: tokenFilter(q, ['name', 'description']) } as Prisma.ProviderWhereInput;
      const total = await db.provider.count({ where });
      const p = paginate(total, page, pageSize);
      const rows = await db.provider.findMany({
        where,
        orderBy: [...TIE],
        skip: p.start,
        take: pageSize,
        select: providerSelect,
      });
      return pageOf(rows.map(mapProvider), total, p.page, pageSize, p.pageCount);
    },

    async getBySlug(slug): Promise<ProviderDetail | null> {
      const r = await db.provider.findUnique({
        where: { slug },
        select: {
          ...providerSelect,
          logoUrl: true,
          sourceUrl: true,
          verifiedAt: true,
          collectedAt: true,
          models: { orderBy: [{ releaseDate: 'desc' }, ...TIE], take: 100, select: listSelect },
          releases: {
            orderBy: [{ releaseDate: 'desc' }, { id: 'asc' }],
            take: 10,
            select: releaseSelect,
          },
          publications: {
            orderBy: [{ publishedAt: 'desc' }, { id: 'asc' }],
            take: 10,
            select: { title: true, url: true, publishedAt: true, venue: true },
          },
        },
      });
      if (!r) return null;
      return {
        ...mapProvider(r),
        logoUrl: r.logoUrl,
        sourceUrl: r.sourceUrl,
        verifiedAt: isoDateTimeOrNull(r.verifiedAt),
        collectedAt: isoDateTime(r.collectedAt),
        models: r.models.map(toListItem),
        releases: r.releases.map(mapRelease),
        publications: r.publications.map((p) => ({
          title: p.title,
          url: p.url,
          publishedAt: isoDate(p.publishedAt),
          venue: p.venue,
        })),
      };
    },
  };
}

// ------------------------------------------------------------------ benchmarks

export function createPrismaBenchmarkRepository(db: Db): BenchmarkRepository {
  return {
    async list(): Promise<BenchmarkSummary[]> {
      // Two statements however many results exist: the benchmarks, and one grouped aggregate
      // computed in the database (never by loading every result).
      const [rows, stats] = await Promise.all([
        db.benchmark.findMany({
          select: {
            id: true,
            slug: true,
            name: true,
            category: true,
            version: true,
            description: true,
            methodologyUrl: true,
            verificationStatus: true,
            isDemo: true,
          },
        }),
        db.$queryRaw<
          {
            benchmarkId: string;
            n: bigint;
            models: bigint;
            latest: Date | null;
            independent: bigint;
            providerReported: bigint;
            community: bigint;
            units: string[];
          }[]
        >`
          SELECT r."benchmarkId" AS "benchmarkId",
                 count(*) AS n,
                 count(DISTINCT r."modelId") AS models,
                 max(r."evaluationDate") AS latest,
                 count(*) FILTER (WHERE r."evaluationType" = 'INDEPENDENT') AS independent,
                 count(*) FILTER (WHERE r."evaluationType" = 'PROVIDER_REPORTED') AS "providerReported",
                 count(*) FILTER (WHERE r."evaluationType" = 'COMMUNITY') AS community,
                 array_agg(DISTINCT r."scoreUnit" ORDER BY r."scoreUnit") AS units
          FROM "BenchmarkResult" r
          GROUP BY r."benchmarkId"
        `,
      ]);
      const byBenchmark = new Map(stats.map((s) => [s.benchmarkId, s]));
      return rows
        .map((r) => {
          const s = byBenchmark.get(r.id);
          return {
            slug: r.slug,
            name: r.name,
            category: r.category,
            version: r.version,
            description: r.description,
            methodologyUrl: r.methodologyUrl,
            resultCount: Number(s?.n ?? 0),
            modelCount: Number(s?.models ?? 0),
            latestDate: s?.latest ? isoDate(s.latest) : null,
            byType: {
              INDEPENDENT: Number(s?.independent ?? 0),
              PROVIDER_REPORTED: Number(s?.providerReported ?? 0),
              COMMUNITY: Number(s?.community ?? 0),
            },
            units: s?.units ?? [],
            verificationStatus: r.verificationStatus as VerificationStatus,
            isDemo: r.isDemo,
          };
        })
        .sort(byName);
    },

    async results(q) {
      const where: Prisma.BenchmarkResultWhereInput = {
        ...(q.benchmark ? { benchmark: { slug: q.benchmark } } : {}),
        ...(q.version ? { modelVersion: q.version } : {}),
        ...(q.from || q.to
          ? {
              evaluationDate: {
                ...(q.from ? { gte: new Date(`${q.from}T00:00:00Z`) } : {}),
                ...(q.to ? { lte: new Date(`${q.to}T00:00:00Z`) } : {}),
              },
            }
          : {}),
        ...(q.provider || q.family
          ? {
              model: {
                ...(q.provider ? { provider: { slug: q.provider } } : {}),
                ...(q.family ? { family: { equals: q.family, mode: 'insensitive' as const } } : {}),
              },
            }
          : {}),
      };
      const total = await db.benchmarkResult.count({ where });
      const p = paginate(total, q.page, q.pageSize);
      const rows = await db.benchmarkResult.findMany({
        where,
        orderBy: [{ evaluationDate: 'desc' }, { id: 'asc' }],
        skip: p.start,
        take: q.pageSize,
        select: {
          score: true,
          scoreUnit: true,
          evaluationDate: true,
          modelVersion: true,
          benchmarkVersion: true,
          methodologyNotes: true,
          evaluationType: true,
          sourceUrl: true,
          isDemo: true,
          benchmark: { select: { slug: true, name: true, category: true } },
          model: {
            select: {
              slug: true,
              name: true,
              family: true,
              version: true,
              provider: { select: { slug: true, name: true } },
            },
          },
        },
      });
      const items: BenchmarkResultRow[] = rows.map((r) => ({
        benchmarkSlug: r.benchmark.slug,
        benchmarkName: r.benchmark.name,
        category: r.benchmark.category,
        benchmarkVersion: r.benchmarkVersion,
        score: r.score.toNumber(),
        scoreUnit: r.scoreUnit,
        evaluationDate: isoDate(r.evaluationDate),
        modelVersion: r.modelVersion,
        methodologyNotes: r.methodologyNotes,
        evaluationType: r.evaluationType as EvaluationType,
        sourceUrl: r.sourceUrl,
        isDemo: r.isDemo,
        model: {
          slug: r.model.slug,
          name: r.model.name,
          family: r.model.family,
          version: r.model.version,
        },
        provider: r.model.provider,
      }));
      return pageOf(items, total, p.page, q.pageSize, p.pageCount);
    },
  };
}

// ------------------------------------------------------------------ releases and news

export function createPrismaReleaseRepository(db: Db): ReleaseRepository {
  return {
    async list(q) {
      const where = {
        AND: [
          ...tokenFilter(q.q, ['title', 'description']),
          ...(q.provider ? [{ provider: { slug: q.provider } }] : []),
          ...(q.category ? [{ kind: q.category }] : []),
          ...(q.from ? [{ releaseDate: { gte: new Date(`${q.from}T00:00:00Z`) } }] : []),
          ...(q.to ? [{ releaseDate: { lte: new Date(`${q.to}T00:00:00Z`) } }] : []),
        ],
      } as Prisma.ReleaseWhereInput;
      const total = await db.release.count({ where });
      const p = paginate(total, q.page, q.pageSize);
      const rows = await db.release.findMany({
        where,
        orderBy: [{ releaseDate: 'desc' }, { id: 'asc' }],
        skip: p.start,
        take: q.pageSize,
        select: releaseSelect,
      });
      return pageOf(rows.map(mapRelease), total, p.page, q.pageSize, p.pageCount);
    },
  };
}

export function createPrismaNewsRepository(db: Db): NewsRepository {
  return {
    async list(q) {
      const where = {
        AND: [
          ...tokenFilter(q.q, ['title', 'summary', 'publisher']),
          ...(q.provider ? [{ provider: { slug: q.provider } }] : []),
          ...(q.category ? [{ category: q.category }] : []),
        ],
      } as Prisma.NewsArticleWhereInput;
      const total = await db.newsArticle.count({ where });
      const p = paginate(total, q.page, q.pageSize);
      const rows = await db.newsArticle.findMany({
        where,
        orderBy: [{ publicationDate: 'desc' }, { id: 'asc' }],
        skip: p.start,
        take: q.pageSize,
        select: {
          id: true,
          title: true,
          summary: true,
          publisher: true,
          articleUrl: true,
          publicationDate: true,
          category: true,
          isOfficial: true,
          isAiSummary: true,
          verificationStatus: true,
          isDemo: true,
          provider: { select: { slug: true, name: true } },
          models: { select: { slug: true, name: true }, orderBy: { slug: 'asc' } },
        },
      });
      const items: NewsItem[] = rows.map((r) => ({
        id: r.id,
        title: r.title,
        summary: r.summary,
        publisher: r.publisher,
        url: r.articleUrl,
        publishedAt: isoDateTime(r.publicationDate),
        category: r.category as NewsCategoryKey,
        isOfficial: r.isOfficial,
        isAiSummary: r.isAiSummary,
        provider: r.provider,
        models: r.models,
        verificationStatus: r.verificationStatus as VerificationStatus,
        isDemo: r.isDemo,
      }));
      return pageOf(items, total, p.page, q.pageSize, p.pageCount);
    },
  };
}

// ------------------------------------------------------------------ search

/** Cross-entity search. Model hits reuse the model repository's ranking; the rest are token ILIKE. */
export function createPrismaSearchRepository(db: Db, models: ModelRepository): SearchRepository {
  return {
    async search(q, types, limit): Promise<SearchResults> {
      const want = new Set<SearchType>(types);
      const empty = Object.fromEntries(SEARCH_TYPES.map((t) => [t, [] as SearchHit[]])) as Record<
        SearchType,
        SearchHit[]
      >;
      if (searchTokens(q).length === 0) return { q, results: empty };

      const run = async <T>(type: SearchType, fn: () => Promise<T[]>, map: (x: T) => SearchHit) => {
        if (!want.has(type)) return;
        empty[type] = (await fn()).map(map);
      };
      const filter = (fields: string[]) => ({ AND: tokenFilter(q, fields) });

      await Promise.all([
        run(
          'models',
          () => models.suggest(q, limit),
          (m) => ({
            type: 'models',
            id: m.slug,
            title: m.name,
            subtitle: `${m.providerName} · ${m.family}`,
            href: `/models/${m.slug}`,
            isDemo: m.isDemo,
          }),
        ),
        run(
          'providers',
          () =>
            db.provider.findMany({
              where: filter(['name', 'description']) as Prisma.ProviderWhereInput,
              orderBy: [...TIE],
              take: limit,
              select: { slug: true, name: true, headquarters: true, isDemo: true },
            }),
          (p) => ({
            type: 'providers',
            id: p.slug,
            title: p.name,
            subtitle: p.headquarters,
            href: `/providers/${p.slug}`,
            isDemo: p.isDemo,
          }),
        ),
        run(
          'benchmarks',
          () =>
            db.benchmark.findMany({
              where: filter(['name', 'description']) as Prisma.BenchmarkWhereInput,
              orderBy: [{ name: 'asc' }, { slug: 'asc' }],
              take: limit,
              select: { slug: true, name: true, category: true, isDemo: true },
            }),
          (b) => ({
            type: 'benchmarks',
            id: b.slug,
            title: b.name,
            subtitle: b.category,
            href: `/benchmarks?benchmark=${b.slug}`,
            isDemo: b.isDemo,
          }),
        ),
        run(
          'releases',
          () =>
            db.release.findMany({
              where: filter(['title', 'description']) as Prisma.ReleaseWhereInput,
              orderBy: [{ releaseDate: 'desc' }, { id: 'asc' }],
              take: limit,
              select: {
                id: true,
                title: true,
                releaseDate: true,
                provider: { select: { name: true } },
                isDemo: true,
              },
            }),
          (r) => ({
            type: 'releases',
            id: r.id,
            title: r.title,
            subtitle: `${r.provider.name} · ${isoDate(r.releaseDate)}`,
            href: `/releases#${r.id}`,
            isDemo: r.isDemo,
          }),
        ),
        run(
          'news',
          () =>
            db.newsArticle.findMany({
              where: filter(['title', 'summary', 'publisher']) as Prisma.NewsArticleWhereInput,
              orderBy: [{ publicationDate: 'desc' }, { id: 'asc' }],
              take: limit,
              select: { id: true, title: true, publisher: true, articleUrl: true, isDemo: true },
            }),
          (n) => ({
            type: 'news',
            id: n.id,
            title: n.title,
            subtitle: n.publisher,
            href: n.articleUrl,
            isDemo: n.isDemo,
          }),
        ),
        run(
          'research',
          () =>
            db.publication.findMany({
              where: filter(['title']) as Prisma.PublicationWhereInput,
              orderBy: [{ publishedAt: 'desc' }, { id: 'asc' }],
              take: limit,
              select: { id: true, title: true, url: true, venue: true, isDemo: true },
            }),
          (p) => ({
            type: 'research',
            id: p.id,
            title: p.title,
            subtitle: p.venue,
            href: p.url,
            isDemo: p.isDemo,
          }),
        ),
      ]);
      return { q, results: empty };
    },
  };
}
