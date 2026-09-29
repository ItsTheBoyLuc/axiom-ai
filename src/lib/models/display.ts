import { NOT_DISCLOSED } from '@/lib/verification';
import { modalityLabel, pricingKindLabel, type ModelListItem } from '@/types/model';

export const money = (n: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(n);

export type PricingSummary = {
  /** Short lines for the card, e.g. "In $1.00", "Out Not publicly disclosed". */
  lines: string[];
  /** Unit or qualifier shown beneath (e.g. "per 1M tokens", "Free tier"). */
  note: string | null;
};

/**
 * Card-level pricing text. Every missing figure renders "Not publicly disclosed"; it is never
 * shown as free or zero. Free/paid/free-tier/custom come from the model's pricing kind.
 */
export function pricingSummary(
  m: Pick<ModelListItem, 'pricingKind' | 'currentPricing'>,
): PricingSummary {
  const p = m.currentPricing;
  if (p) {
    return {
      lines: [
        `In ${p.input === null ? NOT_DISCLOSED : money(p.input, p.currency)}`,
        `Out ${p.output === null ? NOT_DISCLOSED : money(p.output, p.currency)}`,
      ],
      note: m.pricingKind === 'free-tier' ? `${p.unit} · free tier` : p.unit,
    };
  }
  switch (m.pricingKind) {
    case 'free':
      return { lines: ['Free'], note: null };
    case 'custom':
      return { lines: ['Custom pricing'], note: null };
    case 'free-tier':
      return { lines: ['Free tier'], note: 'Paid rates not listed' };
    case 'paid':
      return { lines: ['Paid'], note: 'See profile for units' };
    default:
      return { lines: [NOT_DISCLOSED], note: null };
  }
}

export const pricingKindText = (m: Pick<ModelListItem, 'pricingKind'>) =>
  pricingKindLabel[m.pricingKind];

export const modalitiesText = (m: Pick<ModelListItem, 'modalities'>) =>
  m.modalities.map((x) => modalityLabel[x]);
