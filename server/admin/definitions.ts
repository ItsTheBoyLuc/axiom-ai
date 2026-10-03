import type { Prisma, PrismaClient } from '../../prisma/generated/client';
import type { SeedFile } from '../../prisma/seed/schemas';
import { escapeLike, searchTokens } from '../../src/lib/text';
import { fromDbEnum, fromDbEnums, isoDate, isoDateTime, isoDateTimeOrNull } from '../db/mappers';

/**
 * How each admin-editable entity is read, found and deleted. An admin record is exactly a seed
 * record (the shape in prisma/seed/schemas.ts) plus its database id, so ONE schema validates seed
 * files, admin edits and approved imports, and the data-integrity rules (docs/PROMPT.md 2) cannot
 * be bypassed by any of the three. Writes go through the seed loader (see records.ts).
 */

export const ADMIN_ENTITIES = [
  'providers',
  'models',
  'benchmarks',
  'benchmark-results',
  'pricing',
  'releases',
  'news',
  'publications',
] as const;
export type AdminEntity = (typeof ADMIN_ENTITIES)[number];
export const isAdminEntity = (s: string): s is AdminEntity =>
  (ADMIN_ENTITIES as readonly string[]).includes(s);

/** Either the client or a transaction: definitions work inside and outside transactions. */
export type Q = PrismaClient | Prisma.TransactionClient;

export type RecordSummary = {
  id: string;
  title: string;
  subtitle: string | null;
  verificationStatus: string;
  isDemo: boolean;
};
export type SeedRecord = Record<string, unknown>;

export type EntityDef = {
  label: string;
  singular: string;
  seedFile: SeedFile;
  /** Cache tags made stale by a write (docs/PROMPT.md 10: invalidation on writes). */
  tags: (record: SeedRecord) => string[];
  /** The record's natural identity (what the loader upserts on). */
  keyOf: (record: SeedRecord) => string;
  /** True when the key is the record's identity for good (slug, article URL): it cannot be edited. */
  immutableKey: boolean;
  list(
    db: Q,
    q: string,
    skip: number,
    take: number,
  ): Promise<{ rows: RecordSummary[]; total: number }>;
  get(db: Q, id: string): Promise<SeedRecord | null>;
  /** The id of the stored record with this record's natural key, if any. */
  findIdByKey(db: Q, record: SeedRecord): Promise<string | null>;
  /** A reason this record cannot be saved even though it is valid on its own (e.g. a second current price). */
  conflicts?(db: Q, record: SeedRecord, selfId: string | null): Promise<string | null>;
  /** Deletes inside a transaction. Returns a reason when the delete must be refused. */
  remove(tx: Prisma.TransactionClient, id: string): Promise<string | null>;
};

type Sourced = {
  sourceUrl: string | null;
  verificationStatus: string;
  verifiedAt: Date | null;
  collectedAt: Date;
  dataType: string | null;
  isDemo: boolean;
};
const sourced = (r: Sourced) => ({
  sourceUrl: r.sourceUrl,
  verificationStatus: r.verificationStatus,
  verifiedAt: isoDateTimeOrNull(r.verifiedAt),
  collectedAt: isoDateTime(r.collectedAt),
  dataType: r.dataType,
  isDemo: r.isDemo,
});

/** Every search token must appear in one of the columns (case-insensitive, LIKE-escaped). */
const tokens = (q: string, fields: string[]) =>
  searchTokens(q).map((t) => ({
    OR: fields.map((f) => ({ [f]: { contains: escapeLike(t), mode: 'insensitive' as const } })),
  }));

const num = (d: { toNumber(): number } | null) => (d ? d.toNumber() : null);

// ---------------------------------------------------------------- providers

