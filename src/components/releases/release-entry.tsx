import Link from 'next/link';
import { ArrowUpRight, BookOpen } from 'lucide-react';
import { ConfirmationBadge, DemoBadge } from '@/components/ui/badges';
import { formatDate } from '@/lib/format';
import type { ReleaseItem } from '@/types/catalog';
import { releaseKindLabel } from '@/types/model';

const linkCls = 'text-accent inline-flex items-center gap-1 text-sm font-medium hover:underline';

/** Provider and (when the release is about one model) the model, as profile links. */
export function ReleaseSubject({ item }: { item: ReleaseItem }) {
  return (
    <>
      <Link href={`/providers/${item.provider.slug}`} className="text-fg hover:underline">
        {item.provider.name}
      </Link>
      {item.model && (
        <>
          {' '}
          <span className="text-muted" aria-hidden>
            &middot;
          </span>{' '}
          <Link href={`/models/${item.model.slug}`} className="text-fg-2 hover:underline">
            {item.model.name}
          </Link>
        </>
      )}
    </>
  );
}

/** Announcement and documentation links (external), or an explicit "no link" line. */
export function ReleaseLinks({ item }: { item: ReleaseItem }) {
  if (!item.announcementUrl && !item.docsUrl) {
    return <span className="text-muted text-xs">No announcement link on record.</span>;
  }
  return (
    <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {item.announcementUrl && (
        <a
          href={item.announcementUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={linkCls}
        >
          Announcement <ArrowUpRight size={13} aria-hidden />
        </a>
      )}
      {item.docsUrl && (
        <a href={item.docsUrl} target="_blank" rel="noopener noreferrer" className={linkCls}>
          <BookOpen size={13} aria-hidden /> Documentation
        </a>
      )}
    </span>
  );
}

/**
 * One release in the timeline: date, kind, who shipped what, what changed, links to the source,
 * and whether the release is confirmed by an official or independent source.
 */
export function ReleaseEntry({ item }: { item: ReleaseItem }) {
  return (
    <article className="border-line bg-card rounded-2xl border p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <time dateTime={item.date} className="text-muted font-mono text-sm">
          {formatDate(item.date)}
        </time>
        <span className="border-line-strong text-fg-2 rounded-full border px-2.5 py-0.5 text-xs">
          {releaseKindLabel[item.kind]}
        </span>
        <ConfirmationBadge confirmed={item.confirmed} status={item.verificationStatus} />
        {item.isDemo && <DemoBadge />}
      </div>
      <h3 className="t-h3 mt-3">{item.title}</h3>
      <p className="text-fg-2 mt-1 text-sm">
        <ReleaseSubject item={item} />
      </p>
      <p className="text-fg-2 mt-3 max-w-2xl text-sm">{item.description}</p>
      <p className="mt-4">
        <ReleaseLinks item={item} />
      </p>
    </article>
  );
}
