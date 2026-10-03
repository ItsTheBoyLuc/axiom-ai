import { CheckCircle2, History } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { money } from '@/lib/models/display';
import { TOKEN_UNIT, estimatorUnit } from '@/lib/pricing';
import { NOT_DISCLOSED } from '@/lib/verification';
import {
  pricingKindLabel,
  type ModelDetail,
  type PricingEntry,
  type PricingType,
} from '@/types/model';
import { CostEstimator } from './cost-estimator';
import { ProfileSection } from './profile-section';

const typeLabel: Record<PricingType, string> = {
  INPUT: 'Input',
  OUTPUT: 'Output',
  CACHED_INPUT: 'Cached input',
  BATCH_INPUT: 'Batch input',
  BATCH_OUTPUT: 'Batch output',
  IMAGE: 'Image',
  AUDIO: 'Audio',
  OTHER: 'Other',
};

function PriceRow({ p }: { p: PricingEntry }) {
  return (
    <tr className="border-line/60 border-b align-top">
      <th scope="row" className="text-fg px-4 py-3 text-left font-normal">
        {typeLabel[p.type]}
      </th>
      <td className="px-4 py-3 font-mono">
        {p.price === null ? (
          <span className="text-fg-2 font-sans">{NOT_DISCLOSED}</span>
        ) : (
          <>
            <span className="text-fg">{money(p.price, p.currency)}</span>
            <span className="text-muted block font-sans text-xs">
              {p.currency} {p.unit}
            </span>
          </>
        )}
      </td>
      <td className="text-fg-2 px-4 py-3 font-mono text-xs whitespace-nowrap">
        {formatDate(p.effectiveFrom)}
        <span className="text-muted"> to </span>
        {p.effectiveTo ? formatDate(p.effectiveTo) : 'present'}
      </td>
      <td className="px-4 py-3">
        {p.isCurrent ? (
          <span className="text-ok inline-flex items-center gap-1 text-xs font-medium">
            <CheckCircle2 size={13} aria-hidden /> Current
          </span>
        ) : (
          <span className="text-fg-2 inline-flex items-center gap-1 text-xs font-medium">
            <History size={13} aria-hidden /> Historical
          </span>
        )}
      </td>
      <td className="text-fg-2 px-4 py-3 text-xs">
        {p.sourceUrl ? (
          <a
            href={p.sourceUrl}
            rel="noopener noreferrer"
            target="_blank"
            className="text-accent hover:underline"
          >
            Source
          </a>
        ) : (
          'No source (demo)'
        )}
        <span className="text-muted block">
          {p.verifiedAt ? `Verified ${formatDate(p.verifiedAt.slice(0, 10))}` : 'Not verified'}
        </span>
      </td>
    </tr>
  );
}

/** Pricing table (current first, historical labelled) plus the token cost estimator. */
export function PricingSection({ model }: { model: ModelDetail }) {
  const current = model.pricing.filter((p) => p.isCurrent);
  const historical = model.pricing
    .filter((p) => !p.isCurrent)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  const rows = [...current, ...historical];
  const unit = estimatorUnit(current);
  const hasTokenPricing = current.some((p) => p.unit === unit && p.price !== null);
  // Token prices exist, but several variants (tiers) mean no single flat price applies.
  const hasTokenVariants = !hasTokenPricing && current.some((p) => p.unit.startsWith(TOKEN_UNIT));
  const th = 'px-4 py-3 text-left text-xs font-medium tracking-wide text-muted uppercase';

  return (
    <ProfileSection
      id="pricing"
      title="Pricing"
      demo={model.isDemo}
      lead="Prices are listed as published, with currency, unit and effective dates. Historical prices stay visible and are labelled."
    >
      <p className="text-fg-2 mb-5 text-sm">
        Pricing model: <span className="text-fg">{pricingKindLabel[model.pricingKind]}</span>
      </p>

      {rows.length > 0 ? (
        <div
          tabIndex={0}
          role="region"
          aria-label="Pricing table"
          className="border-line bg-card overflow-x-auto rounded-2xl border"
        >
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <caption className="sr-only">Prices for {model.name}</caption>
            <thead>
              <tr className="border-line border-b">
                <th scope="col" className={th}>
                  Type
                </th>
                <th scope="col" className={th}>
                  Price
                </th>
                <th scope="col" className={th}>
                  Effective
                </th>
                <th scope="col" className={th}>
                  Status
                </th>
                <th scope="col" className={th}>
                  Source
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p, i) => (
                <PriceRow key={`${p.type}-${p.effectiveFrom}-${i}`} p={p} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="border-line-strong text-fg-2 rounded-2xl border border-dashed p-6 text-sm">
          Prices: {NOT_DISCLOSED.toLowerCase()}.
        </p>
      )}

      <div className="mt-8">
        {hasTokenPricing ? (
          <CostEstimator entries={model.pricing} modelName={model.name} />
        ) : (
          <p className="text-muted text-sm">
            {hasTokenVariants
              ? 'The cost estimator is unavailable: this model lists several price variants (for example tiers), so no single flat price applies. See the table above.'
              : 'The cost estimator is unavailable: no per-token prices are published for this model.'}
          </p>
        )}
      </div>
    </ProfileSection>
  );
}
