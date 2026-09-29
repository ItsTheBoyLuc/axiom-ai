'use client';

import { SearchX } from 'lucide-react';
import { useModelsUrl } from './url-state';

/** Dims the (server-rendered) results while a new URL is loading and marks them busy. */
export function ResultsShell({ children }: { children: React.ReactNode }) {
  const { isPending } = useModelsUrl();
  return (
    <div
      id="results"
      aria-busy={isPending}
      className={`transition-opacity duration-200 ${isPending ? 'opacity-50' : 'opacity-100'}`}
    >
      {children}
    </div>
  );
}

/** Empty state with a way out: clears search and every filter. */
export function EmptyState() {
  const { clearAll } = useModelsUrl();
  return (
    <div className="border-line-strong flex flex-col items-center rounded-2xl border border-dashed px-6 py-16 text-center">
      <SearchX aria-hidden className="text-muted" size={28} />
      <h2 className="t-h3 mt-4">No models match</h2>
      <p className="text-fg-2 mt-2 max-w-sm text-sm">
        Try a different search or remove some filters to see more models.
      </p>
      <button
        type="button"
        onClick={clearAll}
        className="bg-accent text-accent-fg mt-6 h-10 rounded-lg px-4 text-sm font-medium hover:brightness-110"
      >
        Clear search and filters
      </button>
    </div>
  );
}
