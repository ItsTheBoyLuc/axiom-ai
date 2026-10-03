'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { MAX_COMPARE, compareHref } from '@/lib/comparison';
import { duration, ease, spring } from '@/lib/motion';
import { useComparison } from './comparison-store';

/**
 * Sticky comparison tray (max 4). Lives in the root layout so the selection persists across
 * pages. Renders a spacer of the same height so it never covers the footer. Hidden on
 * /compare itself, which has its own selection controls (and keeps the tray in sync with the URL).
 */
export function ComparisonTray() {
  const { list, remove, clear } = useComparison();
  const onCompare = usePathname() === '/compare';
  const open = list.length > 0 && !onCompare;

  return (
    <>
      {/* Keeps page content clear of the fixed tray. */}
      {open && <div aria-hidden className="h-28 sm:h-24" />}
      <AnimatePresence>
        {open && (
          <motion.aside
            aria-label="Comparison tray"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40, transition: { duration: duration.fast, ease: ease.in } }}
            transition={spring.soft}
            className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3 sm:px-6 sm:pb-4"
          >
            <div className="border-line-strong bg-elevated mx-auto flex max-w-[1280px] flex-col gap-3 rounded-2xl border p-3 shadow-[var(--shadow-pop)] sm:flex-row sm:items-center sm:p-4">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <p className="text-fg shrink-0 text-sm font-medium" aria-live="polite">
                  <span className="font-mono">
                    {list.length}/{MAX_COMPARE}
                  </span>{' '}
                  <span className="hidden sm:inline">selected</span>
                </p>
                <ul className="flex min-w-0 flex-1 gap-2 overflow-x-auto py-0.5">
                  <AnimatePresence initial={false}>
                    {list.map((m) => (
                      <motion.li
                        key={m.slug}
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={spring.snappy}
                        className="border-line-strong bg-card text-fg flex shrink-0 items-center gap-1 rounded-full border py-1 pr-1 pl-3 text-sm"
                      >
                        <span>{m.name}</span>
                        <button
                          type="button"
                          onClick={() => remove(m.slug)}
                          aria-label={`Remove ${m.name} from comparison`}
                          className="text-fg-2 hover:bg-elevated hover:text-fg inline-flex size-6 items-center justify-center rounded-full"
                        >
                          <X size={14} aria-hidden />
                        </button>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={clear}
                  className="text-fg-2 hover:bg-card hover:text-fg h-10 rounded-lg px-3 text-sm"
                >
                  Clear
                </button>
                {list.length >= 2 ? (
                  <Link
                    href={compareHref(list)}
                    className="bg-accent text-accent-fg inline-flex h-10 flex-1 items-center justify-center rounded-lg px-5 text-sm font-medium hover:brightness-110 sm:flex-none"
                  >
                    Compare
                  </Link>
                ) : (
                  <span className="border-line text-muted inline-flex h-10 flex-1 items-center justify-center rounded-lg border px-4 text-sm sm:flex-none">
                    Select 2 or more
                  </span>
                )}
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
