'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { List, Rows3, Search } from 'lucide-react';
import {
  hasReleaseFilters,
  kindSlug,
  releasesHref,
  type ReleasesQuery,
  type ReleasesView,
} from '@/lib/releases/query';
import { RELEASE_KINDS, releaseKindLabel } from '@/types/model';

const SEARCH_DELAY_MS = 300;
const control =
  'h-11 w-full rounded-lg border border-line-strong bg-elevated px-3 text-sm text-fg outline-none focus-visible:outline-2 focus-visible:outline-offset-2';

/**
 * Release filters: search, provider, kind and date range, plus the timeline/list switch. Every
 * change replaces the URL (page resets to 1) and the server re-renders, so views are shareable
 * and the back button works. The search field is debounced.
 */
export function ReleaseFilters({
  query,
  providers,
}: {
  query: ReleasesQuery;
  providers: { value: string; label: string }[];
}) {
  const router = useRouter();
  const id = useId();
  const [pending, startTransition] = useTransition();
  const [term, setTerm] = useState(query.q);
  // The newest query, readable from the debounce timer without re-arming it on every URL change.
  const latest = useRef(query);
  useEffect(() => {
    latest.current = query;
  });

  const set = (patch: Partial<ReleasesQuery>) =>
    startTransition(() =>
      router.replace(releasesHref({ ...latest.current, ...patch, page: 1 }), { scroll: false }),
    );

  // Debounced search; skipped when the field already matches the URL (no loop on navigation).
  useEffect(() => {
    if (term.trim() === latest.current.q) return;
    const t = setTimeout(() => set({ q: term.trim() }), SEARCH_DELAY_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  const viewCls = (on: boolean) =>
    `inline-flex h-10 items-center gap-1.5 rounded-md px-3 text-sm transition-colors ${
      on ? 'bg-elevated text-fg' : 'text-fg-2 hover:text-fg'
    }`;
  const viewHref = (view: ReleasesView) => releasesHref({ ...query, view, page: 1 });

  return (
    <section
      aria-label="Filter releases"
      aria-busy={pending}
      className="border-line bg-card rounded-2xl border p-5"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2 lg:col-span-1">
          <label htmlFor={`${id}-q`} className="text-fg text-sm font-medium">
            Search releases
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
              placeholder="Title or description"
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
        <div>
          <label htmlFor={`${id}-kind`} className="text-fg text-sm font-medium">
            Kind
          </label>
          <select
            id={`${id}-kind`}
            value={query.category ? kindSlug(query.category) : ''}
            onChange={(e) =>
              set({ category: RELEASE_KINDS.find((k) => kindSlug(k) === e.target.value) ?? null })
            }
            className={`${control} mt-1.5`}
          >
            <option value="">All kinds</option>
            {RELEASE_KINDS.map((k) => (
              <option key={k} value={kindSlug(k)}>
                {releaseKindLabel[k]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-from`} className="text-fg text-sm font-medium">
            From
          </label>
          <input
            id={`${id}-from`}
            type="date"
            value={query.from ?? ''}
            max={query.to ?? undefined}
            onChange={(e) => set({ from: e.target.value || null })}
            className={`${control} mt-1.5`}
          />
        </div>
        <div>
          <label htmlFor={`${id}-to`} className="text-fg text-sm font-medium">
            To
          </label>
          <input
            id={`${id}-to`}
            type="date"
            value={query.to ?? ''}
            min={query.from ?? undefined}
            onChange={(e) => set({ to: e.target.value || null })}
            className={`${control} mt-1.5`}
          />
        </div>
        <div className="flex items-end">
          <div
            role="group"
            aria-label="View"
            className="border-line bg-card inline-flex rounded-lg border p-1"
          >
            <Link
              href={viewHref('timeline')}
              replace
              scroll={false}
              aria-current={query.view === 'timeline' ? 'true' : undefined}
              className={viewCls(query.view === 'timeline')}
            >
              <Rows3 size={15} aria-hidden /> Timeline
            </Link>
            <Link
              href={viewHref('list')}
              replace
              scroll={false}
              aria-current={query.view === 'list' ? 'true' : undefined}
              className={viewCls(query.view === 'list')}
            >
              <List size={15} aria-hidden /> List
            </Link>
          </div>
        </div>
      </div>
      {hasReleaseFilters(query) && (
        <p className="mt-4">
          <Link
            href={releasesHref({ view: query.view })}
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
