import { demoProviders } from '../../../src/lib/demo-data';
import {
  categoryLabel,
  type BenchmarkOption,
  type BenchmarkResult,
  type Capability,
  type CapabilityAvailability,
  type Category,
  type Deployment,
  type EvaluationType,
  type Modality,
  type ModelDetail,
  type PricingEntry,
  type PricingKind,
  type ReleaseHistoryEntry,
} from '../../../src/types/model';

/**
 * DEMO DATASET (docs/PROMPT.md section 2). Every name and number below is invented for
 * layout and filter testing. Nothing describes a real provider, model, price, benchmark or
 * release. All records are isDemo = true, UNVERIFIED and have no source URL. Deliberate gaps
 * (null context, missing prices, no benchmarks) exercise the "Not publicly disclosed" paths.
 */

const COLLECTED_AT = '2026-09-29T00:00:00.000Z';

export const demoBenchmarks: BenchmarkOption[] = [
  ['sample-benchmark-1', 'Sample Benchmark 1', 'reasoning'],
  ['sample-benchmark-2', 'Sample Benchmark 2', 'coding'],
  ['sample-benchmark-3', 'Sample Benchmark 3', 'mathematics'],
  ['sample-benchmark-4', 'Sample Benchmark 4', 'multimodal'],
  ['sample-benchmark-5', 'Sample Benchmark 5', 'long-context'],
].map(([slug, name, category]) => ({
  slug: slug!,
  name: name!,
  category: category!,
  version: 'demo',
  description: 'Placeholder benchmark used to test the layout. Not a real benchmark.',
  methodologyUrl: null,
}));

type BenchSpec = [slug: string, score: number, type: EvaluationType, date?: string];

type Spec = {
  n: number;
  provider: string; // letter
  family: string;
  version: string | null;
  cats: Category[];
  caps: Capability[];
  input: Modality[];
  output: Modality[];
  release: string;
  updated: string;
  ctx: number | null;
  maxOut: number | null;
  open: boolean;
  availability: string;
  deploy: Deployment[];
  pricingKind: PricingKind;
  price?: {
    input?: number | null;
    output?: number | null;
    cached?: number;
    batchIn?: number;
    batchOut?: number;
  };
  /** Per-image or other non-token pricing. */
  otherPrice?: { type: 'IMAGE' | 'AUDIO' | 'OTHER'; price: number; unit: string };
  pastPrice?: { input: number; output: number; from: string; to: string };
  bench?: BenchSpec[];
  cutoff?: string | null;
  arch?: string | null;
  tool?: boolean | null;
  extraHistory?: ReleaseHistoryEntry[];
};

