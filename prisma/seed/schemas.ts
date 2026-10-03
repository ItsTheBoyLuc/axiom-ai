import { z } from 'zod';
import { VERIFICATION_STATUSES } from '../../src/lib/verification';
import {
  AVAILABILITIES,
  CAPABILITIES,
  CATEGORIES,
  DEPLOYMENTS,
  MODALITIES,
  PRICING_KINDS,
  RELEASE_KINDS,
  type CapabilityAvailability,
} from '../../src/types/model';
import { BENCHMARK_CATEGORIES, NEWS_CATEGORIES } from '../../src/types/catalog';

/**
 * Seed data schemas (docs/PROMPT.md section 2). Data files in prisma/seed/data/*.json are
 * validated with these BEFORE anything is written. The core rule: a record without a
 * sourceUrl is rejected unless its status is UNVERIFIED or NOT_PUBLICLY_DISCLOSED.
 */

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be a kebab-case slug');
const text = (max = 2000) => z.string().trim().min(1).max(max);
const httpUrl = z.url().refine((u) => /^https?:\/\//i.test(u), 'must be an http(s) URL');
const isoDate = z.iso.date();
const isoDateTime = z.iso.datetime({ offset: true });
const dateOrDateTime = z.union([isoDate, isoDateTime]);

export const verificationStatus = z.enum(VERIFICATION_STATUSES);

/** Statuses that are allowed to have no source URL. */
const SOURCE_OPTIONAL = new Set(['UNVERIFIED', 'NOT_PUBLICLY_DISCLOSED']);
/** Statuses that must state when they were verified. */
const NEEDS_VERIFIED_AT = new Set(['OFFICIALLY_VERIFIED', 'INDEPENDENTLY_EVALUATED']);

/** Fields every factual record carries (the sourced-record mixin). */
const sourcedShape = {
  sourceUrl: httpUrl.nullable().default(null),
  verificationStatus: verificationStatus.default('UNVERIFIED'),
  verifiedAt: isoDateTime.nullable().default(null),
  collectedAt: isoDateTime,
  dataType: z.string().max(100).nullable().default(null),
  isDemo: z.boolean().default(false),
};

type Sourced = {
  sourceUrl: string | null;
  verificationStatus: string;
  verifiedAt: string | null;
  isDemo: boolean;
};

/** The section 2 rules, applied to every factual record. */
function sourcedRules(v: Sourced, ctx: z.RefinementCtx) {
  if (v.sourceUrl === null && !SOURCE_OPTIONAL.has(v.verificationStatus)) {
    ctx.addIssue({
      code: 'custom',
      path: ['sourceUrl'],
      message: `sourceUrl is required unless verificationStatus is UNVERIFIED or NOT_PUBLICLY_DISCLOSED (got ${v.verificationStatus})`,
    });
  }
  if (NEEDS_VERIFIED_AT.has(v.verificationStatus) && v.verifiedAt === null) {
    ctx.addIssue({
      code: 'custom',
      path: ['verifiedAt'],
      message: `verifiedAt is required for ${v.verificationStatus}`,
    });
  }
  if (v.isDemo && NEEDS_VERIFIED_AT.has(v.verificationStatus)) {
    ctx.addIssue({
      code: 'custom',
      path: ['isDemo'],
      message: 'demo records can never be marked as verified',
    });
  }
}

export const providerSchema = z
  .object({
    slug,
    name: text(200),
    monogram: z.string().trim().min(1).max(2).nullable().default(null),
    description: text(),
    officialWebsite: httpUrl.nullable().default(null),
    logoUrl: httpUrl.nullable().default(null),
    headquarters: text(200).nullable().default(null),
    orgType: z
      .enum([
        'COMPANY',
        'NONPROFIT',
        'ACADEMIC',
        'RESEARCH_LAB',
        'OPEN_SOURCE',
        'GOVERNMENT',
        'OTHER',
      ])
      .default('COMPANY'),
    isListed: z.boolean().default(true),
    ...sourcedShape,
  })
  .superRefine(sourcedRules);

const capabilityEntry = z.object({
  name: z.enum(CAPABILITIES),
  availability: z.enum(['AVAILABLE', 'LIMITED', 'PREVIEW', 'NOT_AVAILABLE']).default('AVAILABLE'),
  documentationUrl: httpUrl.nullable().default(null),
});

export const modelSchema = z
  .object({
    slug,
    provider: slug,
    name: text(200),
    family: text(200),
    version: text(100).nullable().default(null),
    description: text(),
    categories: z.array(z.enum(CATEGORIES)).min(1),
    releaseDate: isoDate,
    contextWindow: z.number().int().positive().nullable().default(null),
    maxOutputTokens: z.number().int().positive().nullable().default(null),
    openWeights: z.boolean(),
    availability: z.enum(AVAILABILITIES),
    deployment: z.array(z.enum(DEPLOYMENTS)).default([]),
    pricingKind: z.enum(PRICING_KINDS).default('unknown'),
    inputModalities: z.array(z.enum(MODALITIES)).default([]),
    outputModalities: z.array(z.enum(MODALITIES)).default([]),
    officialDocumentation: httpUrl.nullable().default(null),
    knowledgeCutoff: text(50).nullable().default(null),
    architecture: text(500).nullable().default(null),
    trainingInfo: text().nullable().default(null),
    apiAvailability: text(500).nullable().default(null),
    structuredOutput: z.boolean().nullable().default(null),
    streaming: z.boolean().nullable().default(null),
    toolCalling: z.boolean().nullable().default(null),
    functionCalling: z.boolean().nullable().default(null),
    purpose: text().nullable().default(null),
    useCases: z.array(text(500)).default([]),
    notableFeatures: z.array(text(500)).default([]),
    limitations: z.array(text(500)).default([]),
    capabilities: z.array(capabilityEntry).default([]),
    createdAt: isoDateTime.optional(),
    updatedAt: isoDateTime.optional(),
    ...sourcedShape,
  })
  .superRefine(sourcedRules);

export const benchmarkSchema = z
  .object({
    slug,
    name: text(200),
    category: z.enum(BENCHMARK_CATEGORIES),
    description: text(),
    methodologyUrl: httpUrl.nullable().default(null),
    version: text(100).nullable().default(null),
    ...sourcedShape,
  })
  .superRefine(sourcedRules);

export const benchmarkResultSchema = z
  .object({
    model: slug,
    benchmark: slug,
    score: z.number().finite(),
    scoreUnit: text(20),
    evaluationDate: isoDate,
    modelVersion: text(100),
    benchmarkVersion: text(100).nullable().default(null),
    methodologyNotes: text().nullable().default(null),
    evaluationType: z.enum(['INDEPENDENT', 'PROVIDER_REPORTED', 'COMMUNITY']),
    ...sourcedShape,
  })
  .superRefine(sourcedRules);

export const pricingSchema = z
  .object({
    model: slug,
    pricingType: z.enum([
      'INPUT',
      'OUTPUT',
      'CACHED_INPUT',
      'BATCH_INPUT',
      'BATCH_OUTPUT',
      'IMAGE',
      'AUDIO',
      'OTHER',
    ]),
    /** null = not publicly disclosed (never 0 as a stand-in). */
    price: z.number().finite().nonnegative().nullable(),
    currency: z.string().regex(/^[A-Z]{3}$/, 'ISO 4217 code, e.g. USD'),
    unit: text(100),
    effectiveFrom: isoDate,
    effectiveTo: isoDate.nullable().default(null),
    isCurrent: z.boolean(),
    ...sourcedShape,
  })
  .superRefine((v, ctx) => {
    sourcedRules(v, ctx);
    if (v.isCurrent && v.effectiveTo !== null) {
      ctx.addIssue({
        code: 'custom',
        path: ['effectiveTo'],
        message: 'a current price cannot have ended',
      });
    }
    if (v.effectiveTo !== null && v.effectiveTo < v.effectiveFrom) {
      ctx.addIssue({
        code: 'custom',
        path: ['effectiveTo'],
        message: 'effectiveTo is before effectiveFrom',
      });
    }
  });

export const releaseSchema = z
  .object({
    provider: slug,
    model: slug.nullable().default(null),
    kind: z.enum(RELEASE_KINDS),
    releaseDate: isoDate,
    title: text(300),
    description: text(),
    announcementUrl: httpUrl.nullable().default(null),
    docsUrl: httpUrl.nullable().default(null),
    ...sourcedShape,
  })
  .superRefine(sourcedRules);

export const newsSchema = z
  .object({
    title: text(400),
    summary: text(),
    publisher: text(200),
    articleUrl: z.url().refine((u) => /^https?:\/\//i.test(u), 'must be an http(s) URL'),
    publicationDate: dateOrDateTime,
    category: z.enum(NEWS_CATEGORIES),
    isOfficial: z.boolean().default(false),
    isAiSummary: z.boolean().default(false),
    /** True when publicationDate is a page's "updated" date because no publication date is shown. */
    dateIsUpdated: z.boolean().default(false),
    provider: slug.nullable().default(null),
    models: z.array(slug).default([]),
    ...sourcedShape,
  })
  .superRefine(sourcedRules);

export const publicationSchema = z
  .object({
    provider: slug,
    title: text(400),
    url: httpUrl,
    publishedAt: isoDate,
    venue: text(200).nullable().default(null),
    ...sourcedShape,
  })
  .superRefine(sourcedRules);

/** File name (without .json) -> schema. Order matters for loading (parents first). */
export const SEED_FILES = {
  providers: providerSchema,
  benchmarks: benchmarkSchema,
  models: modelSchema,
  'benchmark-results': benchmarkResultSchema,
  pricing: pricingSchema,
  releases: releaseSchema,
  news: newsSchema,
  publications: publicationSchema,
} as const;

export type SeedFile = keyof typeof SEED_FILES;

export type SeedBundle = {
  providers: z.output<typeof providerSchema>[];
  benchmarks: z.output<typeof benchmarkSchema>[];
  models: z.output<typeof modelSchema>[];
  'benchmark-results': z.output<typeof benchmarkResultSchema>[];
  pricing: z.output<typeof pricingSchema>[];
  releases: z.output<typeof releaseSchema>[];
  news: z.output<typeof newsSchema>[];
  publications: z.output<typeof publicationSchema>[];
};

export type SeedError = { file: string; index: number | null; path: string; message: string };

export const emptyBundle = (): SeedBundle => ({
  providers: [],
  benchmarks: [],
  models: [],
  'benchmark-results': [],
  pricing: [],
  releases: [],
  news: [],
  publications: [],
});

/**
 * Validates raw parsed JSON (file name -> array) into a bundle. Collects EVERY problem
 * (schema, duplicate keys, dangling references, demo records in real data) instead of
 * stopping at the first, so one run gives the full list to fix.
 */
export function validateBundle(
  raw: Partial<Record<SeedFile, unknown>>,
  opts: { allowDemo: boolean },
): { ok: true; bundle: SeedBundle } | { ok: false; errors: SeedError[] } {
  const errors: SeedError[] = [];
  const bundle = emptyBundle();
  // Position of each accepted row in its file, so later checks report the FILE index (not the
  // index within the filtered bundle, which shifts when earlier rows were rejected).
  const origin = Object.fromEntries(
    Object.keys(SEED_FILES).map((k) => [k, [] as number[]]),
  ) as Record<SeedFile, number[]>;

  for (const file of Object.keys(SEED_FILES) as SeedFile[]) {
    const rows = raw[file] ?? [];
    if (!Array.isArray(rows)) {
      errors.push({ file, index: null, path: '', message: 'file must contain a JSON array' });
      continue;
    }
    rows.forEach((row, index) => {
      const parsed = (SEED_FILES[file] as z.ZodType).safeParse(row);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          errors.push({ file, index, path: issue.path.join('.'), message: issue.message });
        }
        return;
      }
      const value = parsed.data as { isDemo: boolean };
      if (value.isDemo && !opts.allowDemo) {
        errors.push({
          file,
          index,
          path: 'isDemo',
          message:
            'demo records are only allowed when SEED_DEMO=true; remove it from real data files',
        });
        return;
      }
      (bundle[file] as unknown[]).push(parsed.data);
      origin[file].push(index);
    });
  }

  // Uniqueness and references.
  const dup = (file: SeedFile, keyOf: (r: never) => string) => {
    const seen = new Map<string, number>();
    (bundle[file] as never[]).forEach((r, position) => {
      const key = keyOf(r);
      const index = origin[file][position] ?? position;
      if (seen.has(key)) {
        errors.push({
          file,
          index,
          path: '',
          message: `duplicate key "${key}" (also at index ${seen.get(key)})`,
        });
      } else seen.set(key, index);
    });
  };
  dup('providers', (r: { slug: string }) => r.slug);
  dup('benchmarks', (r: { slug: string }) => r.slug);
  dup('models', (r: { slug: string }) => r.slug);
  dup('news', (r: { articleUrl: string }) => r.articleUrl);
  dup('pricing', (r: { model: string; pricingType: string; unit: string; effectiveFrom: string }) =>
    [r.model, r.pricingType, r.unit, r.effectiveFrom].join('|'),
  );
  dup(
    'benchmark-results',
    (r: {
      model: string;
      benchmark: string;
      evaluationDate: string;
      evaluationType: string;
      modelVersion: string;
    }) => [r.model, r.benchmark, r.evaluationDate, r.evaluationType, r.modelVersion].join('|'),
  );

  const providers = new Set(bundle.providers.map((p) => p.slug));
  const models = new Set(bundle.models.map((m) => m.slug));
  const benchmarks = new Set(bundle.benchmarks.map((b) => b.slug));
  const ref = (
    file: SeedFile,
    index: number,
    path: string,
    value: string | null,
    set: Set<string>,
    what: string,
  ) => {
    if (value !== null && !set.has(value)) {
      errors.push({
        file,
        index: origin[file][index] ?? index,
        path,
        message: `unknown ${what} "${value}" (not defined in this data set)`,
      });
    }
  };
  bundle.models.forEach((m, i) => ref('models', i, 'provider', m.provider, providers, 'provider'));
  bundle['benchmark-results'].forEach((r, i) => {
    ref('benchmark-results', i, 'model', r.model, models, 'model');
    ref('benchmark-results', i, 'benchmark', r.benchmark, benchmarks, 'benchmark');
  });
  bundle.pricing.forEach((p, i) => ref('pricing', i, 'model', p.model, models, 'model'));
  bundle.releases.forEach((r, i) => {
    ref('releases', i, 'provider', r.provider, providers, 'provider');
    ref('releases', i, 'model', r.model, models, 'model');
  });
  bundle.news.forEach((n, i) => {
    ref('news', i, 'provider', n.provider, providers, 'provider');
    n.models.forEach((m) => ref('news', i, 'models', m, models, 'model'));
  });
  bundle.publications.forEach((p, i) =>
    ref('publications', i, 'provider', p.provider, providers, 'provider'),
  );

  return errors.length ? { ok: false, errors } : { ok: true, bundle };
}

export const formatErrors = (errors: SeedError[]): string =>
  errors
    .map(
      (e) =>
        `  ${e.file}.json${e.index === null ? '' : `[${e.index}]`}${e.path ? ` .${e.path}` : ''}: ${e.message}`,
    )
    .join('\n');

export type { CapabilityAvailability };
