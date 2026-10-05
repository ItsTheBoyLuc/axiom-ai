import Link from 'next/link';
import { ArrowUpRight, FileText } from 'lucide-react';
import { Monogram } from '@/components/models/model-card';
import { ProfileSection } from '@/components/models/profile/profile-section';
import { NewsCard } from '@/components/news/news-card';
import { ReleaseEntry } from '@/components/releases/release-entry';
import { DemoBadge, VerificationBadge } from '@/components/ui/badges';
import { formatDate } from '@/lib/format';
import { availabilityGroups, modalitySummary } from '@/lib/providers/profile';
import { orgTypeText } from '@/lib/providers/query';
import type { NewsItem, ProviderDetail, ReleaseItem } from '@/types/catalog';
import { Portfolio } from './portfolio';
import { ReleaseTimelineChart } from './release-timeline-chart';

export const PROVIDER_SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'models', label: 'Models' },
  { id: 'releases', label: 'Release timeline' },
  { id: 'access', label: 'APIs and modalities' },
  { id: 'research', label: 'Research' },
  { id: 'announcements', label: 'Announcements' },
] as const;

/** Identity, type, website and verification of the provider. */
export function ProviderHeader({ p }: { p: ProviderDetail }) {
  return (
    <header className="pb-8" data-cine-head>
      <div className="flex flex-wrap items-start gap-5">
        <Monogram letter={p.monogram} size={64} />
        <div className="min-w-0 flex-1">
          <p className="text-fg-2 text-sm">
            {orgTypeText(p.orgType)}
            {p.headquarters && <> &middot; {p.headquarters}</>}
          </p>
          <h1 data-cine-title className="t-h2 mt-1">
            {p.name}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <VerificationBadge status={p.verificationStatus} />
            {p.isDemo && <DemoBadge />}
          </div>
        </div>
      </div>
      <p className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        {p.officialWebsite && (
          <a
            href={p.officialWebsite}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent inline-flex items-center gap-1 hover:underline"
          >
            Official website <ArrowUpRight size={13} aria-hidden />
          </a>
        )}
        {p.sourceUrl && (
          <a
            href={p.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent inline-flex items-center gap-1 hover:underline"
          >
            Source <ArrowUpRight size={13} aria-hidden />
          </a>
        )}
        {p.verifiedAt && (
          <span className="text-muted font-mono text-xs">Verified {formatDate(p.verifiedAt)}</span>
        )}
      </p>
      {p.isDemo && (
        <p className="text-fg-2 border-warn/40 bg-warn/5 mt-6 rounded-xl border px-4 py-3 text-sm">
          <strong className="text-fg">Demo data.</strong> This provider is a placeholder record used
          to build and test the page. Nothing here describes a real organisation.
        </p>
      )}
    </header>
  );
}

const fact = (label: string, value: React.ReactNode) => (
  <div>
    <dt className="t-eyebrow">{label}</dt>
    <dd className="text-fg mt-1 text-sm">{value}</dd>
  </div>
);

export function OverviewSection({ p, releases }: { p: ProviderDetail; releases: ReleaseItem[] }) {
  const newest = releases[0];
  const oldest = releases[releases.length - 1];
  return (
    <ProfileSection id="overview" title="Overview" demo={p.isDemo}>
      <p className="text-fg-2 max-w-3xl">{p.description}</p>
      <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
        {fact('Models', <span className="font-mono">{p.models.length}</span>)}
        {fact('Releases on record', <span className="font-mono">{releases.length}</span>)}
        {fact('First release', oldest ? formatDate(oldest.date) : 'None on record')}
        {fact('Latest release', newest ? formatDate(newest.date) : 'None on record')}
      </dl>
    </ProfileSection>
  );
}

export function ModelsSection({ p }: { p: ProviderDetail }) {
  return (
    <ProfileSection
      id="models"
      title="Model portfolio"
      demo={p.isDemo}
      lead="Every model this provider publishes in the catalogue, newest first."
    >
      {p.models.length === 0 ? (
        <p className="text-fg-2 text-sm">No models on record yet.</p>
      ) : (
        <Portfolio models={p.models} />
      )}
    </ProfileSection>
  );
}

export function ReleasesSection({ p, releases }: { p: ProviderDetail; releases: ReleaseItem[] }) {
  return (
    <ProfileSection
      id="releases"
      title="Release timeline"
      demo={p.isDemo}
      lead="Releases, updates and changes from this provider, each linked to its announcement."
    >
      {releases.length === 0 ? (
        <p className="text-fg-2 text-sm">No releases on record yet.</p>
      ) : (
        <div className="space-y-6">
          <ReleaseTimelineChart releases={releases} />
          <ol className="space-y-4">
            {releases.map((r) => (
              <li key={r.id} id={`release-${r.id}`} className="scroll-mt-36">
                <ReleaseEntry item={r} />
              </li>
            ))}
          </ol>
          <p className="text-sm">
            <Link
              href={`/releases?provider=${p.slug}`}
              className="text-accent underline underline-offset-2"
            >
              Open these in the full releases view
            </Link>
          </p>
        </div>
      )}
    </ProfileSection>
  );
}

export function AccessSection({ p }: { p: ProviderDetail }) {
  const modalities = modalitySummary(p.models);
  const groups = availabilityGroups(p.models);
  return (
    <ProfileSection
      id="access"
      title="APIs and modalities"
      demo={p.isDemo}
      lead="How the models are accessed and which kinds of input and output they handle."
    >
      {p.models.length === 0 ? (
        <p className="text-fg-2 text-sm">No models on record yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div>
            <h3 className="t-h3 mb-3">Access</h3>
            <ul className="space-y-3">
              {groups.map((g) => (
                <li key={g.availability} className="border-line bg-card rounded-xl border p-4">
                  <p className="text-fg text-sm font-medium">
                    {g.availability}{' '}
                    <span className="text-muted font-mono text-xs">&times;{g.models.length}</span>
                  </p>
                  <p className="text-fg-2 mt-1 text-sm">
                    {g.models.map((m, i) => (
                      <span key={m.slug}>
                        {i > 0 && ', '}
                        <Link href={`/models/${m.slug}`} className="hover:underline">
                          {m.name}
                        </Link>
                      </span>
                    ))}
                  </p>
                </li>
              ))}
            </ul>
            <p className="text-muted mt-3 text-xs">
              Per-model API details (endpoints, regions, platforms) are on each model&apos;s profile
              under Specifications.
            </p>
          </div>
          <div>
            <h3 className="t-h3 mb-3">Supported modalities</h3>
            <ul className="flex flex-wrap gap-2">
              {modalities.map((m) => (
                <li
                  key={m.modality}
                  className="border-line bg-card text-fg inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm"
                >
                  {m.label}
                  <span className="text-muted font-mono text-xs">
                    {m.models} {m.models === 1 ? 'model' : 'models'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </ProfileSection>
  );
}

export function ResearchSection({ p }: { p: ProviderDetail }) {
  return (
    <ProfileSection
      id="research"
      title="Research publications"
      demo={p.isDemo}
      lead="Papers and technical reports on record for this provider."
    >
      {p.publications.length === 0 ? (
        <p className="text-fg-2 text-sm">No publications on record yet.</p>
      ) : (
        <ul className="space-y-3">
          {p.publications.map((pub) => (
            <li key={pub.url} className="border-line bg-card rounded-xl border p-4">
              <a
                href={pub.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-fg inline-flex items-start gap-2 text-sm font-medium hover:underline"
              >
                <FileText size={15} aria-hidden className="text-muted mt-0.5 shrink-0" />
                {pub.title}
                <ArrowUpRight size={13} aria-hidden className="mt-1 shrink-0" />
              </a>
              <p className="text-muted mt-1 ml-[23px] text-xs">
                {pub.venue ? `${pub.venue} · ` : ''}
                <time dateTime={pub.publishedAt}>{formatDate(pub.publishedAt)}</time>
              </p>
            </li>
          ))}
        </ul>
      )}
    </ProfileSection>
  );
}

export function AnnouncementsSection({ p, news }: { p: ProviderDetail; news: NewsItem[] }) {
  return (
    <ProfileSection
      id="announcements"
      title="Latest announcements"
      demo={p.isDemo}
      lead="Stories about this provider, labelled official or independent."
    >
      {news.length === 0 ? (
        <p className="text-fg-2 text-sm">No news on record for this provider yet.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {news.map((n) => (
            <li key={n.id} className="h-full">
              <NewsCard item={n} showProvider={false} />
            </li>
          ))}
        </ul>
      )}
    </ProfileSection>
  );
}