const specs: Spec[] = [
  {
    n: 1,
    provider: 'A',
    family: 'Sample Family X',
    version: '1.0',
    cats: ['llm', 'multimodal', 'coding'],
    caps: [
      'text-generation',
      'image-understanding',
      'tool-calling',
      'function-calling',
      'code-generation',
    ],
    input: ['text', 'image'],
    output: ['text'],
    release: '2026-03-01',
    updated: '2026-08-12',
    ctx: 128000,
    maxOut: 8192,
    open: false,
    availability: 'Cloud API',
    deploy: ['cloud-api', 'hosted-service'],
    pricingKind: 'paid',
    price: { input: 1, output: 4, cached: 0.25 },
    bench: [
      ['sample-benchmark-1', 71, 'PROVIDER_REPORTED', '2026-04-10'],
      ['sample-benchmark-2', 64, 'INDEPENDENT', '2026-05-02'],
      ['sample-benchmark-4', 59, 'PROVIDER_REPORTED', '2026-04-10'],
    ],
    cutoff: '2025-10',
    arch: null,
    tool: true,
    extraHistory: [
      {
        date: '2026-06-15',
        kind: 'CAPABILITY',
        title: 'Placeholder capability update',
        description: 'Invented entry for layout testing.',
        sourceUrl: null,
      },
    ],
  },
  {
    n: 2,
    provider: 'B',
    family: 'Sample Family Y',
    version: '2.1',
    cats: ['llm', 'reasoning', 'multimodal'],
    caps: [
      'text-generation',
      'image-understanding',
      'audio-understanding',
      'reasoning',
      'tool-calling',
      'function-calling',
    ],
    input: ['text', 'image', 'audio'],
    output: ['text'],
    release: '2026-02-01',
    updated: '2026-09-01',
    ctx: 200000,
    maxOut: 16000,
    open: false,
    availability: 'Cloud API',
    deploy: ['cloud-api'],
    pricingKind: 'paid',
    price: { input: 2, output: 8, cached: 0.5 },
    pastPrice: { input: 2.5, output: 10, from: '2026-02-01', to: '2026-06-30' },
    // Two results for the same benchmark: the newest (independent) one is used for sorting.
    bench: [
      ['sample-benchmark-1', 78, 'PROVIDER_REPORTED', '2026-06-01'],
      ['sample-benchmark-1', 74, 'INDEPENDENT', '2026-07-15'],
      ['sample-benchmark-3', 69, 'INDEPENDENT', '2026-07-15'],
    ],
    cutoff: '2025-11',
    arch: 'Not publicly disclosed',
    tool: true,
  },
  {
    n: 3,
    provider: 'C',
    family: 'Sample Family Z',
    version: null,
    cats: ['llm', 'coding'],
    caps: ['text-generation', 'code-generation'],
    input: ['text'],
    output: ['text'],
    release: '2026-01-01',
    updated: '2026-05-05',
    ctx: 32000,
    maxOut: null,
    open: true,
    availability: 'Open weights',
    deploy: ['local'],
    pricingKind: 'free',
    bench: [
      ['sample-benchmark-2', 58, 'PROVIDER_REPORTED', '2026-02-01'],
      ['sample-benchmark-1', 55, 'INDEPENDENT', '2026-03-01'],
    ],
    cutoff: null,
    arch: null,
    tool: false,
  },
  {
    n: 4,
    provider: 'D',
    family: 'Sample Family W',
    version: '3.0',
    cats: ['llm', 'multimodal'],
    caps: [
      'text-generation',
      'image-understanding',
      'video-understanding',
      'audio-understanding',
      'tool-calling',
    ],
    input: ['text', 'image', 'audio', 'video'],
    output: ['text'],
    release: '2025-12-01',
    updated: '2026-07-20',
    ctx: 1000000,
    maxOut: 32000,
    open: false,
    availability: 'Hosted service',
    deploy: ['hosted-service', 'cloud-api'],
    pricingKind: 'paid',
    price: { input: 3, output: 12 },
    bench: [
      ['sample-benchmark-1', 82, 'PROVIDER_REPORTED', '2026-01-10'],
      ['sample-benchmark-5', 74, 'PROVIDER_REPORTED', '2026-01-10'],
      ['sample-benchmark-4', 66, 'INDEPENDENT', '2026-02-20'],
    ],
    cutoff: '2025-08',
    arch: null,
    tool: true,
  },
  {
    n: 5,
    provider: 'E',
    family: 'Sample Family V',
    version: null,
    cats: ['llm', 'audio'],
    caps: ['text-generation', 'audio-understanding', 'audio-generation'],
    input: ['text', 'audio'],
    output: ['text', 'audio'],
    release: '2025-11-01',
    updated: '2026-04-04',
    ctx: 64000,
    maxOut: 4096,
    open: false,
    availability: 'Cloud API',
    deploy: ['cloud-api'],
    pricingKind: 'free-tier',
    price: { input: 0.5, output: null },
    bench: [['sample-benchmark-1', 66, 'PROVIDER_REPORTED', '2025-12-15']],
    cutoff: '2025-05',
    arch: null,
    tool: null,
  },
  {
    n: 6,
    provider: 'F',
    family: 'Sample Family U',
    version: null,
    cats: ['llm'],
    caps: ['text-generation'],
    input: ['text'],
    output: ['text'],
    release: '2025-10-01',
    updated: '2026-01-10',
    ctx: 16000,
    maxOut: 2048,
    open: true,
    availability: 'Local deployment',
    deploy: ['local'],
    pricingKind: 'unknown',
    bench: [['sample-benchmark-3', 49, 'COMMUNITY', '2025-11-10']],
    cutoff: null,
    arch: null,
    tool: false,
  },
  {
    n: 7,
    provider: 'A',
    family: 'Sample Family X',
    version: '0.9',
    cats: ['llm'],
    caps: ['text-generation', 'code-generation'],
    input: ['text'],
    output: ['text'],
    release: '2025-09-01',
    updated: '2026-03-01',
    ctx: 64000,
    maxOut: 4096,
    open: false,
    availability: 'Cloud API',
    deploy: ['cloud-api'],
    pricingKind: 'paid',
    price: { input: 0.5, output: 2 },
    bench: [['sample-benchmark-2', 52, 'PROVIDER_REPORTED', '2025-10-05']],
    cutoff: '2025-03',
    arch: null,
    tool: true,
    extraHistory: [
      {
        date: '2026-03-01',
        kind: 'DEPRECATION',
        title: 'Placeholder deprecation notice',
        description: 'Invented entry for layout testing.',
        sourceUrl: null,
      },
    ],
  },
  {
    n: 8,
    provider: 'A',
    family: 'Sample Image Family',
    version: '1.2',
    cats: ['image-generation'],
    caps: ['image-generation'],
    input: ['text'],
    output: ['image'],
    release: '2026-04-20',
    updated: '2026-08-30',
    ctx: null,
    maxOut: null,
    open: false,
    availability: 'Cloud API',
    deploy: ['cloud-api'],
    pricingKind: 'paid',
    otherPrice: { type: 'IMAGE', price: 0.04, unit: 'per image' },
    cutoff: null,
    arch: null,
    tool: false,
  },
  {
    n: 9,
    provider: 'B',
    family: 'Sample Video Family',
    version: null,
    cats: ['video-generation'],
    caps: ['video-generation', 'image-understanding'],
    input: ['text', 'image'],
    output: ['video'],
    release: '2026-06-10',
    updated: '2026-09-10',
    ctx: null,
    maxOut: null,
    open: false,
    availability: 'Hosted service',
    deploy: ['hosted-service'],
    pricingKind: 'custom',
    cutoff: null,
    arch: null,
    tool: false,
  },
  {
    n: 10,
    provider: 'C',
    family: 'Sample Embedding Family',
    version: '1.0',
    cats: ['embedding'],
    caps: [],
    input: ['text'],
    output: ['embeddings'],
    release: '2026-02-14',
    updated: '2026-02-14',
    ctx: 8192,
    maxOut: null,
    open: true,
    availability: 'Open weights',
    deploy: ['local', 'cloud-api'],
    pricingKind: 'paid',
    price: { input: 0.02, output: null },
    cutoff: null,
    arch: null,
    tool: false,
  },
  {
    n: 11,
    provider: 'D',
    family: 'Sample Family W',
    version: '3.5',
    cats: ['llm', 'reasoning', 'coding'],
    caps: ['text-generation', 'reasoning', 'code-generation', 'tool-calling', 'function-calling'],
    input: ['text', 'image'],
    output: ['text'],
    release: '2026-08-01',
    updated: '2026-09-20',
    ctx: 256000,
    maxOut: 64000,
    open: false,
    availability: 'Hosted service',
    deploy: ['hosted-service', 'cloud-api'],
    pricingKind: 'paid',
    price: { input: 5, output: 20, cached: 1.25, batchIn: 2.5, batchOut: 10 },
    bench: [
      ['sample-benchmark-1', 85, 'PROVIDER_REPORTED', '2026-08-15'],
      ['sample-benchmark-2', 79, 'PROVIDER_REPORTED', '2026-08-15'],
      ['sample-benchmark-3', 81, 'INDEPENDENT', '2026-09-02'],
      ['sample-benchmark-5', 70, 'INDEPENDENT', '2026-09-02'],
    ],
    cutoff: '2026-02',
    arch: 'Not publicly disclosed',
    tool: true,
  },
  {
    n: 12,
    provider: 'E',
    family: 'Sample Audio Family',
    version: null,
    cats: ['audio'],
    caps: ['audio-generation'],
    input: ['text'],
    output: ['audio'],
    release: '2026-05-05',
    updated: '2026-07-07',
    ctx: null,
    maxOut: null,
    open: false,
    availability: 'Cloud API',
    deploy: ['cloud-api'],
    pricingKind: 'free-tier',
    cutoff: null,
    arch: null,
    tool: false,
  },
  {
    n: 13,
    provider: 'F',
    family: 'Sample Family U',
    version: '2.0',
    cats: ['llm', 'multimodal'],
    caps: ['text-generation', 'image-understanding'],
    input: ['text', 'image'],
    output: ['text'],
    release: '2026-07-01',
    updated: '2026-08-08',
    ctx: 32000,
    maxOut: 4096,
    open: true,
    availability: 'Open weights',
    deploy: ['local'],
    pricingKind: 'unknown',
    bench: [['sample-benchmark-4', 52, 'COMMUNITY', '2026-07-20']],
    cutoff: '2026-01',
    arch: null,
    tool: false,
  },
  {
    n: 14,
    provider: 'G',
    family: 'Sample Family Q',
    version: null,
    cats: ['llm'],
    caps: ['text-generation'],
    input: ['text'],
    output: ['text'],
    release: '2026-03-15',
    updated: '2026-03-15',
    ctx: null,
    maxOut: null,
    open: false,
    availability: 'Cloud API',
    deploy: ['cloud-api'],
    pricingKind: 'unknown',
    cutoff: null,
    arch: null,
    tool: null,
  },
  {
    n: 15,
    provider: 'G',
    family: 'Sample Family Q',
    version: '1.1',
    cats: ['coding', 'llm'],
    caps: ['text-generation', 'code-generation', 'function-calling'],
    input: ['text'],
    output: ['text'],
    release: '2026-09-05',
    updated: '2026-09-25',
    ctx: 48000,
    maxOut: 8000,
    open: false,
    availability: 'Cloud API',
    deploy: ['cloud-api'],
    pricingKind: 'free-tier',
    price: { input: 0.3, output: 1.2 },
    bench: [['sample-benchmark-2', 61, 'PROVIDER_REPORTED', '2026-09-12']],
    cutoff: '2026-03',
    arch: null,
    tool: true,
  },
  {
    n: 16,
    provider: 'B',
    family: 'Sample Family Y',
    version: '2.0',
    cats: ['llm', 'reasoning'],
    caps: ['text-generation', 'reasoning', 'tool-calling'],
    input: ['text'],
    output: ['text'],
    release: '2025-08-01',
    updated: '2026-02-01',
    ctx: 128000,
    maxOut: 8192,
    open: false,
    availability: 'Cloud API',
    deploy: ['cloud-api'],
    pricingKind: 'paid',
    price: { input: 1.5, output: 6 },
    bench: [['sample-benchmark-1', 63, 'PROVIDER_REPORTED', '2025-09-01']],
    cutoff: '2025-02',
    arch: null,
    tool: true,
    extraHistory: [
      {
        date: '2026-02-01',
        kind: 'DEPRECATION',
        title: 'Placeholder deprecation notice',
        description: 'Invented entry for layout testing.',
        sourceUrl: null,
      },
    ],
  },
];

