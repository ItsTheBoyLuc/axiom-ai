import { demoNews, demoProviders } from './fixtures';
import { availabilityKeyByLabel } from '../../../src/types/model';
import type { SeedFile } from '../schemas';
import { demoBenchmarks, demoModelDetails } from './models';

/**
 * Demo fixtures expressed as RAW seed records, so they go through exactly the same Zod
 * validation as real data files. Every record is isDemo = true / UNVERIFIED / unsourced, and
 * the database rejects demo rows that claim to be verified. Loaded only when SEED_DEMO=true.
 */
const COLLECTED_AT = '2026-09-29T00:00:00.000Z';

const demoSourcing = {
  sourceUrl: null,
  verificationStatus: 'UNVERIFIED',
  verifiedAt: null,
  collectedAt: COLLECTED_AT,
  dataType: 'demo',
  isDemo: true,
};

const NEWS_CATEGORY: Record<string, string> = {
  n1: 'MODEL_RELEASES',
  n2: 'COMPANIES',
  n3: 'RESEARCH',
};

export function buildDemoRaw(): Record<SeedFile, unknown[]> {
  return {
    providers: demoProviders.map((p) => ({
      slug: p.slug,
      name: p.name,
      monogram: p.monogram,
      description: p.description,
      isListed: p.tier === 'listed',
      ...demoSourcing,
    })),

    benchmarks: demoBenchmarks.map((b) => ({
      slug: b.slug,
      name: b.name,
      category: b.category,
      description: b.description,
      methodologyUrl: b.methodologyUrl,
      version: b.version,
      ...demoSourcing,
    })),

    models: demoModelDetails.map((m) => ({
      slug: m.slug,
      provider: m.providerSlug,
      name: m.name,
      family: m.family,
      version: m.version,
      description: m.description,
      categories: m.categories,
      releaseDate: m.releaseDate,
      contextWindow: m.contextWindow,
      maxOutputTokens: m.specs.maxOutputTokens,
      openWeights: m.openWeights,
      availability: availabilityKeyByLabel[m.availability],
      deployment: m.deployment,
      pricingKind: m.pricingKind,
      inputModalities: m.specs.inputModalities,
      outputModalities: m.specs.outputModalities,
      officialDocumentation: m.documentationUrl,
      knowledgeCutoff: m.specs.knowledgeCutoff,
      architecture: m.specs.architecture,
      trainingInfo: m.specs.trainingInfo,
      apiAvailability: m.specs.apiAvailability,
      structuredOutput: m.specs.structuredOutput,
      streaming: m.specs.streaming,
      toolCalling: m.specs.toolCalling,
      functionCalling: m.specs.functionCalling,
      purpose: m.overview.purpose,
      useCases: m.overview.useCases,
      notableFeatures: m.overview.notableFeatures,
      limitations: m.overview.limitations,
      capabilities: m.capabilityAvailability.map((c) => ({
        name: c.capability,
        availability: c.availability,
        documentationUrl: null,
      })),
      createdAt: m.updatedAt,
      updatedAt: m.updatedAt,
      ...demoSourcing,
    })),

    'benchmark-results': demoModelDetails.flatMap((m) =>
      m.benchmarks.map((r) => ({
        model: m.slug,
        benchmark: r.benchmarkSlug,
        score: r.score,
        scoreUnit: r.scoreUnit,
        evaluationDate: r.evaluationDate,
        modelVersion: r.modelVersion,
        benchmarkVersion: r.benchmarkVersion,
        methodologyNotes: r.methodologyNotes,
        evaluationType: r.evaluationType,
        ...demoSourcing,
      })),
    ),

    pricing: demoModelDetails.flatMap((m) =>
      m.pricing.map((p) => ({
        model: m.slug,
        pricingType: p.type,
        price: p.price,
        currency: p.currency,
        unit: p.unit,
        effectiveFrom: p.effectiveFrom,
        effectiveTo: p.effectiveTo,
        isCurrent: p.isCurrent,
        ...demoSourcing,
      })),
    ),

    releases: demoModelDetails.flatMap((m) =>
      m.releaseHistory.map((e) => ({
        provider: m.providerSlug,
        model: m.slug,
        kind: e.kind,
        releaseDate: e.date,
        title: e.title,
        description: e.description,
        announcementUrl: e.sourceUrl,
        docsUrl: null,
        ...demoSourcing,
      })),
    ),

    news: demoNews.map((n) => ({
      title: n.title,
      summary: n.summary,
      publisher: n.publisher,
      // .invalid is a reserved TLD: it can never resolve, so this is clearly not a real article.
      articleUrl: `https://example.invalid/demo/news/${n.id}`,
      publicationDate: `${n.date}T00:00:00Z`,
      category: NEWS_CATEGORY[n.id] ?? 'COMPANIES',
      isOfficial: n.isOfficial,
      isAiSummary: n.isAiSummary,
      provider: n.providerSlug,
      models: [],
      ...demoSourcing,
    })),

    publications: [],
  };
}
