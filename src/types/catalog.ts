import type { VerificationStatus } from '@/lib/verification';
import type { BenchmarkOption, BenchmarkResult, ModelListItem, ReleaseKind } from './model';

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
  provider: { slug: string; name: string } | null;
  models: { slug: string; name: string }[];
  verificationStatus: VerificationStatus;
  isDemo: boolean;
};

export type NewsQuery = {
  q?: string;
  category?: NewsCategoryKey;
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
