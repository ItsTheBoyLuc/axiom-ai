import { formatDate } from '@/lib/format';
import { RevealGroup, RevealItem } from '@/components/ui/reveal';
import type { ModelDetail, ReleaseKind } from '@/types/model';
import { ProfileSection } from './profile-section';

const kindLabel: Record<ReleaseKind, string> = {
  INITIAL: 'Initial release',
  VERSION: 'New version',
  CAPABILITY: 'Capability change',
  DEPRECATION: 'Deprecation',
  PRICING: 'Pricing change',
  DOCS: 'Documentation update',
};

/** Vertical timeline of release events, newest first. */
export function ReleaseHistory({ model }: { model: ModelDetail }) {
  return (
    <ProfileSection id="history" title="Release history" demo={model.isDemo}>
      {model.releaseHistory.length === 0 ? (
        <p className="text-fg-2 text-sm">No release history published.</p>
      ) : (
        <RevealGroup as="ol" className="border-line-strong relative ml-2 space-y-7 border-l pl-8">
          {model.releaseHistory.map((e, i) => (
            <RevealItem as="li" key={`${e.date}-${e.kind}-${i}`} className="relative">
              <span
                aria-hidden
                className="border-accent bg-bg absolute top-2 -left-[37px] size-2.5 rounded-full border-2"
              />
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <time dateTime={e.date} className="text-muted font-mono text-sm">
                  {formatDate(e.date)}
                </time>
                <span className="border-line-strong text-fg-2 rounded-full border px-2.5 py-0.5 text-xs">
                  {kindLabel[e.kind]}
                </span>
              </div>
              <h3 className="t-h3 mt-1.5">{e.title}</h3>
              <p className="text-fg-2 mt-1 max-w-2xl text-sm">{e.description}</p>
              <p className="text-muted mt-1.5 text-xs">
                {e.sourceUrl ? (
                  <a
                    href={e.sourceUrl}
                    rel="noopener noreferrer"
                    target="_blank"
                    className="text-accent hover:underline"
                  >
                    Source
                  </a>
                ) : (
                  'No source (demo)'
                )}
              </p>
            </RevealItem>
          ))}
        </RevealGroup>
      )}
    </ProfileSection>
  );
}
