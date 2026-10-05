import type { Metadata } from 'next';
import { ModelCard } from '@/components/models/model-card';
import { DirectoryShell } from '@/components/models/directory/directory-shell';
import { Pagination } from '@/components/models/directory/pagination';
import { RecentlyViewed } from '@/components/models/directory/recently-viewed';
import { EmptyState, ResultsShell } from '@/components/models/directory/results-shell';
import { ModelsUrlProvider } from '@/components/models/directory/url-state';
import { DemoBadge } from '@/components/ui/badges';
import { Container } from '@/components/ui/section';
import { parseModelQuery, toSearchParams } from '@/lib/models/query';
import { getModelRepository } from '../../../../server/repositories/model-repository';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const DESCRIPTION =
  'Browse, search and filter AI models by provider, category, capability, deployment and pricing.';

/**
 * The plain directory is the page worth indexing. Every filtered, searched, sorted or paginated
 * variant is one of unboundedly many URLs, so it stays out of search results and points at the
 * canonical one. (Demo fixtures never reach production: SEED_DEMO is for tests only.)
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const q = parseModelQuery(await searchParams);
  const plain = toSearchParams(q).size === 0;
  return {
    title: 'AI models',
    description: DESCRIPTION,
    alternates: { canonical: '/models' },
    robots: plain ? undefined : { index: false, follow: true },
  };
}

export default async function ModelsPage({ searchParams }: { searchParams: SearchParams }) {
  const query = parseModelQuery(await searchParams);
  const repo = getModelRepository();
  const [result, benchmarks] = await Promise.all([repo.list(query), repo.benchmarks()]);
  const sortBenchmark =
    query.sort === 'benchmark'
      ? (benchmarks.find((b) => b.slug === query.benchmark) ?? null)
      : null;

  return (
    <Container className="py-10 sm:py-14">
      <header className="mb-8 max-w-3xl">
        <p className="t-eyebrow mb-3 flex items-center gap-3">
          Directory {result.hasDemo && <DemoBadge />}
        </p>
        <h1 className="t-h2">AI models</h1>
        <p className="t-lead mt-3">
          Search and filter every model in one place. Sorting never produces an overall ranking.
        </p>
        {result.hasDemo && (
          <p className="text-fg-2 border-warn/40 bg-warn/5 mt-4 rounded-xl border px-4 py-3 text-sm">
            <strong className="text-fg">Demo data.</strong> Every record below is a placeholder used
            to build and test this page. Verified, sourced data arrives in Phase 3.
          </p>
        )}
      </header>

      <ModelsUrlProvider query={query}>
        <RecentlyViewed />
        <DirectoryShell facets={result.facets} benchmarks={benchmarks} total={result.total}>
          <ResultsShell>
            <h2 className="sr-only">Results</h2>
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <p role="status" aria-live="polite" className="text-fg-2 text-sm">
                <span className="text-fg font-mono">{result.total}</span>{' '}
                {result.total === 1 ? 'model' : 'models'}
                {result.pageCount > 1 && (
                  <span className="text-muted">
                    {' '}
                    &middot; page {result.page} of {result.pageCount}
                  </span>
                )}
              </p>
              {sortBenchmark && (
                <p className="text-muted text-xs">
                  Sorted by <span className="text-fg-2">{sortBenchmark.name}</span> only. Benchmarks
                  are never combined into an overall ranking.
                </p>
              )}
            </div>

            {result.items.length > 0 ? (
              <>
                <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {result.items.map((m) => (
                    <li key={m.slug}>
                      <ModelCard model={m} sortBenchmark={sortBenchmark} />
                    </li>
                  ))}
                </ul>
                <Pagination query={query} page={result.page} pageCount={result.pageCount} />
              </>
            ) : (
              <EmptyState />
            )}
          </ResultsShell>
        </DirectoryShell>
      </ModelsUrlProvider>
    </Container>
  );
}
