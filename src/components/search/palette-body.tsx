'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { ArrowUpRight, CornerDownLeft, History, Search } from 'lucide-react';
import { DemoBadge } from '@/components/ui/badges';
import { primaryNav } from '@/lib/routes';
import {
  cleanQuery,
  groupHits,
  isExternalHref,
  searchHref,
  searchTypeLabel,
  totalHits,
} from '@/lib/search/model';
import { SEARCH_TYPES, type SearchHit, type SearchType } from '@/types/catalog';
import { Highlight } from './highlight';
import { useRecentSearches } from './recent-store';
import { useSearch } from './use-search';

const pages = [{ label: 'Home', href: '/' }, ...primaryNav];

const heading =
  '[&_[cmdk-group-heading]]:text-muted [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:uppercase';
const item =
  'text-fg-2 data-[selected=true]:bg-card data-[selected=true]:text-fg flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-100';

type Suggestion = { slug: string; name: string; providerName: string };

/**
 * The command palette's content: a search field, category chips, and results from the real
 * search API (models, providers, benchmarks, releases, news, research) with the matching words
 * highlighted. With an empty field it offers recent searches, suggested models and pages. The
 * last row always opens the full results page. Results come from the server, so cmdk's own
 * filtering is off. Full keyboard operation: arrows move, Enter opens, Escape closes (Radix).
 */
