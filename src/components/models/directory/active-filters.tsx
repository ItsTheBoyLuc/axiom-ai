'use client';

import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { spring } from '@/lib/motion';
import type { ModelFacets } from '@/types/model';
import { useModelsUrl } from './url-state';

const DIMS = ['provider', 'category', 'capability', 'deployment', 'pricing'] as const;
const DIM_LABEL = {
  provider: 'Provider',
  category: 'Category',
  capability: 'Capability',
  deployment: 'Deployment',
  pricing: 'Pricing',
} as const;

/** Removable chips for every active filter and the search term, plus "Clear all". */
export function ActiveFilters({ facets }: { facets: ModelFacets }) {
  const { query, toggle, navigate, clearAll } = useModelsUrl();

  const chips: { key: string; label: string; remove: () => void }[] = [];
  if (query.q) {
    chips.push({ key: 'q', label: `Search: “${query.q}”`, remove: () => navigate({ q: '' }) });
  }
  for (const dim of DIMS) {
    for (const value of query[dim] as string[]) {
      const label = facets[dim].find((o) => o.value === value)?.label ?? value;
      chips.push({
        key: `${dim}:${value}`,
        label: `${DIM_LABEL[dim]}: ${label}`,
        remove: () => toggle(dim, value),
      });
    }
  }
  if (chips.length === 0) return null;

  return (
    <div
      className="mb-5 flex flex-wrap items-center gap-2"
      aria-label="Active filters"
      role="group"
    >
      <AnimatePresence initial={false}>
        {chips.map((c) => (
          <motion.span
            key={c.key}
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={spring.snappy}
            className="border-line-strong bg-elevated text-fg inline-flex items-center gap-1 rounded-full border py-1 pr-1 pl-3 text-sm"
          >
            {c.label}
            <button
              type="button"
              onClick={c.remove}
              aria-label={`Remove filter ${c.label}`}
              className="text-fg-2 hover:bg-card hover:text-fg inline-flex size-6 items-center justify-center rounded-full"
            >
              <X size={13} aria-hidden />
            </button>
          </motion.span>
        ))}
      </AnimatePresence>
      <button
        type="button"
        onClick={clearAll}
        className="text-accent rounded-md px-2 text-sm hover:underline"
      >
        Clear all
      </button>
    </div>
  );
}
