'use client';

import Link from 'next/link';
import { useId, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Facets } from '@/lib/benchmarks/analysis';
import { explorerHref, hasFilters, type ExplorerQuery } from '@/lib/benchmarks/query';

const control =
  'h-11 w-full rounded-lg border border-line-strong bg-elevated px-3 text-sm text-fg outline-none focus-visible:outline-2 focus-visible:outline-offset-2';

/**
 * Result filters for one benchmark: provider, model family, model version, evaluation type and
 * an evaluation date range. Every change replaces the URL (so views are shareable and the back
 * button works) and the server re-renders. Options come from the benchmark's own results, with
 * counts, so a filter that would match nothing is never offered.
 */
export function ExplorerFilters({ facets, query }: { facets: Facets; query: ExplorerQuery }) {
  const router = useRouter();
  const id = useId();
  const [pending, startTransition] = useTransition();

  const set = (patch: Partial<ExplorerQuery>) =>
    startTransition(() => router.replace(explorerHref({ ...query, ...patch }), { scroll: false }));

  const select = (
    key: 'provider' | 'family' | 'version' | 'type',
    label: string,
    options: { value: string; label: string; count: number }[],
  ) => (
    <div>
      <label htmlFor={`${id}-${key}`} className="text-fg text-sm font-medium">
        {label}
      </label>
      <select
        id={`${id}-${key}`}
        value={query[key] ?? ''}
        onChange={(e) => set({ [key]: e.target.value || null })}
        className={`${control} mt-1.5`}
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label} ({o.count})
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <section
      aria-label="Filter results"
      aria-busy={pending}
      className="border-line bg-card rounded-2xl border p-5"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {select('provider', 'Provider', facets.providers)}
        {select('family', 'Model family', facets.families)}
        {select('version', 'Model version', facets.versions)}
        {select('type', 'Evaluation type', facets.types)}
        <div>
          <label htmlFor={`${id}-from`} className="text-fg text-sm font-medium">
            Evaluated from
          </label>
          <input
            id={`${id}-from`}
            type="date"
            value={query.from ?? ''}
            min={facets.minDate ?? undefined}
            max={query.to ?? facets.maxDate ?? undefined}
            onChange={(e) => set({ from: e.target.value || null })}
            className={`${control} mt-1.5`}
          />
        </div>
        <div>
          <label htmlFor={`${id}-to`} className="text-fg text-sm font-medium">
            Evaluated to
          </label>
          <input
            id={`${id}-to`}
            type="date"
            value={query.to ?? ''}
            min={query.from ?? facets.minDate ?? undefined}
            max={facets.maxDate ?? undefined}
            onChange={(e) => set({ to: e.target.value || null })}
            className={`${control} mt-1.5`}
          />
        </div>
      </div>
      {hasFilters(query) && (
        <p className="mt-4">
          <Link
            href={explorerHref({ category: query.category, benchmark: query.benchmark })}
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
