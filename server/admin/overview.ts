import type { PrismaClient } from '../../prisma/generated/client';
import type { Option, RefKind } from '../../src/lib/admin/fields';
import type { AdminEntity } from './definitions';

/** Reference options for the editor's select lists, and the dashboard's record counts. */

export async function loadRefs(db: PrismaClient): Promise<Record<RefKind, Option[]>> {
  const [providers, models, benchmarks] = await Promise.all([
    db.provider.findMany({ select: { slug: true, name: true }, orderBy: { sortName: 'asc' } }),
    db.model.findMany({
      select: { slug: true, name: true, provider: { select: { name: true } } },
      orderBy: [{ provider: { sortName: 'asc' } }, { name: 'asc' }],
    }),
    db.benchmark.findMany({ select: { slug: true, name: true }, orderBy: { name: 'asc' } }),
  ]);
  return {
    providers: providers.map((p) => ({ value: p.slug, label: p.name })),
    models: models.map((m) => ({ value: m.slug, label: `${m.provider.name} · ${m.name}` })),
    benchmarks: benchmarks.map((b) => ({ value: b.slug, label: b.name })),
  };
}

export async function recordCounts(db: PrismaClient): Promise<Record<AdminEntity, number>> {
  const [providers, models, benchmarks, results, pricing, releases, news, publications] =
    await Promise.all([
      db.provider.count(),
      db.model.count(),
      db.benchmark.count(),
      db.benchmarkResult.count(),
      db.pricing.count(),
      db.release.count(),
      db.newsArticle.count(),
      db.publication.count(),
    ]);
  return {
    providers,
    models,
    benchmarks,
    'benchmark-results': results,
    pricing,
    releases,
    news,
    publications,
  };
}
