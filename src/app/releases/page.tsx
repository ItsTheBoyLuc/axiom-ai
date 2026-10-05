import type { Metadata } from 'next';
import Link from 'next/link';
import { CinematicRoot } from '@/components/cinematic/cinematic-root';
import { ReleaseFilters } from '@/components/releases/release-filters';
import { ReleaseList } from '@/components/releases/release-list';
import { ReleaseTimeline } from '@/components/releases/release-timeline';
import { DemoBadge } from '@/components/ui/badges';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Pager } from '@/components/ui/pager';
import { Container } from '@/components/ui/section';
import {
  RELEASES_PAGE_SIZE,
  hasReleaseFilters,
  parseReleasesQuery,
  releasesHref,
} from '@/lib/releases/query';
import { getRepositories } from '../../../server/repositories';
import { getCinematicSeed } from '../../../server/services/cinematic-seed';

// Reads the query string, so it is rendered per request; the repositories cache the heavy parts.
export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const DESCRIPTION =
  'A chronological timeline of AI model releases, updates, deprecations and API changes, each with its official announcement and whether it is confirmed.';

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = parseReleasesQuery(await searchParams);
  return {
    title: 'AI model releases',
    description: DESCRIPTION,
    alternates: { canonical: '/releases' },
    // Filtered, paged and list views are variations of one page: index only the default.
    robots:
      hasReleaseFilters(q) || q.page > 1 || q.view === 'list'
        ? { index: false, follow: true }
        : undefined,
  };
}

export default async function ReleasesPage({ searchParams }: Props) {
  const query = parseReleasesQuery(await searchParams);
  const repos = getRepositories();
  const [seed, result, providers] = await Promise.all([
    getCinematicSeed(),
    repos.releases.list({
      q: query.q || undefined,
      provider: query.provider ?? undefined,
      category: query.category ?? undefined,
      from: query.from ?? undefined,
      to: query.to ?? undefined,
      page: query.page,
      pageSize: RELEASES_PAGE_SIZE,
    }),
    repos.providers.listAll(),
  ]);
  const hasDemo = result.items.some((r) => r.isDemo);
  const unconfirmed = result.items.filter((r) => !r.confirmed).length;

  return (
    <CinematicRoot level="light" seed={seed}>
      <Container className="pt-10 pb-16 sm:pt-14">
        <Breadcrumbs
          items={[
            { name: 'Home', href: '/' },
            { name: 'Releases', href: '/releases' },
          ]}
        />
        <header className="mb-8 max-w-3xl" data-cine-state="featured" data-cine-head>
          <p data-cine-eyebrow className="t-eyebrow mb-3 flex items-center gap-3">
            Releases {hasDemo && <DemoBadge />}
          </p>
          <h1 data-cine-title className="t-h2">
            What shipped, and when
          </h1>
          <p data-cine-lead className="t-lead mt-3">
            Model releases, updates, deprecations and API changes in time order. Each entry links to
            its official announcement. Only releases confirmed by an official or independent source
            are marked confirmed; everything else says &ldquo;Unconfirmed&rdquo;.
          </p>
        </header>

        <ReleaseFilters
          query={query}
          providers={providers.map((p) => ({ value: p.slug, label: p.name }))}
        />

        <div className="mt-8" aria-live="polite" data-cine-state="releases">
          <p className="text-muted mb-5 text-sm" role="status">
            {result.total} {result.total === 1 ? 'release' : 'releases'}
            {result.pageCount > 1 && (
              <>
                {' '}
                &middot; page {result.page} of {result.pageCount}
              </>
            )}
            {unconfirmed > 0 && <> &middot; {unconfirmed} unconfirmed on this page</>}
          </p>

          {result.items.length === 0 ? (
            <p className="border-line-strong text-fg-2 rounded-2xl border border-dashed p-10 text-center text-sm">
              No releases match these filters.{' '}
              {hasReleaseFilters(query) && (
                <Link
                  href={releasesHref({ view: query.view })}
                  replace
                  scroll={false}
                  className="text-accent underline"
                >
                  Clear all filters
                </Link>
              )}
            </p>
          ) : query.view === 'list' ? (
            <ReleaseList items={result.items} />
          ) : (
            <ReleaseTimeline items={result.items} />
          )}

          <Pager
            page={result.page}
            pageCount={result.pageCount}
            hrefFor={(p) => releasesHref({ ...query, page: p })}
          />
        </div>
      </Container>
    </CinematicRoot>
  );
}
