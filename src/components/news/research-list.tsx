import Link from 'next/link';
import { ArrowUpRight, FileText } from 'lucide-react';
import { DemoBadge, VerificationBadge } from '@/components/ui/badges';
import { formatDate } from '@/lib/format';
import type { ResearchItem } from '@/types/catalog';

/** Papers and technical reports, newest first, each linking to the paper itself. */
export function ResearchList({ items }: { items: ResearchItem[] }) {
  return (
    <ul className="space-y-3">
      {items.map((r) => (
        <li key={r.id} className="border-line bg-card rounded-2xl border p-5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <time dateTime={r.publishedAt} className="text-muted font-mono text-sm">
              {formatDate(r.publishedAt)}
            </time>
            <VerificationBadge status={r.verificationStatus} />
            {r.isDemo && <DemoBadge />}
          </div>
          <h3 className="t-h3 mt-3">
            <a
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-start gap-2 hover:underline"
            >
              <FileText size={17} aria-hidden className="text-muted mt-1 shrink-0" />
              <span>{r.title}</span>
              <ArrowUpRight size={14} aria-hidden className="mt-1.5 shrink-0" />
            </a>
          </h3>
          <p className="text-fg-2 mt-2 text-sm">
            <Link href={`/providers/${r.provider.slug}`} className="text-fg hover:underline">
              {r.provider.name}
            </Link>
            {r.venue && <> &middot; {r.venue}</>}
          </p>
        </li>
      ))}
    </ul>
  );
}
