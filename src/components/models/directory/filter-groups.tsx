'use client';

import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion } from 'motion/react';
import { duration, ease } from '@/lib/motion';
import type { FacetOption, ModelFacets, ModelQuery } from '@/types/model';

type Dim = 'provider' | 'category' | 'capability' | 'deployment' | 'pricing';

const GROUPS: { key: Dim; title: string }[] = [
  { key: 'provider', title: 'Provider' },
  { key: 'category', title: 'Category' },
  { key: 'capability', title: 'Capabilities' },
  { key: 'deployment', title: 'Deployment' },
  { key: 'pricing', title: 'Pricing' },
];

function Group({
  title,
  options,
  selected,
  defaultOpen,
  onToggle,
}: {
  title: string;
  options: FacetOption[];
  selected: string[];
  defaultOpen: boolean;
  onToggle: (value: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className="border-line border-b py-4 first:pt-0 last:border-b-0">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          onClick={() => setOpen((o) => !o)}
          className="text-fg flex w-full items-center justify-between rounded-md text-left text-sm font-medium"
        >
          <span>
            {title}
            {selected.length > 0 && (
              <span className="bg-accent/15 text-accent ml-2 rounded-full px-2 py-0.5 font-mono text-xs">
                {selected.length}
              </span>
            )}
          </span>
          <ChevronDown
            size={16}
            aria-hidden
            className={`text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </h3>
      {open && (
        <motion.fieldset
          id={`${id}-panel`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: duration.fast, ease: ease.out }}
          className="mt-3 min-w-0 space-y-1"
        >
          <legend className="sr-only">{title}</legend>
          {options.map((o) => {
            const checked = selected.includes(o.value);
            return (
              <label
                key={o.value}
                className={`hover:bg-elevated flex cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1.5 text-sm ${
                  o.count === 0 && !checked ? 'text-muted' : 'text-fg-2'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(o.value)}
                  className="accent-accent size-4 shrink-0 cursor-pointer"
                />
                <span className="min-w-0 flex-1 truncate">{o.label}</span>
                <span
                  className="text-muted font-mono text-xs tabular-nums"
                  aria-label={`${o.count} models`}
                >
                  {o.count}
                </span>
              </label>
            );
          })}
        </motion.fieldset>
      )}
    </div>
  );
}

/**
 * Multi-select filter groups (docs/PROMPT.md 7.2). Presentational: the parent supplies
 * facet counts, the current selection and callbacks. Groups collapse; a group with an active
 * selection starts open. Counts reflect the other active filters.
 */
export function FilterGroups({
  facets,
  query,
  onToggle,
  onClear,
  activeCount,
  showTitle = true,
}: {
  facets: ModelFacets;
  query: Pick<ModelQuery, Dim>;
  onToggle: (dim: Dim, value: string) => void;
  onClear: () => void;
  activeCount: number;
  /** The mobile sheet already has its own title, so it hides this heading visually. */
  showTitle?: boolean;
}) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className={showTitle ? 'text-fg text-sm font-medium' : 'sr-only'}>Filters</h2>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-accent rounded-md text-sm hover:underline"
          >
            Clear all
          </button>
        )}
      </div>
      {GROUPS.map((g) => (
        <Group
          key={g.key}
          title={g.title}
          options={facets[g.key]}
          selected={query[g.key] as string[]}
          defaultOpen={
            g.key === 'provider' || g.key === 'category' || (query[g.key] as string[]).length > 0
          }
          onToggle={(v) => onToggle(g.key, v)}
        />
      ))}
    </div>
  );
}
