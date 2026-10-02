import type { Prisma, PrismaClient } from '../generated/client';
import { buildSearchDocumentText } from '../../server/repositories/model-query';
import { sortKey } from '../../src/lib/text';
import { outranks, type VerificationStatus } from '../../src/lib/verification';
import { CAPABILITIES, type Capability } from '../../src/types/model';
import { toDbEnum, toDbEnums } from '../../server/db/mappers';
import type { SeedBundle } from './schemas';

/** Capability taxonomy (Capability table). `name` is the stable key the app uses. */
const CAPABILITY_GROUP: Record<Capability, string> = {
  'text-generation': 'text',
  'image-understanding': 'vision',
  'image-generation': 'image',
  'audio-understanding': 'audio',
  'audio-generation': 'audio',
  'video-understanding': 'video',
  'video-generation': 'video',
  'tool-calling': 'tools',
  'function-calling': 'tools',
  'code-generation': 'code',
  reasoning: 'reasoning',
};

export type Skipped = { entity: string; key: string; reason: string };
export type LoadReport = { counts: Record<string, number>; skipped: Skipped[] };

type Incoming = { verificationStatus: string; isDemo: boolean };
type Existing = { verificationStatus: string; isDemo: boolean } | null;

/**
 * Trust guard (docs/PROMPT.md 9): incoming data never silently replaces higher-trust data,
 * and demo data never replaces real data. Real data may replace demo data.
 */
export function protectExisting(existing: Existing, incoming: Incoming): string | null {
  if (!existing || existing.isDemo) return null;
  if (incoming.isDemo) return 'a real record cannot be overwritten by demo data';
  if (
    outranks(
      existing.verificationStatus as VerificationStatus,
      incoming.verificationStatus as VerificationStatus,
    )
  ) {
    return `existing ${existing.verificationStatus} outranks incoming ${incoming.verificationStatus}`;
  }
  return null;
}

const d = (s: string) => new Date(s);
const dOrNull = (s: string | null) => (s ? new Date(s) : null);

/** The sourced-record mixin columns. */
const sourced = (r: {
  sourceUrl: string | null;
  verificationStatus: string;
  verifiedAt: string | null;
  collectedAt: string;
  dataType: string | null;
  isDemo: boolean;
}) => ({
  sourceUrl: r.sourceUrl,
  verificationStatus: r.verificationStatus as VerificationStatus,
  verifiedAt: dOrNull(r.verifiedAt),
  collectedAt: d(r.collectedAt),
  dataType: r.dataType,
  isDemo: r.isDemo,
});

/**
 * Writes a validated bundle in ONE transaction (all or nothing) and is idempotent: running it
 * twice changes nothing. Records blocked by the trust guard are reported, not written.
 */
