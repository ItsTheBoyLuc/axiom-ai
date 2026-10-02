import type {
  BenchmarkResultRow,
  BenchmarkResultsQuery,
  BenchmarkSummary,
  NewsItem,
  NewsQuery,
  Page,
  ProviderDetail,
  ProviderSummary,
  ReleaseItem,
  ReleaseQuery,
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
}

export interface SearchRepository {
  search(q: string, types: readonly SearchType[], limit: number): Promise<SearchResults>;
}
