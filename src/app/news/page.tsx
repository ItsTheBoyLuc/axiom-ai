import type { Metadata } from 'next';
import Link from 'next/link';
import { NewsCard } from '@/components/news/news-card';
import { NewsFilters } from '@/components/news/news-filters';
import { ResearchList } from '@/components/news/research-list';
import { DemoBadge } from '@/components/ui/badges';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Pager } from '@/components/ui/pager';
import { Container } from '@/components/ui/section';
import { jsonLd } from '@/lib/json-ld';
import {
  FEATURED_COUNT,
  NEWS_PAGE_SIZE,
  hasNewsFilters,
  newsHref,
  parseNewsQuery,
  sourceFlag,
} from '@/lib/news/query';
import { getRepositories } from '../../../server/repositories';

// Reads the query string, so it is rendered per request; the repositories cache the heavy parts.
export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const DESCRIPTION =
  'AI model news and research, each story with its publisher, date and source link, labelled official or independent and AI-summarised.';

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = parseNewsQuery(await searchParams);
  return {
    title: q.tab === 'research' ? 'AI research publications' : 'AI model news',
    description: DESCRIPTION,
    alternates: { canonical: q.tab === 'research' ? '/news?tab=research' : '/news' },
    // Filtered and paged variants are not worth indexing; the two default tabs are.
    robots: hasNewsFilters(q) || q.page > 1 ? { index: false, follow: true } : undefined,
  };
}

export default async function NewsPage({ searchParams }: Props) {
  const query = parseNewsQuery(await searchParams);
  const repos = getRepositories();
  const news = query.tab === 'news';
  const showFeatured = news && query.page === 1 && !hasNewsFilters(query);

  const [providers, facets, researchTotal] = await Promise.all([
    repos.providers.listAll(),
    repos.news.facets(),
    repos.research.list({ page: 1, pageSize: 1 }).then((r) => r.total),
  ]);
  const featured = showFeatured
    ? (await repos.news.list({ official: true, page: 1, pageSize: FEATURED_COUNT })).items
    : [];
  const newsPage = news
    ? await repos.news.list({
        q: query.q || undefined,
        category: query.category ?? undefined,
        provider: query.provider ?? undefined,
        official: sourceFlag(query.source),
        page: query.page,
        pageSize: NEWS_PAGE_SIZE,
      })
    : null;
  const researchPage = news
    ? null
    : await repos.research.list({
        q: query.q || undefined,
        provider: query.provider ?? undefined,
        page: query.page,
        pageSize: NEWS_PAGE_SIZE,
      });

  const featuredIds = new Set(featured.map((n) => n.id));
  const stories = (newsPage?.items ?? []).filter((n) => !featuredIds.has(n.id));
  const page = newsPage ?? researchPage!;
  const hasDemo =
    stories.some((n) => n.isDemo) ||
    featured.some((n) => n.isDemo) ||
    (researchPage?.items.some((r) => r.isDemo) ?? false);

  const origin = process.env.APP_URL ?? 'http://localhost:3000';
  const structured = newsPage && {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: [...featured, ...stories].map((n, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'NewsArticle',
        headline: n.title,
        url: n.url,
        // A page that only shows an "updated" date has no known publication date.
        ...(n.dateIsUpdated ? { dateModified: n.publishedAt } : { datePublished: n.publishedAt }),
        publisher: { '@type': 'Organization', name: n.publisher },
        isBasedOn: n.url,
        mainEntityOfPage: `${origin}/news`,
      },
    })),
  };

  const tab = (on: boolean) =>
    `inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm transition-colors ${
      on ? 'bg-elevated text-fg' : 'text-fg-2 hover:text-fg'
    }`;

  return (
    <Container className="pt-10 pb-16 sm:pt-14">
      <Breadcrumbs
        items={[
          { name: 'Home', href: '/' },
          { name: 'News', href: '/news' },
        ]}
      />
      {structured && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(structured) }}
        />
      )}
      <header className="mb-8 max-w-3xl">
        <p className="t-eyebrow mb-3 flex items-center gap-3">
          News and research {hasDemo && <DemoBadge />}
        </p>
        <h1 className="t-h2">What is being announced and published</h1>
        <p className="t-lead mt-3">
          Real stories and papers, each linking to the original. Official announcements and
          independent reporting are labelled apart, and every summary written by an AI model says
          so.
        </p>
      </header>

      <div
        role="group"
        aria-label="Section"
        className="border-line bg-card mb-6 inline-flex rounded-lg border p-1"
      >
        <Link href={newsHref({})} aria-current={news ? 'true' : undefined} className={tab(news)}>
          News <span className="text-muted font-mono text-xs">{facets.total}</span>
        </Link>
        <Link
          href={newsHref({ tab: 'research' })}
          aria-current={!news ? 'true' : undefined}
          className={tab(!news)}
        >
          Research <span className="text-muted font-mono text-xs">{researchTotal}</span>
        </Link>
      </div>

      <NewsFilters
        query={query}
        providers={providers.map((p) => ({ value: p.slug, label: p.name }))}
        facets={facets}
      />

      {featured.length > 0 && (
        <section aria-labelledby="featured-title" className="mt-10">
          <h2 id="featured-title" className="t-h3 mb-1">
            Featured
          </h2>
          <p className="text-fg-2 mb-4 text-sm">The latest official announcements.</p>
          <ul className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {featured.map((n) => (
              <li key={n.id} className="h-full">
                <NewsCard item={n} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="stories-title" className="mt-10" aria-live="polite">
        <h2 id="stories-title" className="t-h3 mb-1">
          {news ? (featured.length > 0 ? 'All stories' : 'Stories') : 'Publications'}
        </h2>
        <p className="text-muted mb-5 text-sm" role="status">
          {page.total}{' '}
          {news
            ? page.total === 1
              ? 'story'
              : 'stories'
            : page.total === 1
              ? 'publication'
              : 'publications'}
          {page.pageCount > 1 && (
            <>
              {' '}
              &middot; page {page.page} of {page.pageCount}
            </>
          )}
        </p>
        {page.total === 0 ? (
          <p className="border-line-strong text-fg-2 rounded-2xl border border-dashed p-10 text-center text-sm">
            {news ? 'No stories match these filters.' : 'No publications match these filters.'}{' '}
            {hasNewsFilters(query) && (
              <Link
                href={newsHref({ tab: query.tab })}
                replace
                scroll={false}
                className="text-accent underline"
              >
                Clear all filters
              </Link>
            )}
          </p>
        ) : news ? (
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {stories.map((n) => (
              <li key={n.id} className="h-full">
                <NewsCard item={n} />
              </li>
            ))}
          </ul>
        ) : (
          <ResearchList items={researchPage!.items} />
        )}
        <Pager
          page={page.page}
          pageCount={page.pageCount}
          hrefFor={(p) => newsHref({ ...query, page: p })}
        />
      </section>
    </Container>
  );
}
