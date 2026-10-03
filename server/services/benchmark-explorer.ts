import type { ExplorerQuery } from '../../src/lib/benchmarks/query';
import type { BenchmarkResultRow, BenchmarkSummary } from '../../src/types/catalog';
import type { Repositories } from '../repositories';

const PAGE_SIZE = 100;
/** Safety cap: a single benchmark with more results than this is shown truncated, and says so. */
const MAX_PAGES = 5;

export type ExplorerData = {
  summaries: BenchmarkSummary[];
  /** The selected benchmark, or null (none chosen, or the slug does not exist). */
  selected: BenchmarkSummary | null;
  /** True when a benchmark slug was requested but does not exist. */
  notFound: boolean;
  /** Every result of the selected benchmark, newest first (filters are applied by the caller). */
  rows: BenchmarkResultRow[];
  /** True when the cap above cut the list. */
  truncated: boolean;
};

/**
 * Loads what the benchmark explorer needs: the benchmark index (with aggregates) and, when one
 * benchmark is selected, all of its results. Filtering, charts and tables are derived from these
 * in pure functions (src/lib/benchmarks), so the page stays one cheap, cacheable round of reads.
 */
export async function loadExplorer(repos: Repositories, q: ExplorerQuery): Promise<ExplorerData> {
  const summaries = await repos.benchmarks.list();
  const selected = q.benchmark ? (summaries.find((s) => s.slug === q.benchmark) ?? null) : null;
  if (!selected) {
    return { summaries, selected: null, notFound: !!q.benchmark, rows: [], truncated: false };
  }

  const rows: BenchmarkResultRow[] = [];
  let truncated = false;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await repos.benchmarks.results({
      benchmark: selected.slug,
      page,
      pageSize: PAGE_SIZE,
    });
    rows.push(...res.items);
    if (page >= res.pageCount) break;
    if (page === MAX_PAGES) truncated = true;
  }
  return { summaries, selected, notFound: false, rows, truncated };
}