export function PaletteBody({ close }: { close: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [type, setType] = useState<SearchType | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const recent = useRecentSearches();
  const search = useSearch(query, type);
  const q = cleanQuery(query);

  // A few real, recent models to offer before anything is typed.
  useEffect(() => {
    const ctl = new AbortController();
    fetch('/api/v1/models?sort=recent&pageSize=4', { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((b: { data: Suggestion[] }) => setSuggestions(b.data.slice(0, 4)))
      .catch(() => {
        /* suggestions are optional: no models offered if the request fails */
      });
    return () => ctl.abort();
  }, []);

  const groups = useMemo(() => (search.results ? groupHits(search.results) : []), [search.results]);

  // The selection follows the results: whenever the results change it returns to the first one
  // (otherwise the "See all" row, the only row while loading, would stay selected). Arrow keys
  // within one set of results are remembered under that set's key.
  const resultKey = `${type ?? ''}|${search.forQuery}|${search.status}`;
  const [picked, setPicked] = useState<{ key: string; value: string } | null>(null);
  const firstHit = groups[0]?.hits[0];
  // Typing exactly a page's name ("Models") puts that page first and selects it.
  const exactPage =
    q && type === null ? pages.find((p) => p.label.toLowerCase() === q.toLowerCase()) : undefined;
  const defaultValue = exactPage
    ? `page:${exactPage.href}`
    : q
      ? firstHit
        ? `${firstHit.type}:${firstHit.id}`
        : 'see-all'
      : undefined;
  const selected = picked?.key === resultKey ? picked.value : defaultValue;
  const hits = search.results ? totalHits(search.results) : 0;
  const matchingPages = q
    ? type === null
      ? pages.filter((p) => p.label.toLowerCase().includes(q.toLowerCase()))
      : []
    : pages;

  const go = (href: string) => {
    close();
    if (isExternalHref(href)) window.open(href, '_blank', 'noopener,noreferrer');
    else router.push(href);
  };
  const openHit = (h: SearchHit) => {
    recent.record(q);
    go(h.href);
  };
  const seeAll = () => {
    recent.record(q);
    go(searchHref(q, type ? [type] : []));
  };

  const status =
    search.status === 'loading'
      ? 'Searching…'
      : search.status === 'error'
        ? 'Search is unavailable right now. You can still open the full results.'
        : q && search.status === 'ready'
          ? hits === 0
            ? `No results for “${q}”.`
            : `${hits} ${hits === 1 ? 'result' : 'results'}`
          : '';

  const pagesGroup =
    matchingPages.length > 0 ? (
      <Command.Group heading="Pages" className={heading}>
        {matchingPages.map((p) => (
          <Command.Item
            key={p.href}
            value={`page:${p.href}`}
            onSelect={() => go(p.href)}
            className={item}
          >
            {p.label}
          </Command.Item>
        ))}
      </Command.Group>
    ) : null;

  return (
    <Command
      label="Search"
      loop
      shouldFilter={false}
      value={selected}
      onValueChange={(v) => setPicked({ key: resultKey, value: v })}
    >
      <div className="border-line flex items-center gap-3 border-b px-4">
        <Search size={18} className="text-muted" aria-hidden />
        <Command.Input
          ref={inputRef}
          autoFocus
          value={query}
          onValueChange={setQuery}
          placeholder="Search the catalogue…"
          aria-label="Search"
          className="text-fg placeholder:text-muted h-14 flex-1 rounded-md bg-transparent px-3 text-base outline-none focus-visible:-outline-offset-4!"
        />
        <kbd className="border-line text-muted rounded border px-1.5 py-0.5 font-mono text-[11px]">
          ESC
        </kbd>
      </div>

      <div
        role="group"
        aria-label="Search in"
        className="border-line flex gap-1.5 overflow-x-auto border-b px-3 py-2"
      >
        {[null, ...SEARCH_TYPES].map((t) => {
          const on = type === t;
          return (
            <button
              key={t ?? 'all'}
              type="button"
              aria-pressed={on}
              onClick={() => {
                setType(t);
                inputRef.current?.focus();
              }}
              className={`inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-xs transition-colors ${
                on
                  ? 'border-accent bg-accent/10 text-fg'
                  : 'border-line text-fg-2 hover:border-line-strong hover:text-fg'
              }`}
            >
              {t ? searchTypeLabel[t] : 'All'}
            </button>
          );
        })}
      </div>

      <p role="status" className="text-muted px-4 pt-2 text-xs empty:hidden">
        {status}
      </p>

      <Command.List className="max-h-[48vh] overflow-y-auto p-2">
        {!q && recent.list.length > 0 && (
          <Command.Group heading="Recent searches" className={heading}>
            {recent.list.map((r) => (
              <Command.Item
                key={r}
                value={`recent:${r}`}
                onSelect={() => setQuery(r)}
                className={item}
              >
                <span className="flex items-center gap-2">
                  <History size={14} className="text-muted" aria-hidden />
                  {r}
                </span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {!q && suggestions.length > 0 && (
          <Command.Group heading="Suggested models" className={heading}>
            {suggestions.map((m) => (
              <Command.Item
                key={m.slug}
                value={`suggest:${m.slug}`}
                onSelect={() => go(`/models/${m.slug}`)}
                className={item}
              >
                <span>
                  {m.name} <span className="text-muted">{m.providerName}</span>
                </span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {exactPage && pagesGroup}

        {q &&
          groups.map((g) => (
            <Command.Group key={g.type} heading={g.label} className={heading}>
              {g.hits.map((h) => (
                <Command.Item
                  key={`${h.type}:${h.id}`}
                  value={`${h.type}:${h.id}`}
                  onSelect={() => openHit(h)}
                  className={item}
                >
                  <span className="min-w-0">
                    <span className="text-fg block truncate">
                      <Highlight text={h.title} query={q} />
                    </span>
                    {h.subtitle && (
                      <span className="text-muted block truncate text-xs">{h.subtitle}</span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {h.isDemo && <DemoBadge />}
                    {isExternalHref(h.href) ? (
                      <>
                        <ArrowUpRight size={14} className="text-muted" aria-hidden />
                        <span className="sr-only">opens in a new tab</span>
                      </>
                    ) : null}
                  </span>
                </Command.Item>
              ))}
            </Command.Group>
          ))}

        {!exactPage && pagesGroup}

        {q && (
          <Command.Group heading="Everything" className={heading}>
            <Command.Item value="see-all" onSelect={seeAll} className={item}>
              <span>
                See all results for “<span className="text-fg">{q}</span>”
              </span>
              <CornerDownLeft size={14} className="text-muted" aria-hidden />
            </Command.Item>
          </Command.Group>
        )}

        {!q && matchingPages.length === 0 && (
          <Command.Empty className="text-fg-2 px-3 py-8 text-center text-sm">
            Nothing to show.
          </Command.Empty>
        )}
      </Command.List>

      <div className="border-line text-muted flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-2 text-[11px]">
        <span>
          <kbd className="font-mono">↑↓</kbd> navigate
        </span>
        <span>
          <kbd className="font-mono">↵</kbd> open
        </span>
        <span>
          <kbd className="font-mono">esc</kbd> close
        </span>
      </div>
    </Command>
  );
}
