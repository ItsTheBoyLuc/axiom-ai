import { z } from 'zod';
import { MAX_Q_LENGTH } from '../../src/lib/models/query';
import { NEWS_CATEGORIES, SEARCH_TYPES, type SearchType } from '../../src/types/catalog';
import {
  CAPABILITIES,
  CATEGORIES,
  DEPLOYMENTS,
  PRICING_KINDS,
  RELEASE_KINDS,
  SORTS,
  type ModelQuery,
} from '../../src/types/model';
import { toDbEnum } from '../db/mappers';

/**
 * Request schemas. Strict by design: unknown values are a 400 (unlike the tolerant UI URL
 * parser), so API clients find out about typos instead of getting silently unfiltered data.
 */

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 20;

const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be a kebab-case slug')
  .max(100);

/** Optional positive integer query parameter with a default. */
const int = (min: number, max: number, def: number) =>
  z
    .string()
    .regex(/^\d{1,9}$/, 'must be a whole number')
    .transform(Number)
    .pipe(z.number().int().min(min).max(max))
    .optional()
    .transform((v) => v ?? def);

/** "a,b,c" -> validated list (max 20 values). Empty/missing -> []. */
const csvOf = <S extends z.ZodType<string, string>>(item: S) =>
  z
    .string()
    .optional()
    .transform((s) =>
      s
        ? s
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean)
        : [],
    )
    .pipe(z.array(item).max(20));
const csvEnum = <T extends readonly [string, ...string[]]>(values: T) => csvOf(z.enum(values));

const q = z.string().trim().max(MAX_Q_LENGTH).optional();
const isoDate = z.iso.date();

const pagination = {
  page: int(1, 100_000, 1),
  pageSize: int(1, MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE),
};

/** GET /models */
export const modelsQuerySchema = z
  .strictObject({
    q: q.transform((v) => v ?? ''),
    provider: csvOf(slug),
    category: csvEnum(CATEGORIES),
    capability: csvEnum(CAPABILITIES),
    deployment: csvEnum(DEPLOYMENTS),
    pricing: csvEnum(PRICING_KINDS),
    sort: z
      .enum(SORTS)
      .optional()
      .transform((v) => v ?? 'recent'),
    benchmark: slug.optional(),
    ...pagination,
  })
  .superRefine((v, ctx) => {
    if (v.sort === 'benchmark' && !v.benchmark) {
      ctx.addIssue({
        code: 'custom',
        path: ['benchmark'],
        message: 'benchmark is required when sort=benchmark',
      });
    }
  })
  .transform((v): ModelQuery => ({
    q: v.q,
    provider: v.provider,
    category: v.category as ModelQuery['category'],
    capability: v.capability as ModelQuery['capability'],
    deployment: v.deployment as ModelQuery['deployment'],
    pricing: v.pricing as ModelQuery['pricing'],
    sort: v.sort,
    benchmark: v.benchmark ?? null,
    page: v.page,
    pageSize: v.pageSize,
  }));

export const slugParams = z.strictObject({ slug });

export const suggestQuerySchema = z.strictObject({
  q: z.string().trim().min(1).max(MAX_Q_LENGTH),
  limit: int(1, 10, 6),
});

export const relatedQuerySchema = z.strictObject({ limit: int(1, 12, 3) });

export const providersQuerySchema = z.strictObject({ q, ...pagination });

export const benchmarkResultsQuerySchema = z
  .strictObject({
    benchmark: slug.optional(),
    provider: slug.optional(),
    family: z.string().trim().min(1).max(200).optional(),
    version: z.string().trim().min(1).max(100).optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
    ...pagination,
  })
  .superRefine((v, ctx) => {
    if (v.from && v.to && v.to < v.from) {
      ctx.addIssue({ code: 'custom', path: ['to'], message: '"to" is before "from"' });
    }
  });

export const releasesQuerySchema = z
  .strictObject({
    q,
    provider: slug.optional(),
    /** Release kind in kebab-case, e.g. "major", "api-change". */
    category: z
      .enum(RELEASE_KINDS.map((k) => k.toLowerCase().replaceAll('_', '-')) as [string, ...string[]])
      .optional()
      .transform((v) => (v ? (toDbEnum(v) as (typeof RELEASE_KINDS)[number]) : undefined)),
    from: isoDate.optional(),
    to: isoDate.optional(),
    ...pagination,
  })
  .superRefine((v, ctx) => {
    if (v.from && v.to && v.to < v.from) {
      ctx.addIssue({ code: 'custom', path: ['to'], message: '"to" is before "from"' });
    }
  });

export const newsQuerySchema = z.strictObject({
  q,
  category: z
    .enum(NEWS_CATEGORIES.map((c) => c.toLowerCase().replaceAll('_', '-')) as [string, ...string[]])
    .optional()
    .transform((v) => (v ? (toDbEnum(v) as (typeof NEWS_CATEGORIES)[number]) : undefined)),
  provider: slug.optional(),
  ...pagination,
});

export const searchQuerySchema = z.strictObject({
  q: z.string().trim().min(1).max(MAX_Q_LENGTH),
  types: csvEnum(SEARCH_TYPES).transform((t) =>
    t.length ? (t as SearchType[]) : [...SEARCH_TYPES],
  ),
  limit: int(1, 10, 5),
});

export const MAX_COMPARE = 4;

/** ?models=a,b,c,d (2-4 distinct slugs is enforced by the handler; here: 1-4 valid slugs). */
export const compareQuerySchema = z.strictObject({
  models: z
    .string()
    .min(1, 'models is required')
    .transform((s) => [
      ...new Set(
        s
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),
      ),
    ])
    .pipe(z.array(slug).min(1).max(MAX_COMPARE, `you can compare at most ${MAX_COMPARE} models`)),
});