const benchBySlug = new Map(demoBenchmarks.map((b) => [b.slug, b]));

function buildResults(spec: Spec): BenchmarkResult[] {
  return (spec.bench ?? []).map(([slug, score, type, date]) => {
    const b = benchBySlug.get(slug)!;
    return {
      benchmarkSlug: slug,
      benchmarkName: b.name,
      category: b.category,
      benchmarkVersion: b.version,
      score,
      scoreUnit: '%',
      evaluationDate: date ?? spec.release,
      modelVersion: spec.version ?? 'unversioned',
      methodologyNotes: 'Placeholder methodology note. Invented for layout testing.',
      evaluationType: type,
      sourceUrl: null,
      isDemo: true,
    };
  });
}

function buildPricing(spec: Spec): PricingEntry[] {
  const unit = 'per 1M tokens';
  const base = { currency: 'USD', unit, sourceUrl: null, verifiedAt: null, isDemo: true } as const;
  const out: PricingEntry[] = [];
  const add = (type: PricingEntry['type'], price: number | null | undefined) => {
    if (price === undefined) return;
    out.push({
      ...base,
      type,
      price,
      effectiveFrom: spec.release,
      effectiveTo: null,
      isCurrent: true,
    });
  };
  if (spec.price) {
    add('INPUT', spec.price.input);
    add('OUTPUT', spec.price.output);
    add('CACHED_INPUT', spec.price.cached);
    add('BATCH_INPUT', spec.price.batchIn);
    add('BATCH_OUTPUT', spec.price.batchOut);
  }
  if (spec.otherPrice) {
    out.push({
      ...base,
      unit: spec.otherPrice.unit,
      type: spec.otherPrice.type,
      price: spec.otherPrice.price,
      effectiveFrom: spec.release,
      effectiveTo: null,
      isCurrent: true,
    });
  }
  if (spec.pastPrice) {
    const p = spec.pastPrice;
    // Historical prices stay in the table, labelled historical (docs/PROMPT.md section 2).
    out.push({
      ...base,
      type: 'INPUT',
      price: p.input,
      effectiveFrom: p.from,
      effectiveTo: p.to,
      isCurrent: false,
    });
    out.push({
      ...base,
      type: 'OUTPUT',
      price: p.output,
      effectiveFrom: p.from,
      effectiveTo: p.to,
      isCurrent: false,
    });
  }
  return out;
}

