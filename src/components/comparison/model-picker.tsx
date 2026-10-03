'use client';

import Link from 'next/link';
import { useEffect, useId, useState } from 'react';
import { History, Plus, Search } from 'lucide-react';
import { useCompareHistory } from './history-store';
import { useRecentlyViewed } from './comparison-store';
import { MAX_COMPARE, compareHrefForSlugs, type ModelRef } from '@/lib/comparison';
import { CATEGORIES, categoryLabel, type ModelListItem } from '@/types/model';

const SEARCH_DELAY_MS = 150;
const PAGE = 8;

export type ProviderOption = { value: string; label: string };

const field =
  'h-11 w-full rounded-lg border border-line-strong bg-elevated px-3 text-sm text-fg outline-none focus-visible:outline-2 focus-visible:outline-offset-2';

/**
 * Add-a-model panel for /compare: instant search with provider and category filters (the
 * directory API does the filtering), the models you viewed recently, and your recent
 * comparisons. Everything is a real button or link; adding is refused (with the reason shown)
 * once four models are selected.
 */
export function ModelPicker({
  selected,
  providers,
  onAdd,
}: {
  selected: string[];
  providers: ProviderOption[];
  onAdd: (ref: ModelRef) => void;
}) {
  const id = useId();
  const [q, setQ] = useState('');
  const [provider, setProvider] = useState('');
  const [category, setCategory] = useState('');
  const [items, setItems] = useState<ModelListItem[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const recent = useRecentlyViewed();
  const history = useCompareHistory();
  const full = selected.length >= MAX_COMPARE;

  // Debounced fetch; a newer query aborts the previous request so a slow answer never wins.
  useEffect(() => {
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      setState('loading');
      const params = new URLSearchParams({ sort: 'alpha', pageSize: String(PAGE) });
      if (q.trim()) params.set('q', q.trim());
      if (provider) params.set('provider', provider);
      if (category) params.set('category', category);
      try {
        const res = await fetch(`/api/v1/models?${params}`, { signal: ctl.signal });
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { data: ModelListItem[] };
        setItems(body.data);
        setState('idle');
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setState('error');
      }
    }, SEARCH_DELAY_MS);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q, provider, category]);

  const ref = (m: { slug: string; name: string; providerName: string }): ModelRef => ({
    slug: m.slug,
    name: m.name,
    providerName: m.providerName,
  });

  const addButton = (m: { slug: string; name: string; providerName: string }) => {
    const on = selected.includes(m.slug);
    return (
      <button
        type="button"
        disabled={on || full}
        onClick={() => onAdd(ref(m))}
        aria-label={on ? `${m.name} is already selected` : `Add ${m.name} to the comparison`}
        title={
          full && !on ? `You can compare up to ${MAX_COMPARE} models. Remove one first.` : undefined
        }
        className="border-line-strong bg-elevated text-fg hover:border-fg-2/50 inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-45"
      >
        <Plus size={14} aria-hidden />
        {on ? 'Added' : 'Add'}
      </button>
    );
  };

  const recents = recent.list.filter((m) => !selected.includes(m.slug)).slice(0, 6);

  return (
    <section
      aria-labelledby={`${id}-h`}
      className="border-line bg-card rounded-2xl border p-5 sm:p-6"
    >
      <h2 id={`${id}-h`} className="t-h3">
        Add a model
      </h2>
      <p className="text-fg-2 mt-1 text-sm" aria-live="polite">
        {full
          ? `You are comparing ${MAX_COMPARE} models, the maximum. Remove one to add another.`
          : `Pick up to ${MAX_COMPARE} models. ${selected.length}/${MAX_COMPARE} selected.`}
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <label htmlFor={`${id}-q`} className="text-fg text-sm font-medium">
            Search models
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
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoComplete="off"
              placeholder="Name, family or provider"
              className={`${field} pl-9`}
            />
          </div>
        </div>
        <div>
          <label htmlFor={`${id}-p`} className="text-fg text-sm font-medium">
            Provider
          </label>
          <select
            id={`${id}-p`}
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className={`${field} mt-1.5`}
          >
            <option value="">All providers</option>
            {providers.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-c`} className="text-fg text-sm font-medium">
            Category
          </label>
          <select
            id={`${id}-c`}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={`${field} mt-1.5`}
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {categoryLabel[c]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4" aria-busy={state === 'loading'}>
        <p role="status" className="text-muted mb-2 text-xs">
          {state === 'error'
            ? 'Could not load models. Check your connection and try again.'
            : state === 'loading'
              ? 'Searching...'
              : items.length === 0
                ? 'No models match these filters.'
                : `${items.length} ${items.length === 1 ? 'model' : 'models'} shown${items.length === PAGE ? ' (refine the search to see others)' : ''}.`}
        </p>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {items.map((m) => (
            <li
              key={m.slug}
              className="border-line flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
            >
              <span className="min-w-0">
                <span className="text-fg block truncate text-sm">{m.name}</span>
                <span className="text-muted block truncate text-xs">{m.providerName}</span>
              </span>
              {addButton(m)}
            </li>
          ))}
        </ul>
      </div>

      {recents.length > 0 && (
        <div className="mt-5">
          <h3 className="text-fg-2 text-xs font-medium tracking-wide uppercase">Recently viewed</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {recents.map((m) => (
              <li key={m.slug}>
                <button
                  type="button"
                  disabled={full}
                  onClick={() => onAdd(m)}
                  aria-label={`Add ${m.name} to the comparison`}
                  className="border-line text-fg-2 hover:border-line-strong hover:text-fg inline-flex h-8 items-center gap-1 rounded-full border px-3 text-xs disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Plus size={12} aria-hidden />
                  {m.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {history.list.length > 0 && (
        <div className="mt-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-fg-2 flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
              <History size={13} aria-hidden /> Recent comparisons
            </h3>
            <button
              type="button"
              onClick={history.clear}
              className="text-muted hover:text-fg text-xs underline"
            >
              Clear history
            </button>
          </div>
          <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {history.list.map((h) => (
              <li key={h.slugs.join(',')}>
                <Link
                  href={compareHrefForSlugs(h.slugs)}
                  className="border-line text-fg-2 hover:border-line-strong hover:text-fg block truncate rounded-lg border px-3 py-2 text-sm"
                >
                  {h.names.join(' vs ')}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
