'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { PanelLeftClose, PanelLeftOpen, SlidersHorizontal, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { activeFilterCount } from '@/lib/models/query';
import { duration, ease, spring } from '@/lib/motion';
import type { BenchmarkOption, ModelFacets } from '@/types/model';
import { ActiveFilters } from './active-filters';
import { FilterGroups } from './filter-groups';
import { SearchBox } from './search-box';
import { SortControls } from './sort-controls';
import { useModelsUrl } from './url-state';

/**
 * Directory chrome: search, sort, desktop filter sidebar (collapsible) and the mobile filter
 * sheet. The results themselves are server-rendered and passed in as children.
 */
export function DirectoryShell({
  facets,
  benchmarks,
  total,
  children,
}: {
  facets: ModelFacets;
  benchmarks: BenchmarkOption[];
  total: number;
  children: React.ReactNode;
}) {
  const { query, toggle, clearAll } = useModelsUrl();
  const [sidebar, setSidebar] = useState(true);
  const [sheet, setSheet] = useState(false);
  const active = activeFilterCount(query);

  const groups = (showTitle: boolean) => (
    <FilterGroups
      facets={facets}
      query={query}
      onToggle={toggle}
      onClear={clearAll}
      activeCount={active}
      showTitle={showTitle}
    />
  );
  const filterBtn =
    'h-10 items-center gap-2 rounded-lg border border-line-strong bg-elevated px-3.5 text-sm text-fg hover:border-fg-2/50';

  return (
    <>
      <div className="mb-6 flex flex-col gap-4">
        <SearchBox />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {/* Mobile: filters open as a bottom sheet */}
            <Dialog.Root open={sheet} onOpenChange={setSheet}>
              <Dialog.Trigger className={`${filterBtn} inline-flex lg:hidden`}>
                <SlidersHorizontal size={16} aria-hidden />
                Filters
                {active > 0 && (
                  <span className="bg-accent text-accent-fg rounded-full px-1.5 font-mono text-xs">
                    {active}
                  </span>
                )}
              </Dialog.Trigger>
              <AnimatePresence>
                {sheet && (
                  <Dialog.Portal forceMount>
                    <Dialog.Overlay asChild>
                      <motion.div
                        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: duration.fast, ease: ease.out }}
                      />
                    </Dialog.Overlay>
                    <Dialog.Content asChild aria-describedby={undefined}>
                      <motion.div
                        className="border-line-strong fixed inset-x-0 bottom-0 z-[65] flex max-h-[88svh] flex-col rounded-t-2xl border-t"
                        style={{ background: 'var(--bg-secondary)' }}
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={spring.soft}
                      >
                        <div className="border-line flex items-center justify-between border-b px-5 py-4">
                          <Dialog.Title className="text-fg font-medium">Filter models</Dialog.Title>
                          <Dialog.Close
                            aria-label="Close filters"
                            className="text-fg-2 hover:bg-elevated hover:text-fg inline-flex size-9 items-center justify-center rounded-lg"
                          >
                            <X size={18} aria-hidden />
                          </Dialog.Close>
                        </div>
                        <div className="flex-1 overflow-y-auto px-5 py-4">{groups(false)}</div>
                        <div className="border-line border-t p-4">
                          <Dialog.Close className="bg-accent text-accent-fg h-11 w-full rounded-lg text-sm font-medium">
                            Show {total} {total === 1 ? 'model' : 'models'}
                          </Dialog.Close>
                        </div>
                      </motion.div>
                    </Dialog.Content>
                  </Dialog.Portal>
                )}
              </AnimatePresence>
            </Dialog.Root>

            {/* Desktop: collapsible sidebar */}
            <button
              type="button"
              onClick={() => setSidebar((s) => !s)}
              aria-expanded={sidebar}
              aria-controls="filter-sidebar"
              className={`${filterBtn} hidden lg:inline-flex`}
            >
              {sidebar ? (
                <PanelLeftClose size={16} aria-hidden />
              ) : (
                <PanelLeftOpen size={16} aria-hidden />
              )}
              {sidebar ? 'Hide filters' : 'Show filters'}
              {active > 0 && !sidebar && (
                <span className="bg-accent text-accent-fg rounded-full px-1.5 font-mono text-xs">
                  {active}
                </span>
              )}
            </button>
          </div>
          <SortControls benchmarks={benchmarks} />
        </div>
      </div>

      <div className={`grid gap-8 ${sidebar ? 'lg:grid-cols-[264px_minmax(0,1fr)]' : ''}`}>
        {sidebar && (
          <section id="filter-sidebar" aria-label="Filters" className="hidden lg:block">
            <div className="border-line bg-card sticky top-24 max-h-[calc(100svh-7rem)] overflow-y-auto rounded-2xl border p-5">
              {groups(true)}
            </div>
          </section>
        )}
        <div className="min-w-0">
          <ActiveFilters facets={facets} />
          {children}
        </div>
      </div>
    </>
  );
}
