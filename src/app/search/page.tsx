import type { Metadata } from 'next';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { HitRow } from '@/components/search/hit-row';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Container } from '@/components/ui/section';
import {
  cleanQuery,
  groupHits,
  parseTypes,
  searchHref,
  searchTypeLabel,
  totalHits,
  typeSearchHref,
} from '@/lib/search/model';
import { SEARCH_TYPES } from '@/types/catalog';
import { getRepositories } from '../../../server/repositories';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const LIMIT = 10; // the API's maximum per type

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const q = cleanQuery(Array.isArray(sp.q) ? (sp.q[0] ?? '') : (sp.q ?? ''));
  return {
    title: q ? `Search: ${q}` : 'Search',
    description: 'Search AI models, providers, benchmarks, releases, news and research.',
    // Search result pages are never worth indexing.
    robots: { index: false, follow: true },
  };
}

const chip = (on: boolean) =>
  `inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm transition-colors ${
    on
      ? 'border-accent bg-accent/10 text-fg'
      : 'border-line text-fg-2 hover:border-line-strong hover:text-fg'
  }`;

export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = cleanQuery(Array.isArray(sp.q) ? (sp.q[0] ?? '') : (sp.q ?? ''));
  const types = parseTypes(sp.types);
  const only = types.length === 1 ? types[0]! : null;

  // Always search every type (for the chip counts); show the chosen one.
  const results = q
    ? (await getRepositories().search.search(q, [...SEARCH_TYPES], LIMIT)).results
    : null;
  const shown = results ? groupHits(results).filter((g) => !only || g.type === only) : [];
  const total = results ? totalHits(results) : 0;

  return (
    <Container className="pt-10 pb-16 sm:pt-14">
      <Breadcrumbs
        items={[
          { name: 'Home', href: '/' },
          { name: 'Search', href: '/search' },
        ]}
      />
      <header className="mb-8 max-w-3xl">
        <p className="t-eyebrow mb-3">Search</p>
        <h1 className="t-h2">{q ? <>Results for &ldquo;{q}&rdquo;</> : 'Search the catalogue'}</h1>
        <p className="t-lead mt-3">
          Models, providers, benchmarks, releases, news and research in one place. You can also open
          the search palette anywhere with Ctrl+K or ⌘K.
        </p>
      </header>

      {/* A plain GET form: works without JavaScript and keeps the query in the URL. */}
      <form action="/search" method="get" role="search" className="mb-6 flex flex-wrap gap-3">
        {only && <input type="hidden" name="types" value={only} />}
        <div className="relative min-w-0 flex-1 sm:max-w-xl">
          <label htmlFor="search-q" className="sr-only">
            Search query
          </label>
          <Search
            size={15}
            aria-hidden
            className="text-muted pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
          />
          <input
            id="search-q"
            name="q"
            type="search"
            defaultValue={q}
            autoComplete="off"
            maxLength={100}
            placeholder="Search everything"
            className="border-line-strong bg-elevated text-fg h-11 w-full rounded-lg border pr-3 pl-9 text-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
          />
        </div>
        <button
          type="submit"
          className="bg-accent text-accent-fg inline-flex h-11 items-center rounded-lg px-5 text-sm font-medium hover:brightness-110"
        >
          Search
        </button>
      </form>

      {!q ? (
        <p className="border-line-strong text-fg-2 rounded-2xl border border-dashed p-10 text-center text-sm">
          Type a model, provider, benchmark or topic above.
        </p>
      ) : (
        <>
          <nav aria-label="Result type" className="mb-8">
            <ul className="flex flex-wrap gap-2">
              <li>
                <Link
                  href={searchHref(q)}
                  aria-current={only === null ? 'true' : undefined}
                  className={chip(only === null)}
                >
                  All <span className="text-muted font-mono text-xs">{total}</span>
                </Link>
              </li>
              {SEARCH_TYPES.map((t) => {
                const n = results![t].length;
                return (
                  <li key={t}>
                    <Link
                      href={searchHref(q, [t])}
                      aria-current={only === t ? 'true' : undefined}
                      className={chip(only === t)}
                    >
                      {searchTypeLabel[t]}{' '}
                      <span className="text-muted font-mono text-xs">
                        {n >= LIMIT ? `${n}+` : n}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <p className="text-muted mb-6 text-sm" role="status">
            {shown.reduce((n, g) => n + g.hits.length, 0)}{' '}
            {shown.reduce((n, g) => n + g.hits.length, 0) === 1 ? 'result' : 'results'}
            {total >= LIMIT && <> &middot; up to {LIMIT} per type</>}
          </p>

          {shown.length === 0 ? (
            <div className="border-line-strong text-fg-2 rounded-2xl border border-dashed p-10 text-center text-sm">
              <p>
                No results for &ldquo;{q}&rdquo;
                {only ? ` in ${searchTypeLabel[only].toLowerCase()}` : ''}.
              </p>
              <p className="mt-3">
                {only && (
                  <>
                    <Link href={searchHref(q)} className="text-accent underline">
                      Search everything
                    </Link>{' '}
                    or{' '}
                  </>
                )}
                browse the{' '}
                <Link href="/models" className="text-accent underline">
                  models
                </Link>
                ,{' '}
                <Link href="/providers" className="text-accent underline">
                  providers
                </Link>{' '}
                or{' '}
                <Link href="/benchmarks" className="text-accent underline">
                  benchmarks
                </Link>
                .
              </p>
            </div>
          ) : (
            <div className="space-y-10">
              {shown.map((g) => {
                const more = typeSearchHref[g.type];
                return (
                  <section key={g.type} aria-labelledby={`res-${g.type}`}>
                    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                      <h2 id={`res-${g.type}`} className="t-h3">
                        {g.label}
                      </h2>
                      {more && g.hits.length >= 1 && (
                        <Link href={more(q)} className="text-accent text-sm hover:underline">
                          View all matching {g.label.toLowerCase()}
                        </Link>
                      )}
                    </div>
                    <ul className="space-y-2">
                      {g.hits.map((h) => (
                        <HitRow key={`${h.type}:${h.id}`} hit={h} query={q} />
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}
    </Container>
  );
}
