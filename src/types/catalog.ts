import type { VerificationStatus } from '@/lib/verification';
import type {
  BenchmarkOption,
  BenchmarkResult,
  EvaluationType,
  ModelListItem,
  ReleaseKind,
} from './model';

/** Shapes for the read side beyond models: providers, benchmarks, releases, news, search. */

export type Page<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export type ProviderSummary = {
  slug: string;
  name: string;
  monogram: string;
  description: string;
  /** "listed" providers get their own filter entry; the rest are grouped under "Other". */
  tier: 'listed' | 'other';
  officialWebsite: string | null;
  headquarters: string | null;
  orgType: string;
  modelCount: number;
  /** The provider's newest release entry (the latest announcement), null when it has none. */
  latestRelease: { title: string; date: string; announcementUrl: string | null } | null;
  verificationStatus: VerificationStatus;
  isDemo: boolean;
};

export type PublicationItem = {
  title: string;
  url: string;
  publishedAt: string;
  venue: string | null;
};

export type ProviderDetail = ProviderSummary & {
  logoUrl: string | null;
  sourceUrl: string | null;
  verifiedAt: string | null;
  collectedAt: string;
  models: ModelListItem[];
  releases: ReleaseItem[];
  publications: PublicationItem[];
};

export type BenchmarkSummary = BenchmarkOption & {
  resultCount: number;
  /** Distinct models with at least one result. */
  modelCount: number;
  /** Newest evaluation date (YYYY-MM-DD), null without results. */
  latestDate: string | null;
  /** Result count per evaluation type (all three keys always present). */
  byType: Record<EvaluationType, number>;
  /** Distinct score units used by this benchmark's results, sorted. */
  units: string[];
  verificationStatus: VerificationStatus;
  isDemo: boolean;
};

export type BenchmarkResultRow = BenchmarkResult & {
  model: { slug: string; name: string; family: string; version: string | null };
  provider: { slug: string; name: string };
};

export type BenchmarkResultsQuery = {
  benchmark?: string;
  provider?: string;
  family?: string;
  /** Model version the result was measured on. */
  version?: string;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
};

export type ReleaseItem = {
  id: string;
  kind: ReleaseKind;
  date: string;
  title: string;
  description: string;
  announcementUrl: string | null;
  docsUrl: string | null;
  provider: { slug: string; name: string };
  model: { slug: string; name: string } | null;
  /** Only officially verified / independently evaluated releases are shown as confirmed. */
  confirmed: boolean;
  verificationStatus: VerificationStatus;
  isDemo: boolean;
};

export type ReleaseQuery = {
  q?: string;
  provider?: string;
  /** Release kind, e.g. "major" or "api-change". */
  category?: ReleaseKind;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
};

/**
 * Controlled vocabulary for Benchmark.category (kebab-case keys). The first eight are the rows of
 * the profile capabilities matrix; a benchmark only evidences a row when its category is that key.
 */
export const BENCHMARK_CATEGORIES = [
  'reasoning',
  'coding',
  'mathematics',
  'multimodal',
  'long-context',
  'tool-use',
  'instruction-following',
  'creative-writing',
  'computer-use',
  'browsing',
  'professional-work',
  'science',
] as const;
export type BenchmarkCategoryKey = (typeof BENCHMARK_CATEGORIES)[number];

export const benchmarkCategoryLabel: Record<BenchmarkCategoryKey, string> = {
  reasoning: 'Reasoning',
  coding: 'Coding',
  mathematics: 'Mathematics',
  multimodal: 'Multimodal',
  'long-context': 'Long context',
  'tool-use': 'Tool use',
  'instruction-following': 'Instruction following',
  'creative-writing': 'Creative writing',
  'computer-use': 'Computer use',
  browsing: 'Browsing',
  'professional-work': 'Professional work',
  science: 'Science',
};

export const NEWS_CATEGORIES = [
  'MODEL_RELEASES',
  'RESEARCH',
  'COMPANIES',
  'INFRASTRUCTURE',
  'HARDWARE',
  'SAFETY',
  'REGULATION',
] as const;
export type NewsCategoryKey = (typeof NEWS_CATEGORIES)[number];

export type NewsItem = {
  id: string;
  title: string;
  summary: string;
  publisher: string;
  url: string;
  publishedAt: string;
  category: NewsCategoryKey;
  isOfficial: boolean;
  isAiSummary: boolean;
  /** `publishedAt` is the page's last-updated date (no publication date is shown): label it "Updated". */
  dateIsUpdated: boolean;
  provider: { slug: string; name: string } | null;
  models: { slug: string; name: string }[];
  verificationStatus: VerificationStatus;
  isDemo: boolean;
};

export type NewsQuery = {
  q?: string;
  category?: NewsCategoryKey;
  provider?: string;
  /** true: only official sources; false: only independent reporting; undefined: both. */
  official?: boolean;
  page: number;
  pageSize: number;
};

/** Counts for the news filters (over all stories, ignoring the current filters). */
export type NewsFacets = {
  total: number;
  official: number;
  independent: number;
  byCategory: Record<NewsCategoryKey, number>;
};

/** A research publication (paper, technical report) with its provider. */
export type ResearchItem = {
  id: string;
  title: string;
  url: string;
  publishedAt: string;
  venue: string | null;
  provider: { slug: string; name: string };
  verificationStatus: VerificationStatus;
  isDemo: boolean;
};

export type ResearchQuery = {
  q?: string;
  provider?: string;
  page: number;
  pageSize: number;
};

export const SEARCH_TYPES = [
  'models',
  'providers',
  'benchmarks',
  'releases',
  'news',
  'research',
] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];

export type SearchHit = {
  type: SearchType;
  id: string;
  title: string;
  subtitle: string | null;
  /** Internal path, or the external article/paper URL for news and research. */
  href: string;
  isDemo: boolean;
};

export type SearchResults = {
  q: string;
  results: Record<SearchType, SearchHit[]>;
};
