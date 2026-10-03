'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import {
  hasNewsFilters,
  newsCategoryLabel,
  newsHref,
  type NewsPageQuery,
  type NewsSource,
} from '@/lib/news/query';
import { NEWS_CATEGORIES, type NewsFacets } from '@/types/catalog';

const SEARCH_DELAY_MS = 300;
const control =
  'h-11 w-full rounded-lg border border-line-strong bg-elevated px-3 text-sm text-fg outline-none focus-visible:outline-2 focus-visible:outline-offset-2';

const chip = (on: boolean) =>
  `inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm transition-colors ${
    on
      ? 'border-accent bg-accent/10 text-fg'
      : 'border-line text-fg-2 hover:border-line-strong hover:text-fg'
  }`;

/**
 * Filters for `/news`. The category and source chips are real links with counts (so the URL is
 * the state and nothing needs JavaScript); search and provider replace the URL as you type or
 * choose. On the Research tab only search and provider apply.
 */
export function NewsFilters({
  query,
  providers,
  facets,
}: {
  query: NewsPageQuery;
  providers: { value: string; label: string }[];
  facets: NewsFacets;
}) {
  const router = useRouter();
  const id = useId();
  const [pending, startTransition] = useTransition();
  const [term, setTerm] = useState(query.q);
  const latest = useRef(query);
  useEffect(() => {
    latest.current = query;
  });

  const set = (patch: Partial<NewsPageQuery>) =>
    startTransition(() =>
      router.replace(newsHref({ ...latest.current, ...patch, page: 1 }), { scroll: false }),
    );

  useEffect(() => {
    if (term.trim() === latest.current.q) return;
    const t = setTimeout(() => set({ q: term.trim() }), SEARCH_DELAY_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  const news = query.tab === 'news';
  const sources: { value: NewsSource | null; label: string; count: number }[] = [
    { value: null, label: 'All sources', count: facets.total },
    { value: 'official', label: 'Official', count: facets.official },
    { value: 'independent', label: 'Independent', count: facets.independent },
  ];

  return (
    <section aria-label="Filter stories" aria-busy={pending} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-q`} className="text-fg text-sm font-medium">
            {news ? 'Search news' : 'Search research'}
          </label>
          <div className="relative mt-1.5">
            <Search
              size={15}
              aria-hidden
              className="text-muted pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
            />
            <input
              id={`${id}-q`}
              type="search"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              autoComplete="off"
              placeholder={news ? 'Title, summary or publisher' : 'Title or venue'}
              className={`${control} pl-9`}
            />
          </div>
        </div>
        <div>
          <label htmlFor={`${id}-provider`} className="text-fg text-sm font-medium">
            Provider
          </label>
          <select
            id={`${id}-provider`}
            value={query.provider ?? ''}
            onChange={(e) => set({ provider: e.target.value || null })}
            className={`${control} mt-1.5`}
          >
            <option value="">All providers</option>
            {providers.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {news && (
        <>
          <nav aria-label="Source type">
            <ul className="flex flex-wrap gap-2">
              {sources.map((s) => (
                <li key={s.label}>
                  <Link
                    href={newsHref({ ...query, source: s.value, page: 1 })}
                    replace
                    scroll={false}
                    aria-current={query.source === s.value ? 'true' : undefined}
                    className={chip(query.source === s.value)}
                  >
                    {s.label} <span className="text-muted font-mono text-xs">{s.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Categories">
            <ul className="flex flex-wrap gap-2">
              <li>
                <Link
                  href={newsHref({ ...query, category: null, page: 1 })}
                  replace
                  scroll={false}
                  aria-current={query.category === null ? 'true' : undefined}
                  className={chip(query.category === null)}
                >
                  All categories
                </Link>
              </li>
              {NEWS_CATEGORIES.map((c) => (
                <li key={c}>
                  <Link
                    href={newsHref({ ...query, category: c, page: 1 })}
                    replace
                    scroll={false}
                    aria-current={query.category === c ? 'true' : undefined}
                    className={chip(query.category === c)}
                  >
                    {newsCategoryLabel[c]}{' '}
                    <span className="text-muted font-mono text-xs">{facets.byCategory[c]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </>
      )}

      {hasNewsFilters(query) && (
        <p>
          <Link
            href={newsHref({ tab: query.tab })}
            replace
            scroll={false}
            className="text-accent text-sm underline"
          >
            Clear all filters
          </Link>
        </p>
      )}
    </section>
  );
}
