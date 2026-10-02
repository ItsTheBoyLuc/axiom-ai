import { describe, expect, it } from 'vitest';
import { createInMemoryModelRepository, toListItem } from '../support/in-memory-model-repository';
import { demoModelDetails } from '../../prisma/seed/demo/models';
import {
  buildFacets,
  filterModels,
  listModels,
  relatedModels,
  searchScore,
  sortModels,
  suggestModels,
} from '../../server/repositories/model-query';
import { latestBenchmarkResult } from '@/lib/models/benchmarks';
import { defaultQuery } from '@/lib/models/query';
import type { ModelQuery } from '@/types/model';

const all = demoModelDetails.map(toListItem);
const memoryRepo = createInMemoryModelRepository();
const q = (over: Partial<ModelQuery> = {}): ModelQuery => ({ ...defaultQuery, ...over });
const slugs = (items: { slug: string }[]) => items.map((m) => m.slug);

describe('search', () => {
  it('matches name, family, provider, description and capabilities', () => {
    expect(slugs(filterModels(all, q({ q: 'sample model 4' })))).toContain('sample-model-4');
    // Tokens match across fields (family + capability), so more than one model can match;
    // the exact family match must rank first.
    expect(slugs(filterModels(all, q({ q: 'Sample Video Family' })))).toContain('sample-model-9');
    expect(suggestModels(all, 'Sample Video Family', 1)[0]!.slug).toBe('sample-model-9');
    // Provider names are searchable: a model scores higher for its own provider's name.
    const m3 = all.find((m) => m.slug === 'sample-model-3')!; // Demo Provider C
    const m1 = all.find((m) => m.slug === 'sample-model-1')!; // Demo Provider A
    expect(searchScore(m3, 'demo provider c')).toBeGreaterThan(searchScore(m1, 'demo provider c'));
    expect(filterModels(all, q({ q: 'embedding' })).map((m) => m.slug)).toContain(
      'sample-model-10',
    );
    expect(filterModels(all, q({ q: 'tool calling' })).length).toBeGreaterThan(3);
  });

  it('requires every token to match and ignores case and accents', () => {
    expect(filterModels(all, q({ q: 'VIDEO generation' })).length).toBeGreaterThan(0);
    expect(filterModels(all, q({ q: 'video zzzz' }))).toEqual([]);
    expect(searchScore(all[0]!, 'SAMPLE')).toBeGreaterThan(0);
    expect(searchScore(all[0]!, 'café-nothing')).toBe(0);
  });

  it('an empty query matches everything', () => {
    expect(filterModels(all, q()).length).toBe(all.length);
  });
});

describe('filters', () => {
  it('ORs values inside a group', () => {
    const r = filterModels(all, q({ category: ['embedding', 'video-generation'] }));
    expect(slugs(r).sort()).toEqual(['sample-model-10', 'sample-model-9']);
  });

  it('ANDs across groups', () => {
    const r = filterModels(all, q({ category: ['coding'], deployment: ['local'] }));
    expect(slugs(r)).toEqual(['sample-model-3']);
  });

  it('groups models from non-listed providers under "other"', () => {
    const r = filterModels(all, q({ provider: ['other'] }));
    expect(slugs(r).sort()).toEqual(['sample-model-14', 'sample-model-15']);
    const mixed = filterModels(all, q({ provider: ['other', 'demo-provider-c'] }));
    expect(mixed.length).toBe(4);
  });

  it('filters by derived deployment (open weights / proprietary)', () => {
    const open = filterModels(all, q({ deployment: ['open-weights'] }));
    expect(open.every((m) => m.openWeights)).toBe(true);
    const prop = filterModels(all, q({ deployment: ['proprietary'] }));
    expect(prop.every((m) => !m.openWeights)).toBe(true);
    expect(open.length + prop.length).toBe(all.length);
  });

  it('filters by pricing kind and capability', () => {
    expect(filterModels(all, q({ pricing: ['custom'] })).map((m) => m.slug)).toEqual([
      'sample-model-9',
    ]);
    const caps = filterModels(all, q({ capability: ['audio-generation'] }));
    expect(slugs(caps).sort()).toEqual(['sample-model-12', 'sample-model-5']);
  });

  it('returns nothing (not everything) when filters exclude all models', () => {
    expect(filterModels(all, q({ category: ['embedding'], pricing: ['free'] }))).toEqual([]);
  });
});