const providerDef: EntityDef = {
  label: 'Providers',
  singular: 'provider',
  seedFile: 'providers',
  tags: () => ['providers', 'models', 'releases', 'news', 'research'],
  keyOf: (r) => String(r.slug),
  immutableKey: true,
  async list(db, q, skip, take) {
    const where = { AND: tokens(q, ['name', 'slug', 'description']) } as Prisma.ProviderWhereInput;
    const [rows, total] = await Promise.all([
      db.provider.findMany({ where, orderBy: [{ sortName: 'asc' }, { slug: 'asc' }], skip, take }),
      db.provider.count({ where }),
    ]);
    return {
      total,
      rows: rows.map((r) => ({
        id: r.id,
        title: r.name,
        subtitle: r.slug,
        verificationStatus: r.verificationStatus,
        isDemo: r.isDemo,
      })),
    };
  },
  async get(db, id) {
    const r = await db.provider.findUnique({ where: { id } });
    if (!r) return null;
    return {
      slug: r.slug,
      name: r.name,
      monogram: r.monogram,
      description: r.description,
      officialWebsite: r.officialWebsite,
      logoUrl: r.logoUrl,
      headquarters: r.headquarters,
      orgType: r.orgType,
      isListed: r.isListed,
      ...sourced(r),
    };
  },
  findIdByKey: async (db, rec) =>
    (await db.provider.findUnique({ where: { slug: String(rec.slug) }, select: { id: true } }))
      ?.id ?? null,
  async remove(tx, id) {
    const models = await tx.model.count({ where: { providerId: id } });
    if (models > 0)
      return `This provider still has ${models} model${models === 1 ? '' : 's'}. Delete or move them first.`;
    await tx.provider.delete({ where: { id } });
    return null;
  },
};

// ------------------------------------------------------------------- models

