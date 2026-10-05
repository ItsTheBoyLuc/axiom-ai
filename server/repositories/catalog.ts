import type { VerificationStatus } from '../../src/lib/verification';
import type {
  BenchmarkResultRow,
  BenchmarkResultsQuery,
  BenchmarkSummary,
  NewsFacets,
  NewsItem,
  NewsQuery,
  Page,
  ProviderDetail,
  ProviderSummary,
  ReleaseItem,
  ReleaseQuery,
  ResearchItem,
  ResearchQuery,
  SearchResults,
  SearchType,
} from '../../src/types/catalog';

/** Read-side contracts beyond models. Prisma implementations live in ./prisma/. */

export interface ProviderRepository {
  /** Every provider with its model count (small table; used by the homepage and filters). */
  listAll(): Promise<ProviderSummary[]>;
  list(q: { q?: string; page: number; pageSize: number }): Promise<Page<ProviderSummary>>;
  getBySlug(slug: string): Promise<ProviderDetail | null>;
}

export interface BenchmarkRepository {
  list(): Promise<BenchmarkSummary[]>;
  results(q: BenchmarkResultsQuery): Promise<Page<BenchmarkResultRow>>;
}

export interface ReleaseRepository {
  list(q: ReleaseQuery): Promise<Page<ReleaseItem>>;
}

export interface NewsRepository {
  list(q: NewsQuery): Promise<Page<NewsItem>>;
  /** Story counts by source type and category, for the filter UI. */
  facets(): Promise<NewsFacets>;
}

export interface ResearchRepository {
  list(q: ResearchQuery): Promise<Page<ResearchItem>>;
}

export interface SearchRepository {
  search(q: string, types: readonly SearchType[], limit: number): Promise<SearchResults>;
}

// ------------------------------------------------------------------- sources

/** Records backed by one source host (e.g. `openai.com`), split by verification status. */
export type SourceHost = {
  host: string;
  records: number;
  byStatus: Partial<Record<VerificationStatus, number>>;
};

/** What the public Sources and Methodology pages show: where the data comes from, in aggregate. */
export type SourcesSummary = {
  /** Every sourced record across the factual tables. */
  totalRecords: number;
  /** Records with a source URL, by host, largest first. */
  hosts: SourceHost[];
  /** Records without a source URL (only legal for NOT_PUBLICLY_DISCLOSED / UNVERIFIED). */
  withoutSource: number;
  byStatus: Record<VerificationStatus, number>;
};

export interface SourcesRepository {
  summary(): Promise<SourcesSummary>;
}
