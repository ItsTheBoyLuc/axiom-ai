import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { pageWindow } from '@/lib/pagination';

/**
 * Server-rendered pagination using real links (crawlable, keyboard friendly, back-button safe).
 * `hrefFor` builds each page's URL so the caller's filters and sort survive page changes.
 */
export function Pager({
  page,
  pageCount,
  hrefFor,
}: {
  page: number;
  pageCount: number;
  hrefFor: (page: number) => string;
}) {
  if (pageCount <= 1) return null;
  const base =
    'inline-flex h-10 min-w-10 items-center justify-center rounded-lg border px-3 text-sm transition-colors';
  const idle = 'border-line text-fg-2 hover:border-line-strong hover:text-fg';

  return (
    <nav aria-label="Pagination" className="mt-10 flex flex-wrap items-center justify-center gap-2">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} rel="prev" className={`${base} ${idle} gap-1`}>
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
            href={hrefFor(p)}
            aria-label={`Page ${p}`}
            aria-current={p === page ? 'page' : undefined}
            className={`${base} font-mono ${p === page ? 'border-accent bg-accent/10 text-fg' : idle}`}
          >
            {p}
          </Link>
        ),
      )}
      {page < pageCount ? (
        <Link href={hrefFor(page + 1)} rel="next" className={`${base} ${idle} gap-1`}>
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