describe('sorting', () => {
  const order = (over: Partial<ModelQuery>) => slugs(sortModels(all, q(over)));

  it('recent: newest release first', () => {
    const dates = sortModels(all, q({ sort: 'recent' })).map((m) => m.releaseDate);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it('updated: most recently updated first', () => {
    const d = sortModels(all, q({ sort: 'updated' })).map((m) => m.updatedAt);
    expect(d).toEqual([...d].sort().reverse());
  });

  it('alpha and provider sort by name', () => {
    const names = sortModels(all, q({ sort: 'alpha' })).map((m) => m.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    const provs = sortModels(all, q({ sort: 'provider' })).map((m) => m.providerName);
    expect(provs).toEqual([...provs].sort((a, b) => a.localeCompare(b)));
  });

  it('context: largest first, undisclosed (null) last', () => {
    const items = sortModels(all, q({ sort: 'context' }));
    expect(items[0]!.slug).toBe('sample-model-4');
    const firstNull = items.findIndex((m) => m.contextWindow === null);
    expect(items.slice(firstNull).every((m) => m.contextWindow === null)).toBe(true);
  });

  it('benchmark: sorts by ONE benchmark, models without a result last', () => {
    const items = sortModels(all, q({ sort: 'benchmark', benchmark: 'sample-benchmark-1' }));
    const withScore = items.filter((m) =>
      latestBenchmarkResult(m.benchmarks, 'sample-benchmark-1'),
    );
    expect(items.slice(0, withScore.length)).toEqual(withScore);
    const scores = withScore.map(
      (m) => latestBenchmarkResult(m.benchmarks, 'sample-benchmark-1')!.score,
    );
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    expect(items[0]!.slug).toBe('sample-model-11'); // 85
  });

  it('benchmark: uses the NEWEST result when a model has several (no averaging)', () => {
    const m2 = all.find((m) => m.slug === 'sample-model-2')!;
    // provider-reported 78 (June) then independent 74 (July): latest is 74, not 78 and not 76.
    expect(latestBenchmarkResult(m2.benchmarks, 'sample-benchmark-1')!.score).toBe(74);
  });

  it('benchmark sort without a benchmark falls back to recent', () => {
    expect(order({ sort: 'benchmark', benchmark: null })).toEqual(order({ sort: 'recent' }));
  });

  it('is deterministic and does not mutate its input', () => {
    const copy = [...all];
    sortModels(all, q({ sort: 'alpha' }));
    expect(all).toEqual(copy);
    expect(order({ sort: 'context' })).toEqual(order({ sort: 'context' }));
  });
});

describe('pagination and listModels', () => {
  it('paginates and reports totals', () => {
    const r1 = listModels(all, q({ pageSize: 6 }));
    expect(r1.total).toBe(16);
    expect(r1.pageCount).toBe(3);
    expect(r1.items).toHaveLength(6);
    const r3 = listModels(all, q({ pageSize: 6, page: 3 }));
    expect(r3.items).toHaveLength(4);
    expect(new Set([...r1.items, ...r3.items].map((m) => m.slug)).size).toBe(10);
  });

  it('clamps an out-of-range page into range', () => {
    const r = listModels(all, q({ page: 99 }));
    expect(r.page).toBe(r.pageCount);
    expect(r.items.length).toBeGreaterThan(0);
  });

  it('handles zero results with a single empty page', () => {
    const r = listModels(all, q({ q: 'nothing-matches-this' }));
    expect(r.total).toBe(0);
    expect(r.pageCount).toBe(1);
    expect(r.page).toBe(1);
    expect(r.items).toEqual([]);
  });

  it('flags demo data', () => {
    expect(listModels(all, q()).hasDemo).toBe(true);
  });
});

describe('facets', () => {
  it('counts each option with its own group filter removed', () => {
    const facets = buildFacets(all, q({ category: ['coding'] }));
    // The category group ignores its own filter, so counts still show alternatives.
    const embedding = facets.category.find((o) => o.value === 'embedding')!;
    expect(embedding.count).toBe(1);
    // Other groups respect the category filter.
    const local = facets.deployment.find((o) => o.value === 'local')!;
    expect(local.count).toBe(
      filterModels(all, q({ category: ['coding'] })).filter((m) => m.deployment.includes('local'))
        .length,
    );
  });

  it('includes an Other provider bucket and lists every option even at zero', () => {
    const f = buildFacets(all, q());
    expect(f.provider.map((o) => o.value)).toContain('other');
    expect(f.provider.find((o) => o.value === 'other')!.count).toBe(2);
    expect(f.category).toHaveLength(8);
    expect(f.capability).toHaveLength(11);
    expect(f.deployment).toHaveLength(5);
    expect(f.pricing).toHaveLength(5);
  });
});

describe('suggestions and related', () => {
  it('suggests best matches first and respects the limit', () => {
    const s = suggestModels(all, 'sample model 1', 3);
    expect(s.length).toBeLessThanOrEqual(3);
    expect(s.every((x) => x.isDemo)).toBe(true);
    expect(suggestModels(all, '   ')).toEqual([]);
    expect(suggestModels(all, 'zzzzzz')).toEqual([]);
  });

  it('related excludes the model itself and prefers the same provider/categories', () => {
    const r = relatedModels(all, 'sample-model-1', 3);
    expect(r).toHaveLength(3);
    expect(slugs(r)).not.toContain('sample-model-1');
    expect(relatedModels(all, 'does-not-exist')).toEqual([]);
  });

  it('repository facade agrees with the pure functions', async () => {
    const r = await memoryRepo.list(q({ category: ['embedding'] }));
    expect(slugs(r.items)).toEqual(['sample-model-10']);
    expect((await memoryRepo.getBySlug('sample-model-1'))?.name).toBe('Sample Model 1');
    expect(await memoryRepo.getBySlug('nope')).toBeNull();
  });
});
