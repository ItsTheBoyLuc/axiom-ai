'use client';

import { useId, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { ModelCard } from '@/components/models/model-card';
import {
  emptyPortfolioFilter,
  filterPortfolio,
  type PortfolioFilter,
} from '@/lib/providers/profile';
import { categoryLabel, type ModelListItem } from '@/types/model';

const control =
  'h-11 w-full rounded-lg border border-line-strong bg-elevated px-3 text-sm text-fg outline-none focus-visible:outline-2 focus-visible:outline-offset-2';

/**
 * The provider's models, filterable by text, category, availability and open weights. Filtering
 * happens in the browser over the models already on the page (a provider has tens, not
 * thousands). Each card keeps its own "Add to comparison" control.
 */
export function Portfolio({ models }: { models: ModelListItem[] }) {
  const id = useId();
  const [f, setF] = useState<PortfolioFilter>(emptyPortfolioFilter);
  const shown = useMemo(() => filterPortfolio(models, f), [models, f]);
  const categories = useMemo(
    () => [...new Set(models.flatMap((m) => m.categories))].sort(),
    [models],
  );
  const availabilities = useMemo(
    () => [...new Set(models.map((m) => m.availability))].sort(),
    [models],
  );
  const active = f.q || f.category || f.availability || f.openWeightsOnly;

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor={`${id}-q`} className="text-fg text-sm font-medium">
            Search this portfolio
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
              value={f.q}
              onChange={(e) => setF({ ...f, q: e.target.value })}
              autoComplete="off"
              placeholder="Name or family"
              className={`${control} pl-9`}
            />
          </div>
        </div>
        <div>
          <label htmlFor={`${id}-c`} className="text-fg text-sm font-medium">
            Category
          </label>
          <select
            id={`${id}-c`}
            value={f.category}
            onChange={(e) => setF({ ...f, category: e.target.value })}
            className={`${control} mt-1.5`}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {categoryLabel[c]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-a`} className="text-fg text-sm font-medium">
            Availability
          </label>
          <select
            id={`${id}-a`}
            value={f.availability}
            onChange={(e) => setF({ ...f, availability: e.target.value })}
            className={`${control} mt-1.5`}
          >
            <option value="">Any</option>
            {availabilities.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <label className="text-fg flex h-11 cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={f.openWeightsOnly}
              onChange={(e) => setF({ ...f, openWeightsOnly: e.target.checked })}
              className="size-4 accent-[var(--accent)]"
            />
            Open weights only
          </label>
        </div>
      </div>

      <p className="text-muted mt-4 text-sm" role="status">
        {shown.length} of {models.length} {models.length === 1 ? 'model' : 'models'}
        {active && (
          <>
            {' '}
            &middot;{' '}
            <button
              type="button"
              className="text-accent underline"
              onClick={() => setF(emptyPortfolioFilter)}
            >
              Clear filters
            </button>
          </>
        )}
      </p>

      {shown.length === 0 ? (
        <p className="border-line-strong text-fg-2 mt-4 rounded-2xl border border-dashed p-8 text-center text-sm">
          No models match these filters.
        </p>
      ) : (
        <ul className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((m) => (
            <li key={m.slug} className="h-full">
              <ModelCard model={m} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
