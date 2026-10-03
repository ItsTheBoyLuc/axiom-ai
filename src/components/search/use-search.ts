'use client';

import { useEffect, useState } from 'react';
import { cleanQuery } from '@/lib/search/model';
import type { SearchResults, SearchType } from '@/types/catalog';

const DELAY_MS = 150;

export type SearchState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  /** The latest results received; while a newer query loads these are kept so the list does not flicker. */
  results: SearchResults['results'] | null;
  /** The query `results` belong to. */
  forQuery: string;
};

type Received = { results: SearchResults['results'] | null; forQuery: string; failedFor: string };
const initial: Received = { results: null, forQuery: '', failedFor: '' };

/**
 * Debounced global search against `/api/v1/search`. A newer query aborts the previous request,
 * so a slow answer can never replace a faster, newer one. The status is derived from what was
 * typed versus what was received: no query is idle, results for another query mean loading.
 * `type` limits the search to one entity type (the palette's category chips).
 */
export function useSearch(query: string, type: SearchType | null, limit = 5): SearchState {
  const q = cleanQuery(query);
  const key = `${type ?? ''}|${q}`;
  const [got, setGot] = useState<Received>(initial);

  useEffect(() => {
    if (!q) return;
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      const params = new URLSearchParams({ q, limit: String(limit) });
      if (type) params.set('types', type);
      try {
        const res = await fetch(`/api/v1/search?${params}`, { signal: ctl.signal });
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { data: SearchResults };
        if (ctl.signal.aborted) return; // a newer query took over: never apply a stale answer
        setGot({ results: body.data.results, forQuery: key, failedFor: '' });
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setGot((g) => ({ ...g, failedFor: key }));
      }
    }, DELAY_MS);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q, type, limit, key]);

  if (!q) return { status: 'idle', results: null, forQuery: '' };
  const forQuery = got.forQuery.slice(got.forQuery.indexOf('|') + 1);
  if (got.failedFor === key) return { status: 'error', results: got.results, forQuery };
  return {
    status: got.forQuery === key ? 'ready' : 'loading',
    results: got.results,
    forQuery,
  };
}
