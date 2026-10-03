import { formatDate } from '@/lib/format';
import type { BenchmarkSummary } from '@/types/catalog';

/**
 * Totals across the catalogue. The independent count is shown even when it is zero: how many
 * results are independently evaluated (versus reported by the provider) is the single most
 * important thing to know about a benchmark number.
 */
export function OverviewStats({ summaries }: { summaries: BenchmarkSummary[] }) {
  const results = summaries.reduce((n, s) => n + s.resultCount, 0);
  const independent = summaries.reduce((n, s) => n + s.byType.INDEPENDENT, 0);
  const providerReported = summaries.reduce((n, s) => n + s.byType.PROVIDER_REPORTED, 0);
  const latest = summaries
    .map((s) => s.latestDate)
    .filter((d): d is string => !!d)
    .sort()
    .pop();

  const tiles: { label: string; value: string }[] = [
    { label: 'Benchmarks', value: String(summaries.length) },
    { label: 'Results', value: String(results) },
    { label: 'Independently evaluated', value: String(independent) },
    { label: 'Provider reported', value: String(providerReported) },
    { label: 'Latest evaluation', value: latest ? formatDate(latest) : 'None yet' },
  ];

  return (
    <section aria-label="Benchmark catalogue totals" className="mb-8">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((t) => (
          <div key={t.label} className="border-line bg-card rounded-xl border px-4 py-3">
            <dt className="text-muted text-xs">{t.label}</dt>
            <dd className="text-fg mt-1 font-mono text-lg">{t.value}</dd>
          </div>
        ))}
      </dl>
      {independent === 0 && results > 0 && (
        <p className="text-fg-2 mt-3 max-w-3xl text-sm">
          None of these results has been independently evaluated yet: every score was published by
          the model&apos;s own provider. Independent results are labelled separately wherever they
          appear.
        </p>
      )}
    </section>
  );
}