function buildHistory(spec: Spec, name: string): ReleaseHistoryEntry[] {
  const entries: ReleaseHistoryEntry[] = [
    {
      date: spec.release,
      kind: 'INITIAL',
      title: `${name} released`,
      description: 'Placeholder initial release entry. Invented for layout testing.',
      sourceUrl: null,
    },
    ...(spec.extraHistory ?? []),
  ];
  if (spec.pastPrice) {
    entries.push({
      date: '2026-07-01',
      kind: 'PRICING',
      title: 'Placeholder pricing change',
      description: 'Invented entry for layout testing.',
      sourceUrl: null,
    });
  }
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

function build(spec: Spec): ModelDetail {
  const provider = demoProviders.find((p) => p.monogram === spec.provider)!;
  const name = `Sample Model ${spec.n}`;
  const results = buildResults(spec);
  const pricing = buildPricing(spec);
  const modalities = [...new Set([...spec.input, ...spec.output])];
  const catText = spec.cats.map((c) => categoryLabel[c].toLowerCase()).join(', ');
  const tokenCurrent = pricing.filter((p) => p.isCurrent && p.unit === 'per 1M tokens');
  const priceOf = (t: PricingEntry['type']) => tokenCurrent.find((p) => p.type === t);
  const hasTokenPrice = tokenCurrent.some((p) => p.type === 'INPUT' || p.type === 'OUTPUT');

  return {
    slug: `sample-model-${spec.n}`,
    name,
    family: spec.family,
    version: spec.version,
    description: `${name} is a placeholder record for a ${catText} model. It exists only to test the layout and filters. Not a real record.`,
    providerSlug: provider.slug,
    providerName: provider.name,
    providerMonogram: provider.monogram,
    providerTier: provider.tier,
    releaseDate: spec.release,
    updatedAt: spec.updated,
    contextWindow: spec.ctx,
    modalities,
    availability: spec.availability,
    openWeights: spec.open,
    deployment: [...spec.deploy, spec.open ? 'open-weights' : 'proprietary'],
    pricingKind: spec.pricingKind,
    currentPricing: hasTokenPrice
      ? {
          input: priceOf('INPUT')?.price ?? null,
          output: priceOf('OUTPUT')?.price ?? null,
          currency: 'USD',
          unit: 'per 1M tokens',
        }
      : null,
    categories: spec.cats,
    capabilities: spec.caps,
    benchmarks: results,
    verificationStatus: 'UNVERIFIED',
    isDemo: true,

    sourceUrl: null,
    verifiedAt: null,
    collectedAt: COLLECTED_AT,
    overview: {
      purpose: `Placeholder purpose for a ${catText} model. This record is invented to test the model profile layout.`,
      useCases: ['Placeholder use case one', 'Placeholder use case two'],
      notableFeatures: [
        'Placeholder notable feature',
        ...(spec.tool ? ['Placeholder tool-use note'] : []),
      ],
      limitations: ['Placeholder limitation. Demo data has no verified limitations.'],
    },
    capabilityAvailability: spec.caps.map((capability, i) => ({
      capability,
      availability: (i === spec.caps.length - 1 && spec.caps.length > 3
        ? 'PREVIEW'
        : 'AVAILABLE') as CapabilityAvailability,
    })),
    specs: {
      maxOutputTokens: spec.maxOut,
      inputModalities: spec.input,
      outputModalities: spec.output,
      toolCalling: spec.tool ?? null,
      structuredOutput: spec.tool ? true : null,
      functionCalling: spec.caps.includes('function-calling')
        ? true
        : spec.tool === false
          ? false
          : null,
      streaming:
        spec.availability === 'Cloud API' || spec.availability === 'Hosted service' ? true : null,
      knowledgeCutoff: spec.cutoff ?? null,
      trainingInfo: null,
      architecture: spec.arch ?? null,
      apiAvailability: spec.deploy.includes('cloud-api') ? 'Available' : null,
    },
    pricing,
    releaseHistory: buildHistory(spec, name),
    documentationUrl: null,
  };
}

export const demoModelDetails: ModelDetail[] = specs.map(build);
