import type { Metadata } from 'next';
import { BenchmarkDetail } from '@/components/benchmarks/benchmark-detail';
import { BenchmarkIndex } from '@/components/benchmarks/benchmark-index';
import { CategoryTabs } from '@/components/benchmarks/category-tabs';
import { OverviewStats } from '@/components/benchmarks/overview-stats';
import { DemoBadge } from '@/components/ui/badges';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Container } from '@/components/ui/section';
import { explorerHref, parseExplorerQuery } from '@/lib/benchmarks/query';
import { benchmarkCategoryLabel, type BenchmarkCategoryKey } from '@/types/catalog';
import { getRepositories } from '../../../server/repositories';
import { loadExplorer } from '../../../server/services/benchmark-explorer';
import Link from 'next/link';

// Reads the query string, so it is rendered per request; the repositories cache the heavy parts.
export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const DESCRIPTION =
  'Explore published AI benchmark results: every score with its evaluation type, date, model and benchmark version, methodology and source. No overall ranking.';

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = parseExplorerQuery(await searchParams);
  if (!q.benchmark) {
    const title = q.category
      ? `${benchmarkCategoryLabel[q.category]} benchmarks`
      : 'AI benchmark explorer';
    return {
      title,
      description: DESCRIPTION,
      alternates: { canonical: explorerHref({ category: q.category }) },
    };
  }
  const found = (await getRepositories().benchmarks.list()).find((b) => b.slug === q.benchmark);
  return {
    title: found ? `${found.name} results` : 'Benchmark not found',
    description: found ? found.description.slice(0, 200) : DESCRIPTION,
    // Filtered views are an unbounded set of URLs; the benchmark itself is the indexable page.
    alternates: found ? { canonical: explorerHref({ benchmark: found.slug }) } : undefined,
    robots: found ? undefined : { index: false },
  };
}

export default async function BenchmarksPage({ searchParams }: Props) {
  const query = parseExplorerQuery(await searchParams);
  const data = await loadExplorer(getRepositories(), query);
  const { selected } = data;
  const category: BenchmarkCategoryKey | null =
    query.category ??
    (selected && selected.category in benchmarkCategoryLabel
      ? (selected.category as BenchmarkCategoryKey)
      : null);
  const hasDemo = data.summaries.some((s) => s.isDemo);

  return (
    <Container className="pt-10 pb-16 sm:pt-14">
      <Breadcrumbs
        items={[
          { name: 'Home', href: '/' },
          { name: 'Benchmarks', href: '/benchmarks' },
          ...(selected
            ? [{ name: selected.name, href: explorerHref({ benchmark: selected.slug }) }]
            : []),
        ]}
      />
      <header className="mb-8 max-w-3xl">
        <p className="t-eyebrow mb-3 flex items-center gap-3">
          Benchmarks {hasDemo && <DemoBadge />}
        </p>
        <h1 className="t-h2">Benchmark explorer</h1>
        <p className="t-lead mt-3">
          Published benchmark results, one benchmark at a time. Every score shows its evaluation
          type, date, model and benchmark version, methodology and source. There is no overall
          ranking.
        </p>
      </header>

      {data.notFound && (
        <p
          role="alert"
          className="border-warn/40 bg-warn/5 text-fg-2 mb-6 rounded-xl border px-4 py-3 text-sm"
        >
          <strong className="text-fg">Benchmark not found.</strong> There is no benchmark called
          &ldquo;{query.benchmark}&rdquo;. Pick one below.
        </p>
      )}

      {selected ? (
        <BenchmarkDetail
          summary={selected}
          rows={data.rows}
          query={{ ...query, category }}
          truncated={data.truncated}
        />
      ) : data.summaries.length === 0 ? (
        <p className="border-line-strong text-fg-2 rounded-2xl border border-dashed p-10 text-center text-sm">
          No benchmarks have been published yet.{' '}
          <Link href="/models" className="text-accent underline">
            Browse models
          </Link>{' '}
          instead.
        </p>
      ) : (
        <>
          <OverviewStats summaries={data.summaries} />
          <CategoryTabs summaries={data.summaries} active={query.category} />
          <BenchmarkIndex summaries={data.summaries} category={query.category} />
        </>
      )}
    </Container>
  );
}
