import type { VerificationStatus } from '@/lib/verification';

/**
 * Domain types for models. UI and repositories depend on these, never on Prisma types,
 * so the demo repository can be swapped for the database one (Phase 3) without UI changes.
 */

export const CATEGORIES = [
  'llm',
  'reasoning',
  'multimodal',
  'coding',
  'image-generation',
  'video-generation',
  'audio',
  'embedding',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CAPABILITIES = [
  'text-generation',
  'image-understanding',
  'image-generation',
  'audio-understanding',
  'audio-generation',
  'video-understanding',
  'video-generation',
  'tool-calling',
  'function-calling',
  'code-generation',
  'reasoning',
] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const DEPLOYMENTS = [
  'cloud-api',
  'hosted-service',
  'local',
  'open-weights',
  'proprietary',
] as const;
export type Deployment = (typeof DEPLOYMENTS)[number];

export const PRICING_KINDS = ['free', 'paid', 'free-tier', 'custom', 'unknown'] as const;
export type PricingKind = (typeof PRICING_KINDS)[number];

export const SORTS = ['recent', 'updated', 'alpha', 'provider', 'context', 'benchmark'] as const;
export type Sort = (typeof SORTS)[number];

export const MODALITIES = ['text', 'image', 'audio', 'video', 'embeddings'] as const;
export type Modality = (typeof MODALITIES)[number];

export const categoryLabel: Record<Category, string> = {
  llm: 'LLM',
  reasoning: 'Reasoning',
  multimodal: 'Multimodal',
  coding: 'Coding',
  'image-generation': 'Image generation',
  'video-generation': 'Video generation',
  audio: 'Audio',
  embedding: 'Embedding',
};

export const capabilityLabel: Record<Capability, string> = {
  'text-generation': 'Text generation',
  'image-understanding': 'Image understanding',
  'image-generation': 'Image generation',
  'audio-understanding': 'Audio understanding',
  'audio-generation': 'Audio generation',
  'video-understanding': 'Video understanding',
  'video-generation': 'Video generation',
  'tool-calling': 'Tool calling',
  'function-calling': 'Function calling',
  'code-generation': 'Code generation',
  reasoning: 'Reasoning',
};

export const deploymentLabel: Record<Deployment, string> = {
  'cloud-api': 'Cloud API',
  'hosted-service': 'Hosted service',
  local: 'Local deployment',
  'open-weights': 'Open weights',
  proprietary: 'Proprietary',
};

export const pricingKindLabel: Record<PricingKind, string> = {
  free: 'Free',
  paid: 'Paid',
  'free-tier': 'Free tier',
  custom: 'Custom',
  unknown: 'Unknown',
};

export const sortLabel: Record<Sort, string> = {
  recent: 'Recently released',
  updated: 'Recently updated',
  alpha: 'Alphabetical',
  provider: 'Provider',
  context: 'Context window',
  benchmark: 'Single benchmark score',
};

export const modalityLabel: Record<Modality, string> = {
  text: 'Text',
  image: 'Image',
  audio: 'Audio',
  video: 'Video',
  embeddings: 'Embeddings',
};

export type EvaluationType = 'INDEPENDENT' | 'PROVIDER_REPORTED' | 'COMMUNITY';
export type CapabilityAvailability = 'AVAILABLE' | 'LIMITED' | 'PREVIEW' | 'NOT_AVAILABLE';
export type PricingType =
  | 'INPUT'
  | 'OUTPUT'
  | 'CACHED_INPUT'
  | 'BATCH_INPUT'
  | 'BATCH_OUTPUT'
  | 'IMAGE'
  | 'AUDIO'
  | 'OTHER';
export type ReleaseKind = 'INITIAL' | 'VERSION' | 'CAPABILITY' | 'DEPRECATION' | 'PRICING' | 'DOCS';

/** Fields every factual record carries (docs/PROMPT.md section 2). */
export type Sourced = {
  sourceUrl: string | null;
  verificationStatus: VerificationStatus;
  verifiedAt: string | null;
  collectedAt: string;
  isDemo: boolean;
};

export type BenchmarkOption = {
  slug: string;
  name: string;
  /** Capability row it evidences in the profile matrix (e.g. "coding"). */
  category: string;
  version: string | null;
  description: string;
  methodologyUrl: string | null;
};

export type BenchmarkResult = {
  benchmarkSlug: string;
  benchmarkName: string;
  category: string;
  benchmarkVersion: string | null;
  score: number;
  scoreUnit: string;
  evaluationDate: string;
  modelVersion: string;
  methodologyNotes: string | null;
  evaluationType: EvaluationType;
  sourceUrl: string | null;
  isDemo: boolean;
};

export type PricingEntry = {
  type: PricingType;
  /** Price in `currency` per `unit`. null = not publicly disclosed. */
  price: number | null;
  currency: string;
  unit: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  isCurrent: boolean;
  sourceUrl: string | null;
  verifiedAt: string | null;
  isDemo: boolean;
};

export type ReleaseHistoryEntry = {
  date: string;
  kind: ReleaseKind;
  title: string;
  description: string;
  sourceUrl: string | null;
};

/** Everything a list card needs. */
export type ModelListItem = {
  slug: string;
  name: string;
  family: string;
  version: string | null;
  description: string;
  providerSlug: string;
  providerName: string;
  providerMonogram: string;
  providerTier: 'listed' | 'other';
  releaseDate: string;
  updatedAt: string;
  contextWindow: number | null;
  modalities: Modality[];
  availability: string;
  openWeights: boolean;
  deployment: Deployment[];
  pricingKind: PricingKind;
  currentPricing: {
    input: number | null;
    output: number | null;
    currency: string;
    unit: string;
  } | null;
  categories: Category[];
  capabilities: Capability[];
  benchmarks: BenchmarkResult[];
  verificationStatus: VerificationStatus;
  isDemo: boolean;
};

export type ModelDetail = ModelListItem &
  Sourced & {
    overview: {
      purpose: string;
      useCases: string[];
      notableFeatures: string[];
      limitations: string[];
    };
    capabilityAvailability: { capability: Capability; availability: CapabilityAvailability }[];
    specs: {
      maxOutputTokens: number | null;
      inputModalities: Modality[];
      outputModalities: Modality[];
      toolCalling: boolean | null;
      structuredOutput: boolean | null;
      functionCalling: boolean | null;
      streaming: boolean | null;
      knowledgeCutoff: string | null;
      trainingInfo: string | null;
      architecture: string | null;
      apiAvailability: string | null;
    };
    pricing: PricingEntry[];
    releaseHistory: ReleaseHistoryEntry[];
    documentationUrl: string | null;
  };

export type ModelSuggestion = {
  slug: string;
  name: string;
  providerName: string;
  family: string;
  isDemo: boolean;
};

export type FacetOption = { value: string; label: string; count: number };
export type ModelFacets = {
  provider: FacetOption[];
  category: FacetOption[];
  capability: FacetOption[];
  deployment: FacetOption[];
  pricing: FacetOption[];
};

export type ModelListResult = {
  items: ModelListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  facets: ModelFacets;
  /** True when any returned record is demo data (UI shows a banner). */
  hasDemo: boolean;
};

/** Parsed, validated directory query (docs/PROMPT.md 7.2). */
export type ModelQuery = {
  q: string;
  provider: string[];
  category: Category[];
  capability: Capability[];
  deployment: Deployment[];
  pricing: PricingKind[];
  sort: Sort;
  /** Benchmark slug, used only when sort === 'benchmark'. */
  benchmark: string | null;
  page: number;
  pageSize: number;
};
