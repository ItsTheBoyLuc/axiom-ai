import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Monogram } from '@/components/models/model-card';
import { DemoBadge, VerificationBadge } from '@/components/ui/badges';
import { formatDate } from '@/lib/format';
import { orgTypeText } from '@/lib/providers/query';
import type { ProviderSummary } from '@/types/catalog';

const ext = 'text-accent relative z-10 inline-flex items-center gap-1 text-sm hover:underline';

/**
 * Directory card. The whole card is one link to the profile (a stretched pseudo-element on the
 * name), while the website and announcement links stay separate, real links above it, so there
 * are no nested anchors. Headquarters is shown only when it is on record (verified).
 */
export function ProviderCard({ p }: { p: ProviderSummary }) {
  return (
    <li className="h-full">
      <article className="border-line bg-card hover:border-line-strong relative flex h-full flex-col rounded-2xl border p-5 transition-colors">
        <div className="flex items-start gap-4">
          <Monogram letter={p.monogram} size={48} />
          <div className="min-w-0 flex-1">
            <h2 className="t-h3 [overflow-wrap:anywhere]">
              <Link
                href={`/providers/${p.slug}`}
                className="after:absolute after:inset-0 after:content-[''] hover:underline"
              >
                {p.name}
              </Link>
            </h2>
            <p className="text-muted mt-0.5 text-xs">
              {orgTypeText(p.orgType)}
              {p.headquarters && <> &middot; {p.headquarters}</>}
            </p>
          </div>
        </div>
        <p className="text-fg-2 mt-4 line-clamp-3 flex-1 text-sm">{p.description}</p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <VerificationBadge status={p.verificationStatus} />
          {p.isDemo && <DemoBadge />}
        </div>

        <dl className="border-line mt-4 space-y-2 border-t pt-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Models</dt>
            <dd className="text-fg font-mono">{p.modelCount}</dd>
          </div>
          <div>
            <dt className="text-muted">Latest announcement</dt>
            <dd className="mt-0.5">
              {p.latestRelease ? (
                p.latestRelease.announcementUrl ? (
                  <a
                    href={p.latestRelease.announcementUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={ext}
                  >
                    {p.latestRelease.title} <ArrowUpRight size={13} aria-hidden />
                  </a>
                ) : (
                  <span className="text-fg">{p.latestRelease.title}</span>
                )
              ) : (
                <span className="text-fg-2">None on record</span>
              )}
              {p.latestRelease && (
                <span className="text-muted block font-mono text-xs">
                  {formatDate(p.latestRelease.date)}
                </span>
              )}
            </dd>
          </div>
        </dl>
        {p.officialWebsite && (
          <p className="mt-3">
            <a href={p.officialWebsite} target="_blank" rel="noopener noreferrer" className={ext}>
              Official website <ArrowUpRight size={13} aria-hidden />
            </a>
          </p>
        )}
      </article>
    </li>
  );
}
