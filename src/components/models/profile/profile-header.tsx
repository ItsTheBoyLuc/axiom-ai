import { BookOpen } from 'lucide-react';
import { CompareToggle } from '@/components/comparison/compare-toggle';
import { DemoBadge, VerificationBadge } from '@/components/ui/badges';
import { formatDate } from '@/lib/format';
import { Monogram } from '@/components/models/model-card';
import type { ModelDetail } from '@/types/model';
import { ShareButton } from './share-button';

/**
 * Profile header: identity, key dates, verification/demo flags and actions.
 * "Save" requires an account and arrives in Phase 9; it is intentionally not rendered yet.
 * "Documentation" only renders when a documentation URL is on record.
 */
export function ProfileHeader({ model }: { model: ModelDetail }) {
  return (
    <header className="pb-8">
      <div className="flex flex-wrap items-start gap-5">
        <Monogram letter={model.providerMonogram} size={64} />
        <div className="min-w-0 flex-1">
          <p className="text-fg-2 text-sm">{model.providerName}</p>
          <h1 className="t-h2 mt-1">{model.name}</h1>
          <p className="text-fg-2 mt-2 text-sm">
            {model.family}
            {model.version && (
              <>
                {' '}
                &middot; version <span className="text-fg font-mono">{model.version}</span>
              </>
            )}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <VerificationBadge status={model.verificationStatus} />
            {model.isDemo && <DemoBadge />}
          </div>
        </div>
      </div>

      <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
        <div>
          <dt className="t-eyebrow">Released</dt>
          <dd className="text-fg mt-1 font-mono text-sm">{formatDate(model.releaseDate)}</dd>
        </div>
        <div>
          <dt className="t-eyebrow">Last updated</dt>
          <dd className="text-fg mt-1 font-mono text-sm">{formatDate(model.updatedAt)}</dd>
        </div>
        <div>
          <dt className="t-eyebrow">Availability</dt>
          <dd className="text-fg mt-1 text-sm">{model.availability}</dd>
        </div>
        <div>
          <dt className="t-eyebrow">Open weights</dt>
          <dd className="text-fg mt-1 text-sm">{model.openWeights ? 'Yes' : 'No'}</dd>
        </div>
      </dl>

      {model.isDemo && (
        <p className="text-fg-2 border-warn/40 bg-warn/5 mt-6 rounded-xl border px-4 py-3 text-sm">
          <strong className="text-fg">Demo data.</strong> This profile is a placeholder record used
          to build and test the page. Nothing here describes a real model.
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <CompareToggle
          slug={model.slug}
          name={model.name}
          providerName={model.providerName}
          variant="header"
        />
        {model.documentationUrl && (
          <a
            href={model.documentationUrl}
            rel="noopener noreferrer"
            target="_blank"
            className="border-line-strong bg-elevated text-fg hover:border-fg-2/50 inline-flex h-10 items-center gap-1.5 rounded-lg border px-4 text-sm font-medium"
          >
            <BookOpen size={15} aria-hidden /> Documentation
          </a>
        )}
        <ShareButton title={`${model.name} - AXIOM AI`} />
      </div>
    </header>
  );
}
