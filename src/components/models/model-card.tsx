import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { CompareToggle } from '@/components/comparison/compare-toggle';
import { DemoBadge, Tag, VerificationBadge } from '@/components/ui/badges';
import { Card } from '@/components/ui/card';
import { formatDate, formatTokens } from '@/lib/format';
import { latestBenchmarkResult } from '@/lib/models/benchmarks';
import { modalitiesText, pricingSummary } from '@/lib/models/display';
import { NOT_DISCLOSED } from '@/lib/verification';
import type { ModelListItem } from '@/types/model';

/** Provider monogram tile (used instead of a logo: we never redraw a company's logo). */
export function Monogram({ letter, size = 40 }: { letter: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="border-line-strong bg-elevated text-fg-2 inline-flex shrink-0 items-center justify-center rounded-xl border font-mono font-medium"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {letter}
    </span>
  );
}

const evaluationText = {
  INDEPENDENT: 'independent',
  COMMUNITY: 'community reported',
  PROVIDER_REPORTED: 'provider reported',
} as const;

/**
 * Directory / homepage model card. `sortBenchmark` adds that single benchmark's latest result
 * (with its evaluation type) when the list is sorted by it; benchmarks are never combined.
 */
export function ModelCard({
  model,
  sortBenchmark,
  showActions = true,
}: {
  model: ModelListItem;
  sortBenchmark?: { slug: string; name: string } | null;
  showActions?: boolean;
}) {
  const pricing = pricingSummary(model);
  const bench = sortBenchmark ? latestBenchmarkResult(model.benchmarks, sortBenchmark.slug) : null;

  return (
    <Card as="article" className="flex h-full flex-col p-5">
      <div className="flex items-start gap-3">
        <Monogram letter={model.providerMonogram} />
        <div className="min-w-0 flex-1">
          <h3 className="t-h3 truncate">
            <Link href={`/models/${model.slug}`} className="hover:underline">
              {model.name}
            </Link>
          </h3>
          <p className="text-fg-2 truncate text-sm">
            {model.providerName} &middot; {model.family}
            {model.version ? ` v${model.version}` : ''}
          </p>
        </div>
      </div>

      <p className="text-fg-2 mt-3 line-clamp-2 text-sm">{model.description}</p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {modalitiesText(model).map((m) => (
          <Tag key={m}>{m}</Tag>
        ))}
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <dt className="t-eyebrow">Released</dt>
          <dd className="text-fg mt-0.5 font-mono">{formatDate(model.releaseDate)}</dd>
        </div>
        <div>
          <dt className="t-eyebrow">Context</dt>
          <dd className="text-fg mt-0.5 font-mono">
            {model.contextWindow === null ? (
              <span className="text-fg-2 font-sans">{NOT_DISCLOSED}</span>
            ) : (
              `${formatTokens(model.contextWindow)} tokens`
            )}
          </dd>
        </div>
        {/* Pricing spans the card so "Not publicly disclosed" never wraps into a narrow column. */}
        <div className="col-span-2">
          <dt className="t-eyebrow">Pricing</dt>
          <dd className="text-fg mt-0.5">
            <span className="flex flex-wrap gap-x-4">
              {pricing.lines.map((l) => (
                <span key={l} className="font-mono text-[13px] leading-5">
                  {l}
                </span>
              ))}
            </span>
            {pricing.note && <span className="text-muted block text-xs">{pricing.note}</span>}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="t-eyebrow">Availability</dt>
          <dd className="text-fg mt-0.5">{model.availability}</dd>
        </div>
      </dl>

      {sortBenchmark && (
        <p className="border-line bg-elevated text-fg-2 mt-4 rounded-lg border px-3 py-2 text-xs">
          <span className="text-fg">{sortBenchmark.name}:</span>{' '}
          {bench ? (
            <>
              <span className="text-fg font-mono">
                {bench.score}
                {bench.scoreUnit}
              </span>{' '}
              &middot; {evaluationText[bench.evaluationType]}
            </>
          ) : (
            'No verified data'
          )}
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
        <VerificationBadge status={model.verificationStatus} />
        {model.isDemo && <DemoBadge />}
      </div>

      {showActions && (
        <div className="border-line mt-4 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t pt-4">
          <CompareToggle slug={model.slug} name={model.name} providerName={model.providerName} />
          <Link
            href={`/models/${model.slug}`}
            aria-label={`View ${model.name}`}
            className="group text-accent inline-flex h-9 items-center gap-1 rounded-lg px-1 text-sm font-medium hover:underline"
          >
            View
            <ArrowUpRight
              size={15}
              aria-hidden
              className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            />
          </Link>
        </div>
      )}
    </Card>
  );
}
