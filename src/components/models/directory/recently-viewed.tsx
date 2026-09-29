'use client';

import Link from 'next/link';
import { History } from 'lucide-react';
import { useRecentlyViewed } from '@/components/comparison/comparison-store';

/** Shows models the visitor opened recently (stored locally; anonymous browsing works). */
export function RecentlyViewed() {
  const { list } = useRecentlyViewed();
  if (list.length === 0) return null;
  return (
    <section aria-label="Recently viewed models" className="mb-6 flex flex-wrap items-center gap-2">
      <span className="text-muted flex items-center gap-1.5 text-sm">
        <History size={15} aria-hidden /> Recently viewed
      </span>
      {list.slice(0, 5).map((m) => (
        <Link
          key={m.slug}
          href={`/models/${m.slug}`}
          className="border-line text-fg-2 hover:border-line-strong hover:text-fg rounded-full border px-3 py-1 text-sm"
        >
          {m.name}
        </Link>
      ))}
    </section>
  );
}
