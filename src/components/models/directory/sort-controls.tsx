'use client';

import { useId } from 'react';
import { SORTS, sortLabel, type BenchmarkOption, type Sort } from '@/types/model';
import { useModelsUrl } from './url-state';

const selectCls =
  'h-10 rounded-lg border border-line-strong bg-elevated px-3 text-sm text-fg outline-none focus-visible:outline-2 focus-visible:outline-offset-2';

/**
 * Sort selector. "Benchmark score" sorts by ONE benchmark the user picks: there is no overall
 * ranking or blended score anywhere in the directory.
 */
export function SortControls({ benchmarks }: { benchmarks: BenchmarkOption[] }) {
  const { query, navigate } = useModelsUrl();
  const id = useId();

  const onSort = (sort: Sort) => {
    if (sort === 'benchmark') {
      navigate({ sort, benchmark: query.benchmark ?? benchmarks[0]?.slug ?? null });
    } else {
      navigate({ sort });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Label is associated by id (not wrapped) so the control's name is just "Sort by",
          without the currently selected option text appended. */}
      <div className="flex items-center gap-2 text-sm">
        <label htmlFor={`${id}-sort`} className="text-fg-2">
          Sort by
        </label>
        <select
          id={`${id}-sort`}
          value={query.sort}
          onChange={(e) => onSort(e.target.value as Sort)}
          className={selectCls}
        >
          {SORTS.filter((s) => s !== 'benchmark' || benchmarks.length > 0).map((s) => (
            <option key={s} value={s}>
              {s === 'benchmark' ? 'Benchmark score (pick one)' : sortLabel[s]}
            </option>
          ))}
        </select>
      </div>
      {query.sort === 'benchmark' && (
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor={`${id}-bench`} className="text-fg-2">
            Benchmark
          </label>
          <select
            id={`${id}-bench`}
            value={query.benchmark ?? ''}
            onChange={(e) => navigate({ sort: 'benchmark', benchmark: e.target.value })}
            className={selectCls}
          >
            {benchmarks.map((b) => (
              <option key={b.slug} value={b.slug}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
