import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { toSearchParams } from '@/lib/models/query';
import type { ModelQuery } from '@/types/model';

/** Compact page list: 1 … 4 5 6 … 12 */
export function pageWindow(page: number, count: number): (number | 'gap')[] {
  const keep = new Set([1, count, page - 1, page, page + 1]);
  const nums = [...keep].filter((n) => n >= 1 && n <= count).sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  nums.forEach((n, i) => {
    if (i > 0 && n - nums[i - 1]! > 1) out.push('gap');
    out.push(n);
  });
  return out;
}

/**
 * Server-rendered pagination using real links (crawlable, keyboard friendly, back-button
 * safe). Each link carries the full current query, so filters and sort survive page changes.
 */
export function Pagination({
  query,
  page,
  pageCount,
}: {
  query: ModelQuery;
  page: number;
  pageCount: number;
}) {
  if (pageCount <= 1) return null;
  const href = (p: number) => {
    const qs = toSearchParams({ ...query, page: p }).toString();
    return qs ? `/models?${qs}` : '/models';
  };
  const base =
    'inline-flex h-10 min-w-10 items-center justify-center rounded-lg border px-3 text-sm transition-colors';
  const idle = 'border-line text-fg-2 hover:border-line-strong hover:text-fg';

  return (
    <nav aria-label="Pagination" className="mt-10 flex flex-wrap items-center justify-center gap-2">
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" className={`${base} ${idle} gap-1`}>
          <ChevronLeft size={16} aria-hidden /> Previous
        </Link>
      ) : (
        <span aria-disabled className={`${base} border-line text-muted gap-1 opacity-50`}>
          <ChevronLeft size={16} aria-hidden /> Previous
        </span>
      )}
      {pageWindow(page, pageCount).map((p, i) =>
        p === 'gap' ? (
          <span key={`gap-${i}`} aria-hidden className="text-muted px-1">
            &hellip;
          </span>
        ) : (
          <Link
            key={p}
            href={href(p)}

            aria-label={`Page ${p}`}
            aria-current={p === page ? 'page' : undefined}
            className={`${base} font-mono ${p === page ? 'border-accent bg-accent/10 text-fg' : idle}`}
          >
            {p}
          </Link>
        ),
      )}
      {page < pageCount ? (
        <Link href={href(page + 1)} rel="next" className={`${base} ${idle} gap-1`}>
          Next <ChevronRight size={16} aria-hidden />
        </Link>
      ) : (
        <span aria-disabled className={`${base} border-line text-muted gap-1 opacity-50`}>
          Next <ChevronRight size={16} aria-hidden />
        </span>
      )}
    </nav>
  );
}
