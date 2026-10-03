import Link from 'next/link';
import { explorerHref } from '@/lib/benchmarks/query';
import {
  BENCHMARK_CATEGORIES,
  benchmarkCategoryLabel,
  type BenchmarkCategoryKey,
  type BenchmarkSummary,
} from '@/types/catalog';

/**
 * Category filter for the benchmark index: "All" plus every category that has benchmarks, each
 * with its benchmark count. These are links (the URL is the state), and the current one is
 * marked with aria-current.
 */
export function CategoryTabs({
  summaries,
  active,
}: {
  summaries: BenchmarkSummary[];
  active: BenchmarkCategoryKey | null;
}) {
  const counts = new Map<string, number>();
  for (const s of summaries) counts.set(s.category, (counts.get(s.category) ?? 0) + 1);
  const known = BENCHMARK_CATEGORIES.filter((c) => counts.has(c));
  const cls = (on: boolean) =>
    `inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm transition-colors ${
      on
        ? 'border-accent bg-accent/10 text-fg'
        : 'border-line text-fg-2 hover:border-line-strong hover:text-fg'
    }`;

  return (
    <nav aria-label="Benchmark categories" className="mb-8">
      <ul className="flex flex-wrap gap-2">
        <li>
          <Link
            href={explorerHref({})}
            aria-current={active === null ? 'true' : undefined}
            className={cls(active === null)}
          >
            All categories
            <span className="text-muted font-mono text-xs">{summaries.length}</span>
          </Link>
        </li>
        {known.map((c) => (
          <li key={c}>
            <Link
              href={explorerHref({ category: c })}
              aria-current={active === c ? 'true' : undefined}
              className={cls(active === c)}
            >
              {benchmarkCategoryLabel[c]}
              <span className="text-muted font-mono text-xs">{counts.get(c)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
