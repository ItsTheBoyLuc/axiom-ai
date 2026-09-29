import type { VerificationStatus } from './verification';

/**
 * PLACEHOLDER DATA for Phase 1 layout only (docs/PROMPT.md section 2).
 * Names are deliberately fictional and every value is invented; nothing here describes a
 * real provider, model, price, benchmark or article. Every record has isDemo = true and the
 * UI renders a DEMO DATA badge next to it. Replaced by sourced data in Phase 3.
 */

export type DemoProvider = {
  slug: string;
  name: string;
  monogram: string;
  description: string;
  modelCount: number;
  isDemo: true;
};

export type DemoModel = {
  slug: string;
  providerSlug: string;
  name: string;
  family: string;
  releaseDate: string;
  contextWindow: number;
  modalities: string[];
  pricing: { input: number; output: number; currency: 'USD'; unit: 'per 1M tokens' } | null;
  availability: string;
  openWeights: boolean;
  verificationStatus: VerificationStatus;
  benchmarks: {
    name: string;
    version: string;
    score: number;
    type: 'PROVIDER_REPORTED' | 'INDEPENDENT';
  }[];
  isDemo: true;
};

export type DemoRelease = {
  id: string;
  date: string;
  providerSlug: string;
  model: string;
  description: string;
  isDemo: true;
};

export type DemoNews = {
  id: string;
  title: string;
  publisher: string;
  date: string;
  summary: string;
  providerSlug: string;
  isOfficial: boolean;
  isAiSummary: boolean;
  isDemo: true;
};

const lorem = 'Placeholder description used to test the layout. Not a real record.';

export const demoProviders: DemoProvider[] = [
  {
    slug: 'demo-provider-a',
    name: 'Demo Provider A',
    monogram: 'A',
    description: lorem,
    modelCount: 3,
    isDemo: true,
  },
  {
    slug: 'demo-provider-b',
    name: 'Demo Provider B',
    monogram: 'B',
    description: lorem,
    modelCount: 2,
    isDemo: true,
  },
  {
    slug: 'demo-provider-c',
    name: 'Demo Provider C',
    monogram: 'C',
    description: lorem,
    modelCount: 2,
    isDemo: true,
  },
  {
    slug: 'demo-provider-d',
    name: 'Demo Provider D',
    monogram: 'D',
    description: lorem,
    modelCount: 1,
    isDemo: true,
  },
  {
    slug: 'demo-provider-e',
    name: 'Demo Provider E',
    monogram: 'E',
    description: lorem,
    modelCount: 1,
    isDemo: true,
  },
  {
    slug: 'demo-provider-f',
    name: 'Demo Provider F',
    monogram: 'F',
    description: lorem,
    modelCount: 1,
    isDemo: true,
  },
];

const bench = (a: number, b: number): DemoModel['benchmarks'] => [
  { name: 'Sample Benchmark 1', version: 'demo', score: a, type: 'PROVIDER_REPORTED' },
  { name: 'Sample Benchmark 2', version: 'demo', score: b, type: 'INDEPENDENT' },
];