const modelDef: EntityDef = {
  label: 'Models',
  singular: 'model',
  seedFile: 'models',
  tags: (r) => ['models', 'providers', 'benchmarks', 'releases', 'news', `model:${String(r.slug)}`],
  keyOf: (r) => String(r.slug),
  immutableKey: true,
  async list(db, q, skip, take) {
    const where = {
      AND: tokens(q, ['name', 'slug', 'family', 'description']),
    } as Prisma.ModelWhereInput;
    const [rows, total] = await Promise.all([
      db.model.findMany({
        where,
        orderBy: [{ releaseDate: 'desc' }, { slug: 'asc' }],
        skip,
        take,
        include: { provider: { select: { name: true } } },
      }),
      db.model.count({ where }),
    ]);
    return {
      total,
      rows: rows.map((r) => ({
        id: r.id,
        title: r.name,
        subtitle: `${r.provider.name} · ${r.slug}`,
        verificationStatus: r.verificationStatus,
        isDemo: r.isDemo,
      })),
    };
  },
  async get(db, id) {
    const r = await db.model.findUnique({
      where: { id },
      include: {
        provider: { select: { slug: true } },
        capabilities: { include: { capability: { select: { name: true } } } },
      },
    });
    if (!r) return null;
    return {
      slug: r.slug,
      provider: r.provider.slug,
      name: r.name,
      family: r.family,
      version: r.version,
      description: r.description,
      categories: fromDbEnums(r.categories),
      releaseDate: isoDate(r.releaseDate),
      contextWindow: r.contextWindow,
      maxOutputTokens: r.maxOutputTokens,
      openWeights: r.openWeights,
      availability: r.availability,
      deployment: fromDbEnums(r.deployment),
      pricingKind: fromDbEnum(r.pricingKind),
      inputModalities: fromDbEnums(r.inputModalities),
      outputModalities: fromDbEnums(r.outputModalities),
      officialDocumentation: r.officialDocumentation,
      knowledgeCutoff: r.knowledgeCutoff,
      architecture: r.architecture,
      trainingInfo: r.trainingInfo,
      apiAvailability: r.apiAvailability,
      structuredOutput: r.structuredOutput,
      streaming: r.streaming,
      toolCalling: r.toolCalling,
      functionCalling: r.functionCalling,
      purpose: r.purpose,
      useCases: r.useCases,
      notableFeatures: r.notableFeatures,
      limitations: r.limitations,
      capabilities: r.capabilities
        .map((c) => ({
          name: c.capability.name,
          availability: c.availability,
          documentationUrl: c.documentationUrl,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      ...sourced(r),
    };
  },
  findIdByKey: async (db, rec) =>
    (await db.model.findUnique({ where: { slug: String(rec.slug) }, select: { id: true } }))?.id ??
    null,
  async remove(tx, id) {
    // Prices, results, releases and capabilities of a model go with it (ON DELETE CASCADE).
    await tx.model.delete({ where: { id } });
    return null;
  },
};

// --------------------------------------------------------------- benchmarks

const benchmarkDef: EntityDef = {
  label: 'Benchmarks',
  singular: 'benchmark',
  seedFile: 'benchmarks',
  tags: () => ['benchmarks', 'models'],
  keyOf: (r) => String(r.slug),
  immutableKey: true,
  async list(db, q, skip, take) {
    const where = { AND: tokens(q, ['name', 'slug', 'description']) } as Prisma.BenchmarkWhereInput;
    const [rows, total] = await Promise.all([
      db.benchmark.findMany({ where, orderBy: [{ name: 'asc' }, { slug: 'asc' }], skip, take }),
      db.benchmark.count({ where }),
    ]);
    return {
      total,
      rows: rows.map((r) => ({
        id: r.id,
        title: r.name,
        subtitle: `${r.category} · ${r.slug}`,
        verificationStatus: r.verificationStatus,
        isDemo: r.isDemo,
      })),
    };
  },
  async get(db, id) {
    const r = await db.benchmark.findUnique({ where: { id } });
    if (!r) return null;
    return {
      slug: r.slug,
      name: r.name,
      category: r.category,
      description: r.description,
      methodologyUrl: r.methodologyUrl,
      version: r.version,
      ...sourced(r),
    };
  },
  findIdByKey: async (db, rec) =>
    (await db.benchmark.findUnique({ where: { slug: String(rec.slug) }, select: { id: true } }))
      ?.id ?? null,
  async remove(tx, id) {
    const results = await tx.benchmarkResult.count({ where: { benchmarkId: id } });
    if (results > 0)
      return `This benchmark still has ${results} result${results === 1 ? '' : 's'}. Delete them first.`;
    await tx.benchmark.delete({ where: { id } });
    return null;
  },
};

// --------------------------------------------------------- benchmark results

const resultDef: EntityDef = {
  label: 'Benchmark results',
  singular: 'benchmark result',
  seedFile: 'benchmark-results',
  tags: (r) => ['benchmarks', 'models', `model:${String(r.model)}`],
  keyOf: (r) =>
    [r.model, r.benchmark, r.evaluationDate, r.evaluationType, r.modelVersion]
      .map(String)
      .join('|'),
  immutableKey: false,
  async list(db, q, skip, take) {
    const where = {
      AND: searchTokens(q).map((t) => ({
        OR: [
          { model: { slug: { contains: escapeLike(t), mode: 'insensitive' as const } } },
          { benchmark: { slug: { contains: escapeLike(t), mode: 'insensitive' as const } } },
          { modelVersion: { contains: escapeLike(t), mode: 'insensitive' as const } },
        ],
      })),
    } as Prisma.BenchmarkResultWhereInput;
    const [rows, total] = await Promise.all([
      db.benchmarkResult.findMany({
        where,
        orderBy: [{ evaluationDate: 'desc' }, { id: 'asc' }],
        skip,
        take,
        include: { model: { select: { slug: true } }, benchmark: { select: { slug: true } } },
      }),
      db.benchmarkResult.count({ where }),
    ]);
    return {
      total,
      rows: rows.map((r) => ({
        id: r.id,
        title: `${r.model.slug} on ${r.benchmark.slug}`,
        subtitle: `${num(r.score)}${r.scoreUnit} · ${r.evaluationType} · ${isoDate(r.evaluationDate)}`,
        verificationStatus: r.verificationStatus,
        isDemo: r.isDemo,
      })),
    };
  },
  async get(db, id) {
    const r = await db.benchmarkResult.findUnique({
      where: { id },
      include: { model: { select: { slug: true } }, benchmark: { select: { slug: true } } },
    });
    if (!r) return null;
    return {
      model: r.model.slug,
      benchmark: r.benchmark.slug,
      score: num(r.score),
      scoreUnit: r.scoreUnit,
      evaluationDate: isoDate(r.evaluationDate),
      modelVersion: r.modelVersion,
      benchmarkVersion: r.benchmarkVersion,
      methodologyNotes: r.methodologyNotes,
      evaluationType: r.evaluationType,
      ...sourced(r),
    };
  },
  async findIdByKey(db, rec) {
    const [m, b] = await Promise.all([
      db.model.findUnique({ where: { slug: String(rec.model) }, select: { id: true } }),
      db.benchmark.findUnique({ where: { slug: String(rec.benchmark) }, select: { id: true } }),
    ]);
    if (!m || !b) return null;
    const row = await db.benchmarkResult.findUnique({
      where: {
        modelId_benchmarkId_evaluationDate_evaluationType_modelVersion: {
          modelId: m.id,
          benchmarkId: b.id,
          evaluationDate: new Date(String(rec.evaluationDate)),
          evaluationType: rec.evaluationType as never,
          modelVersion: String(rec.modelVersion),
        },
      },
      select: { id: true },
    });
    return row?.id ?? null;
  },
  async remove(tx, id) {
    await tx.benchmarkResult.delete({ where: { id } });
    return null;
  },
};

// ------------------------------------------------------------------ pricing

const pricingDef: EntityDef = {
  label: 'Pricing',
  singular: 'price',
  seedFile: 'pricing',
  tags: (r) => ['models', `model:${String(r.model)}`],
  keyOf: (r) => [r.model, r.pricingType, r.unit, r.effectiveFrom].map(String).join('|'),
  immutableKey: false,
  async list(db, q, skip, take) {
    const where = {
      AND: searchTokens(q).map((t) => ({
        OR: [
          { model: { slug: { contains: escapeLike(t), mode: 'insensitive' as const } } },
          { unit: { contains: escapeLike(t), mode: 'insensitive' as const } },
        ],
      })),
    } as Prisma.PricingWhereInput;
    const [rows, total] = await Promise.all([
      db.pricing.findMany({
        where,
        orderBy: [{ effectiveFrom: 'desc' }, { id: 'asc' }],
        skip,
        take,
        include: { model: { select: { slug: true } } },
      }),
      db.pricing.count({ where }),
    ]);
    return {
      total,
      rows: rows.map((r) => ({
        id: r.id,
        title: `${r.model.slug} · ${r.pricingType}`,
        subtitle: `${r.price === null ? 'Not publicly disclosed' : `${num(r.price)} ${r.currency}`} ${r.unit}${r.isCurrent ? ' · current' : ''}`,
        verificationStatus: r.verificationStatus,
        isDemo: r.isDemo,
      })),
    };
  },
  async get(db, id) {
    const r = await db.pricing.findUnique({
      where: { id },
      include: { model: { select: { slug: true } } },
    });
    if (!r) return null;
    return {
      model: r.model.slug,
      pricingType: r.pricingType,
      price: num(r.price),
      currency: r.currency,
      unit: r.unit,
      effectiveFrom: isoDate(r.effectiveFrom),
      effectiveTo: r.effectiveTo ? isoDate(r.effectiveTo) : null,
      isCurrent: r.isCurrent,
      ...sourced(r),
    };
  },
  async findIdByKey(db, rec) {
    const m = await db.model.findUnique({
      where: { slug: String(rec.model) },
      select: { id: true },
    });
    if (!m) return null;
    const row = await db.pricing.findUnique({
      where: {
        modelId_pricingType_unit_effectiveFrom: {
          modelId: m.id,
          pricingType: rec.pricingType as never,
          unit: String(rec.unit),
          effectiveFrom: new Date(String(rec.effectiveFrom)),
        },
      },
      select: { id: true },
    });
    return row?.id ?? null;
  },
  async conflicts(db, rec, selfId) {
    if (rec.isCurrent !== true) return null;
    const m = await db.model.findUnique({
      where: { slug: String(rec.model) },
      select: { id: true },
    });
    if (!m) return null;
    const other = await db.pricing.findFirst({
      where: {
        modelId: m.id,
        pricingType: rec.pricingType as never,
        unit: String(rec.unit),
        isCurrent: true,
        ...(selfId ? { NOT: { id: selfId } } : {}),
      },
      select: { effectiveFrom: true },
    });
    return other
      ? `This model already has a current ${String(rec.pricingType).toLowerCase()} price for this unit (from ${isoDate(other.effectiveFrom)}). End it first: untick "current" and set its end date.`
      : null;
  },
  async remove(tx, id) {
    await tx.pricing.delete({ where: { id } });
    return null;
  },
};

// ----------------------------------------------------------------- releases

const releaseDef: EntityDef = {
  label: 'Releases',
  singular: 'release',
  seedFile: 'releases',
  tags: () => ['releases', 'providers', 'models'],
  keyOf: (r) => [r.provider, r.releaseDate, r.title].map(String).join('|'),
  immutableKey: false,
  async list(db, q, skip, take) {
    const where = { AND: tokens(q, ['title', 'description']) } as Prisma.ReleaseWhereInput;
    const [rows, total] = await Promise.all([
      db.release.findMany({
        where,
        orderBy: [{ releaseDate: 'desc' }, { id: 'asc' }],
        skip,
        take,
        include: { provider: { select: { name: true } } },
      }),
      db.release.count({ where }),
    ]);
    return {
      total,
      rows: rows.map((r) => ({
        id: r.id,
        title: r.title,
        subtitle: `${r.provider.name} · ${isoDate(r.releaseDate)} · ${r.kind}`,
        verificationStatus: r.verificationStatus,
        isDemo: r.isDemo,
      })),
    };
  },
  async get(db, id) {
    const r = await db.release.findUnique({
      where: { id },
      include: { provider: { select: { slug: true } }, model: { select: { slug: true } } },
    });
    if (!r) return null;
    return {
      provider: r.provider.slug,
      model: r.model?.slug ?? null,
      kind: r.kind,
      releaseDate: isoDate(r.releaseDate),
      title: r.title,
      description: r.description,
      announcementUrl: r.announcementUrl,
      docsUrl: r.docsUrl,
      ...sourced(r),
    };
  },
  async findIdByKey(db, rec) {
    const p = await db.provider.findUnique({
      where: { slug: String(rec.provider) },
      select: { id: true },
    });
    if (!p) return null;
    const row = await db.release.findUnique({
      where: {
        providerId_releaseDate_title: {
          providerId: p.id,
          releaseDate: new Date(String(rec.releaseDate)),
          title: String(rec.title),
        },
      },
      select: { id: true },
    });
    return row?.id ?? null;
  },
  async remove(tx, id) {
    await tx.release.delete({ where: { id } });
    return null;
  },
};

// --------------------------------------------------------------------- news

const newsDef: EntityDef = {
  label: 'News',
  singular: 'news story',
  seedFile: 'news',
  tags: () => ['news', 'providers'],
  keyOf: (r) => String(r.articleUrl),
  immutableKey: true,
  async list(db, q, skip, take) {
    const where = {
      AND: tokens(q, ['title', 'summary', 'publisher']),
    } as Prisma.NewsArticleWhereInput;
    const [rows, total] = await Promise.all([
      db.newsArticle.findMany({
        where,
        orderBy: [{ publicationDate: 'desc' }, { id: 'asc' }],
        skip,
        take,
      }),
      db.newsArticle.count({ where }),
    ]);
    return {
      total,
      rows: rows.map((r) => ({
        id: r.id,
        title: r.title,
        subtitle: `${r.publisher} · ${isoDate(r.publicationDate)}${r.isOfficial ? ' · official' : ''}`,
        verificationStatus: r.verificationStatus,
        isDemo: r.isDemo,
      })),
    };
  },
  async get(db, id) {
    const r = await db.newsArticle.findUnique({
      where: { id },
      include: {
        provider: { select: { slug: true } },
        models: { select: { slug: true }, orderBy: { slug: 'asc' } },
      },
    });
    if (!r) return null;
    return {
      title: r.title,
      summary: r.summary,
      publisher: r.publisher,
      articleUrl: r.articleUrl,
      publicationDate: isoDateTime(r.publicationDate),
      category: r.category,
      isOfficial: r.isOfficial,
      isAiSummary: r.isAiSummary,
      dateIsUpdated: r.dateIsUpdated,
      provider: r.provider?.slug ?? null,
      models: r.models.map((m) => m.slug),
      ...sourced(r),
    };
  },
  findIdByKey: async (db, rec) =>
    (
      await db.newsArticle.findUnique({
        where: { articleUrl: String(rec.articleUrl) },
        select: { id: true },
      })
    )?.id ?? null,
  async remove(tx, id) {
    await tx.newsArticle.delete({ where: { id } });
    return null;
  },
};

// ------------------------------------------------------------- publications

const publicationDef: EntityDef = {
  label: 'Publications',
  singular: 'publication',
  seedFile: 'publications',
  tags: () => ['research', 'providers'],
  keyOf: (r) => [r.provider, r.url].map(String).join('|'),
  immutableKey: false,
  async list(db, q, skip, take) {
    const where = { AND: tokens(q, ['title', 'venue']) } as Prisma.PublicationWhereInput;
    const [rows, total] = await Promise.all([
      db.publication.findMany({
        where,
        orderBy: [{ publishedAt: 'desc' }, { id: 'asc' }],
        skip,
        take,
        include: { provider: { select: { name: true } } },
      }),
      db.publication.count({ where }),
    ]);
    return {
      total,
      rows: rows.map((r) => ({
        id: r.id,
        title: r.title,
        subtitle: `${r.provider.name} · ${isoDate(r.publishedAt)}`,
        verificationStatus: r.verificationStatus,
        isDemo: r.isDemo,
      })),
    };
  },
  async get(db, id) {
    const r = await db.publication.findUnique({
      where: { id },
      include: { provider: { select: { slug: true } } },
    });
    if (!r) return null;
    return {
      provider: r.provider.slug,
      title: r.title,
      url: r.url,
      publishedAt: isoDate(r.publishedAt),
      venue: r.venue,
      ...sourced(r),
    };
  },
  async findIdByKey(db, rec) {
    const p = await db.provider.findUnique({
      where: { slug: String(rec.provider) },
      select: { id: true },
    });
    if (!p) return null;
    const row = await db.publication.findUnique({
      where: { providerId_url: { providerId: p.id, url: String(rec.url) } },
      select: { id: true },
    });
    return row?.id ?? null;
  },
  async remove(tx, id) {
    await tx.publication.delete({ where: { id } });
    return null;
  },
};

export const DEFINITIONS: Record<AdminEntity, EntityDef> = {
  providers: providerDef,
  models: modelDef,
  benchmarks: benchmarkDef,
  'benchmark-results': resultDef,
  pricing: pricingDef,
  releases: releaseDef,
  news: newsDef,
  publications: publicationDef,
};