export async function loadBundle(db: PrismaClient, bundle: SeedBundle): Promise<LoadReport> {
  const counts: Record<string, number> = {};
  const skipped: Skipped[] = [];
  const bump = (k: string) => (counts[k] = (counts[k] ?? 0) + 1);

  await db.$transaction(
    async (tx: Prisma.TransactionClient) => {
      // Taxonomy (idempotent, independent of the data files).
      for (const name of CAPABILITIES) {
        await tx.capability.upsert({
          where: { name },
          create: { name, category: CAPABILITY_GROUP[name] },
          update: { category: CAPABILITY_GROUP[name] },
        });
      }
      const capIds = new Map(
        (await tx.capability.findMany({ select: { id: true, name: true } })).map((c) => [
          c.name,
          c.id,
        ]),
      );

      const providerIds = new Map<string, string>();
      const providerNames = new Map<string, string>();
      const modelIds = new Map<string, string>();
      const benchmarkIds = new Map<string, string>();

      for (const p of bundle.providers) {
        const existing = await tx.provider.findUnique({
          where: { slug: p.slug },
          select: { id: true, name: true, verificationStatus: true, isDemo: true },
        });
        const why = protectExisting(existing, p);
        if (why) {
          skipped.push({ entity: 'Provider', key: p.slug, reason: why });
          providerIds.set(p.slug, existing!.id);
          providerNames.set(p.slug, existing!.name);
          continue;
        }
        const data = {
          name: p.name,
          sortName: sortKey(p.name),
          monogram: p.monogram,
          description: p.description,
          officialWebsite: p.officialWebsite,
          logoUrl: p.logoUrl,
          headquarters: p.headquarters,
          orgType: p.orgType,
          isListed: p.isListed,
          ...sourced(p),
        };
        const row = await tx.provider.upsert({
          where: { slug: p.slug },
          create: { slug: p.slug, ...data },
          update: data,
          select: { id: true },
        });
        providerIds.set(p.slug, row.id);
        providerNames.set(p.slug, p.name);
        bump('providers');
      }

      for (const b of bundle.benchmarks) {
        const existing = await tx.benchmark.findUnique({
          where: { slug: b.slug },
          select: { id: true, verificationStatus: true, isDemo: true },
        });
        const why = protectExisting(existing, b);
        if (why) {
          skipped.push({ entity: 'Benchmark', key: b.slug, reason: why });
          benchmarkIds.set(b.slug, existing!.id);
          continue;
        }
        const data = {
          name: b.name,
          category: b.category,
          description: b.description,
          methodologyUrl: b.methodologyUrl,
          version: b.version,
          ...sourced(b),
        };
        const row = await tx.benchmark.upsert({
          where: { slug: b.slug },
          create: { slug: b.slug, ...data },
          update: data,
          select: { id: true },
        });
        benchmarkIds.set(b.slug, row.id);
        bump('benchmarks');
      }

      // Providers/benchmarks referenced but defined elsewhere (already in the database).
      const resolve = async (
        map: Map<string, string>,
        slug: string,
        find: () => Promise<{ id: string } | null>,
      ) => {
        if (!map.has(slug)) {
          const row = await find();
          if (row) map.set(slug, row.id);
        }
        return map.get(slug);
      };

      for (const m of bundle.models) {
        const providerId = await resolve(providerIds, m.provider, () =>
          tx.provider.findUnique({ where: { slug: m.provider }, select: { id: true } }),
        );
        if (!providerId)
          throw new Error(`model "${m.slug}" references unknown provider "${m.provider}"`);
        if (!providerNames.has(m.provider)) {
          const p = await tx.provider.findUnique({
            where: { slug: m.provider },
            select: { name: true },
          });
          providerNames.set(m.provider, p?.name ?? m.provider);
        }
        const existing = await tx.model.findUnique({
          where: { slug: m.slug },
          select: { id: true, verificationStatus: true, isDemo: true },
        });
        const why = protectExisting(existing, m);
        if (why) {
          skipped.push({ entity: 'Model', key: m.slug, reason: why });
          modelIds.set(m.slug, existing!.id);
          continue;
        }
        const availableCaps = m.capabilities
          .filter((c) => c.availability !== 'NOT_AVAILABLE')
          .map((c) => c.name);
        const data = {
          providerId,
          name: m.name,
          sortName: sortKey(m.name),
          family: m.family,
          version: m.version,
          description: m.description,
          categories: toDbEnums(m.categories) as never,
          releaseDate: d(m.releaseDate),
          contextWindow: m.contextWindow,
          maxOutputTokens: m.maxOutputTokens,
          openWeights: m.openWeights,
          availability: m.availability,
          deployment: toDbEnums(m.deployment) as never,
          pricingKind: toDbEnum(m.pricingKind) as never,
          inputModalities: toDbEnums(m.inputModalities) as never,
          outputModalities: toDbEnums(m.outputModalities) as never,
          officialDocumentation: m.officialDocumentation,
          knowledgeCutoff: m.knowledgeCutoff,
          architecture: m.architecture,
          trainingInfo: m.trainingInfo,
          apiAvailability: m.apiAvailability,
          structuredOutput: m.structuredOutput,
          streaming: m.streaming,
          toolCalling: m.toolCalling,
          functionCalling: m.functionCalling,
          purpose: m.purpose,
          useCases: m.useCases,
          notableFeatures: m.notableFeatures,
          limitations: m.limitations,
          searchDocument: buildSearchDocumentText({
            name: m.name,
            family: m.family,
            providerName: providerNames.get(m.provider)!,
            description: m.description,
            capabilities: availableCaps,
            categories: m.categories,
          }),
          ...sourced(m),
          ...(m.updatedAt ? { updatedAt: d(m.updatedAt) } : {}),
        };
        const row = await tx.model.upsert({
          where: { slug: m.slug },
          create: { slug: m.slug, ...data, ...(m.createdAt ? { createdAt: d(m.createdAt) } : {}) },
          update: data,
          select: { id: true },
        });
        modelIds.set(m.slug, row.id);
        // The capability set is replaced as a whole so removals in the data file take effect.
        await tx.modelCapability.deleteMany({ where: { modelId: row.id } });
        if (m.capabilities.length) {
          await tx.modelCapability.createMany({
            data: m.capabilities.map((c) => ({
              modelId: row.id,
              capabilityId: capIds.get(c.name)!,
              availability: c.availability,
              documentationUrl: c.documentationUrl,
              ...sourced(m),
            })),
          });
        }
        bump('models');
      }

      const modelId = async (slug: string) =>
        resolve(modelIds, slug, () =>
          tx.model.findUnique({ where: { slug }, select: { id: true } }),
        );
      const providerId = async (slug: string) =>
        resolve(providerIds, slug, () =>
          tx.provider.findUnique({ where: { slug }, select: { id: true } }),
        );

      for (const r of bundle['benchmark-results']) {
        const mid = await modelId(r.model);
        const bid = await resolve(benchmarkIds, r.benchmark, () =>
          tx.benchmark.findUnique({ where: { slug: r.benchmark }, select: { id: true } }),
        );
        if (!mid || !bid)
          throw new Error(
            `benchmark result references unknown model/benchmark (${r.model}, ${r.benchmark})`,
          );
        const key = {
          modelId: mid,
          benchmarkId: bid,
          evaluationDate: d(r.evaluationDate),
          evaluationType: r.evaluationType,
          modelVersion: r.modelVersion,
        };
        const existing = await tx.benchmarkResult.findUnique({
          where: { modelId_benchmarkId_evaluationDate_evaluationType_modelVersion: key },
          select: { verificationStatus: true, isDemo: true },
        });
        const why = protectExisting(existing, r);
        if (why) {
          skipped.push({
            entity: 'BenchmarkResult',
            key: `${r.model}/${r.benchmark}/${r.evaluationDate}`,
            reason: why,
          });
          continue;
        }
        const data = {
          score: r.score,
          scoreUnit: r.scoreUnit,
          benchmarkVersion: r.benchmarkVersion,
          methodologyNotes: r.methodologyNotes,
          ...sourced(r),
        };
        await tx.benchmarkResult.upsert({
          where: { modelId_benchmarkId_evaluationDate_evaluationType_modelVersion: key },
          create: { ...key, ...data },
          update: data,
        });
        bump('benchmarkResults');
      }

      for (const p of bundle.pricing) {
        const mid = await modelId(p.model);
        if (!mid) throw new Error(`price references unknown model "${p.model}"`);
        const key = {
          modelId: mid,
          pricingType: p.pricingType,
          unit: p.unit,
          effectiveFrom: d(p.effectiveFrom),
        };
        const existing = await tx.pricing.findUnique({
          where: { modelId_pricingType_unit_effectiveFrom: key },
          select: { verificationStatus: true, isDemo: true },
        });
        const why = protectExisting(existing, p);
        if (why) {
          skipped.push({
            entity: 'Pricing',
            key: `${p.model}/${p.pricingType}/${p.effectiveFrom}`,
            reason: why,
          });
          continue;
        }
        const data = {
          price: p.price,
          currency: p.currency,
          effectiveTo: p.effectiveTo ? d(p.effectiveTo) : null,
          isCurrent: p.isCurrent,
          ...sourced(p),
        };
        await tx.pricing.upsert({
          where: { modelId_pricingType_unit_effectiveFrom: key },
          create: { ...key, ...data },
          update: data,
        });
        bump('pricing');
      }

      for (const r of bundle.releases) {
        const pid = await providerId(r.provider);
        if (!pid) throw new Error(`release references unknown provider "${r.provider}"`);
        const mid = r.model ? await modelId(r.model) : null;
        const key = { providerId: pid, releaseDate: d(r.releaseDate), title: r.title };
        const existing = await tx.release.findUnique({
          where: { providerId_releaseDate_title: key },
          select: { verificationStatus: true, isDemo: true },
        });
        const why = protectExisting(existing, r);
        if (why) {
          skipped.push({
            entity: 'Release',
            key: `${r.provider}/${r.releaseDate}/${r.title}`,
            reason: why,
          });
          continue;
        }
        const data = {
          modelId: mid ?? null,
          kind: r.kind,
          description: r.description,
          announcementUrl: r.announcementUrl,
          docsUrl: r.docsUrl,
          ...sourced(r),
        };
        await tx.release.upsert({
          where: { providerId_releaseDate_title: key },
          create: { ...key, ...data },
          update: data,
        });
        bump('releases');
      }

      for (const n of bundle.news) {
        const pid = n.provider ? await providerId(n.provider) : null;
        const modelLinks = (await Promise.all(n.models.map((s) => modelId(s))))
          .filter((x): x is string => !!x)
          .map((id) => ({ id }));
        const existing = await tx.newsArticle.findUnique({
          where: { articleUrl: n.articleUrl },
          select: { verificationStatus: true, isDemo: true },
        });
        const why = protectExisting(existing, n);
        if (why) {
          skipped.push({ entity: 'NewsArticle', key: n.articleUrl, reason: why });
          continue;
        }
        const data = {
          title: n.title,
          summary: n.summary,
          publisher: n.publisher,
          publicationDate: d(n.publicationDate),
          category: n.category,
          isOfficial: n.isOfficial,
          isAiSummary: n.isAiSummary,
          providerId: pid ?? null,
          ...sourced(n),
        };
        await tx.newsArticle.upsert({
          where: { articleUrl: n.articleUrl },
          create: { articleUrl: n.articleUrl, ...data, models: { connect: modelLinks } },
          update: { ...data, models: { set: modelLinks } },
        });
        bump('news');
      }

      for (const p of bundle.publications) {
        const pid = await providerId(p.provider);
        if (!pid) throw new Error(`publication references unknown provider "${p.provider}"`);
        const key = { providerId: pid, url: p.url };
        const existing = await tx.publication.findUnique({
          where: { providerId_url: key },
          select: { verificationStatus: true, isDemo: true },
        });
        const why = protectExisting(existing, p);
        if (why) {
          skipped.push({ entity: 'Publication', key: p.url, reason: why });
          continue;
        }
        const data = {
          title: p.title,
          publishedAt: d(p.publishedAt),
          venue: p.venue,
          ...sourced(p),
        };
        await tx.publication.upsert({
          where: { providerId_url: key },
          create: { ...key, ...data },
          update: data,
        });
        bump('publications');
      }
    },
    { timeout: 120_000, maxWait: 10_000 },
  );

  return { counts, skipped };
}
