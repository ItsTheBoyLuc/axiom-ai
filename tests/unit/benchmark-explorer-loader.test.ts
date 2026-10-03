import { describe, expect, it, vi } from 'vitest';
import { emptyQuery } from '@/lib/benchmarks/query';
import type { BenchmarkResultsQuery } from '@/types/catalog';
import type { Repositories } from '../../server/repositories';
import { loadExplorer } from '../../server/services/benchmark-explorer';
import { row, summary } from './benchmarks-fixtures';

/** A fake benchmarks repository serving `total` rows in pages, so the paging logic is tested alone. */
function fakeRepos(total: number) {
  const results = vi.fn(async (q: BenchmarkResultsQuery) => {
    const start = (q.page - 1) * q.pageSize;
    const items = Array.from({ length: Math.max(0, Math.min(q.pageSize, total - start)) }, (_, i) =>
      row({ score: start + i, model: { slug: `m${start + i}` } }),
    );
    return {
      items,
      total,
      page: q.page,
      pageSize: q.pageSize,
      pageCount: Math.max(1, Math.ceil(total / q.pageSize)),
    };
  });
  const repos = {
    benchmarks: { list: async () => [summary({ slug: 'bench-a' })], results },
  } as unknown as Repositories;
  return { repos, results };
}

describe('loadExplorer', () => {
  it('loads only the index when no benchmark is selected', async () => {
    const { repos, results } = fakeRepos(10);
    const d = await loadExplorer(repos, emptyQuery);
    expect(d).toMatchObject({ selected: null, notFound: false, rows: [], truncated: false });
    expect(d.summaries).toHaveLength(1);
    expect(results).not.toHaveBeenCalled();
  });

  it('reports an unknown slug without loading any results', async () => {
    const { repos, results } = fakeRepos(10);
    const d = await loadExplorer(repos, { ...emptyQuery, benchmark: 'nope' });
    expect(d).toMatchObject({ selected: null, notFound: true, rows: [] });
    expect(results).not.toHaveBeenCalled();
  });

  it('loads all results of the selected benchmark across pages', async () => {
    const { repos, results } = fakeRepos(250);
    const d = await loadExplorer(repos, { ...emptyQuery, benchmark: 'bench-a' });
    expect(d.rows).toHaveLength(250);
    expect(d.truncated).toBe(false);
    expect(results).toHaveBeenCalledTimes(3);
    expect(results.mock.calls[0]![0]).toMatchObject({ benchmark: 'bench-a', pageSize: 100 });
  });

  it('stops at the safety cap and says the list is truncated', async () => {
    const { repos, results } = fakeRepos(900);
    const d = await loadExplorer(repos, { ...emptyQuery, benchmark: 'bench-a' });
    expect(d.rows).toHaveLength(500);
    expect(d.truncated).toBe(true);
    expect(results).toHaveBeenCalledTimes(5);
  });
});
