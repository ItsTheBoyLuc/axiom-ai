'use client';

import { Check, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { spring } from '@/lib/motion';
import { MAX_COMPARE } from '@/lib/comparison';
import { useComparison } from './comparison-store';

/** "Add to comparison" button. Disabled (with a reason) when 4 models are already selected. */
export function CompareToggle({
  slug,
  name,
  providerName,
  variant = 'card',
}: {
  slug: string;
  name: string;
  providerName: string;
  variant?: 'card' | 'header';
}) {
  const { has, full, toggle } = useComparison();
  const selected = has(slug);
  const blocked = full && !selected;
  const size = variant === 'header' ? 'h-10 px-4 text-sm' : 'h-9 px-3 text-sm';

  return (
    <motion.button
      type="button"
      aria-pressed={selected}
      disabled={blocked}
      title={blocked ? `You can compare up to ${MAX_COMPARE} models. Remove one first.` : undefined}
      whileTap={{ scale: 0.97 }}
      transition={spring.snappy}
      onClick={() => toggle({ slug, name, providerName })}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${size} ${
        selected
          ? 'border-accent bg-accent/10 text-fg'
          : 'border-line-strong bg-elevated text-fg hover:border-fg-2/50'
      }`}
    >
      {selected ? <Check size={15} aria-hidden /> : <Plus size={15} aria-hidden />}
      {selected ? 'In comparison' : 'Add to comparison'}
      <span className="sr-only"> {name}</span>
    </motion.button>
  );
}