export const demoModels: DemoModel[] = [
  {
    slug: 'sample-model-1',
    providerSlug: 'demo-provider-a',
    name: 'Sample Model 1',
    family: 'Sample Family X',
    releaseDate: '2026-03-01',
    contextWindow: 128000,
    modalities: ['Text', 'Image'],
    pricing: { input: 1, output: 4, currency: 'USD', unit: 'per 1M tokens' },
    availability: 'Cloud API',
    openWeights: false,
    verificationStatus: 'UNVERIFIED',
    benchmarks: bench(71, 64),
    isDemo: true,
  },
  {
    slug: 'sample-model-2',
    providerSlug: 'demo-provider-b',
    name: 'Sample Model 2',
    family: 'Sample Family Y',
    releaseDate: '2026-02-01',
    contextWindow: 200000,
    modalities: ['Text', 'Image', 'Audio'],
    pricing: { input: 2, output: 8, currency: 'USD', unit: 'per 1M tokens' },
    availability: 'Cloud API',
    openWeights: false,
    verificationStatus: 'UNVERIFIED',
    benchmarks: bench(78, 69),
    isDemo: true,
  },
  {
    slug: 'sample-model-3',
    providerSlug: 'demo-provider-c',
    name: 'Sample Model 3',
    family: 'Sample Family Z',
    releaseDate: '2026-01-01',
    contextWindow: 32000,
    modalities: ['Text'],
    pricing: null,
    availability: 'Open weights',
    openWeights: true,
    verificationStatus: 'UNVERIFIED',
    benchmarks: bench(58, 55),
    isDemo: true,
  },
  {
    slug: 'sample-model-4',
    providerSlug: 'demo-provider-d',
    name: 'Sample Model 4',
    family: 'Sample Family W',
    releaseDate: '2025-12-01',
    contextWindow: 1000000,
    modalities: ['Text', 'Image', 'Video'],
    pricing: { input: 3, output: 12, currency: 'USD', unit: 'per 1M tokens' },
    availability: 'Hosted service',
    openWeights: false,
    verificationStatus: 'UNVERIFIED',
    benchmarks: bench(82, 74),
    isDemo: true,
  },
  {
    slug: 'sample-model-5',
    providerSlug: 'demo-provider-e',
    name: 'Sample Model 5',
    family: 'Sample Family V',
    releaseDate: '2025-11-01',
    contextWindow: 64000,
    modalities: ['Text', 'Audio'],
    pricing: { input: 0.5, output: 2, currency: 'USD', unit: 'per 1M tokens' },
    availability: 'Cloud API',
    openWeights: false,
    verificationStatus: 'UNVERIFIED',
    benchmarks: bench(66, 60),
    isDemo: true,
  },
  {
    slug: 'sample-model-6',
    providerSlug: 'demo-provider-f',
    name: 'Sample Model 6',
    family: 'Sample Family U',
    releaseDate: '2025-10-01',
    contextWindow: 16000,
    modalities: ['Text'],
    pricing: null,
    availability: 'Local deployment',
    openWeights: true,
    verificationStatus: 'UNVERIFIED',
    benchmarks: bench(49, 47),
    isDemo: true,
  },
];

export const demoReleases: DemoRelease[] = [
  {
    id: 'r1',
    date: '2026-03-01',
    providerSlug: 'demo-provider-a',
    model: 'Sample Model 1',
    description: 'Placeholder release entry for layout testing.',
    isDemo: true,
  },
  {
    id: 'r2',
    date: '2026-02-01',
    providerSlug: 'demo-provider-b',
    model: 'Sample Model 2',
    description: 'Placeholder release entry for layout testing.',
    isDemo: true,
  },
  {
    id: 'r3',
    date: '2026-01-01',
    providerSlug: 'demo-provider-c',
    model: 'Sample Model 3',
    description: 'Placeholder release entry for layout testing.',
    isDemo: true,
  },
  {
    id: 'r4',
    date: '2025-12-01',
    providerSlug: 'demo-provider-d',
    model: 'Sample Model 4',
    description: 'Placeholder release entry for layout testing.',
    isDemo: true,
  },
];

export const demoNews: DemoNews[] = [
  {
    id: 'n1',
    title: 'Sample headline: an official announcement',
    publisher: 'Demo Publisher',
    date: '2026-03-02',
    summary: 'Placeholder summary used to test the news card layout. Not a real article.',
    providerSlug: 'demo-provider-a',
    isOfficial: true,
    isAiSummary: false,
    isDemo: true,
  },
  {
    id: 'n2',
    title: 'Sample headline: independent reporting',
    publisher: 'Demo Publisher',
    date: '2026-02-20',
    summary: 'Placeholder summary used to test the news card layout. Not a real article.',
    providerSlug: 'demo-provider-b',
    isOfficial: false,
    isAiSummary: true,
    isDemo: true,
  },
  {
    id: 'n3',
    title: 'Sample headline: research note',
    publisher: 'Demo Publisher',
    date: '2026-02-10',
    summary: 'Placeholder summary used to test the news card layout. Not a real article.',
    providerSlug: 'demo-provider-c',
    isOfficial: false,
    isAiSummary: false,
    isDemo: true,
  },
];

export const providerBySlug = (slug: string) => demoProviders.find((p) => p.slug === slug);
