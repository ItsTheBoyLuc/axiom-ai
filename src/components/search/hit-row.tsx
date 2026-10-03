import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { DemoBadge } from '@/components/ui/badges';
import { isExternalHref } from '@/lib/search/model';
import type { SearchHit } from '@/types/catalog';
import { Highlight } from './highlight';

/**
 * One search result on the full results page: the title with the matching words highlighted, a
 * line of context, and a real link (external results open in a new tab and say so).
 */
export function HitRow({ hit, query }: { hit: SearchHit; query: string }) {
  const external = isExternalHref(hit.href);
  const body = (
    <>
      <span className="text-fg block text-base font-medium">
        <Highlight text={hit.title} query={query} />
      </span>
      {hit.subtitle && <span className="text-muted mt-0.5 block text-sm">{hit.subtitle}</span>}
    </>
  );
  const cls =
    'border-line bg-card hover:border-line-strong flex items-start justify-between gap-4 rounded-xl border px-4 py-3 transition-colors';
  return (
    <li>
      {external ? (
        <a href={hit.href} target="_blank" rel="noopener noreferrer" className={cls}>
          <span className="min-w-0">{body}</span>
          <span className="flex shrink-0 items-center gap-2">
            {hit.isDemo && <DemoBadge />}
            <ArrowUpRight size={15} aria-hidden className="text-muted mt-1" />
            <span className="sr-only">opens in a new tab</span>
          </span>
        </a>
      ) : (
        <Link href={hit.href} className={cls}>
          <span className="min-w-0">{body}</span>
          {hit.isDemo && <DemoBadge />}
        </Link>
      )}
    </li>
  );
}
