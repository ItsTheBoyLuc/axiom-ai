'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import { Command } from 'cmdk';
import { CornerDownLeft, Search } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { primaryNav } from '@/lib/routes';
import { duration, ease, spring } from '@/lib/motion';

type PaletteCtx = { open: boolean; setOpen: (o: boolean) => void };
const Ctx = createContext<PaletteCtx | null>(null);

export function usePalette(): PaletteCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('usePalette must be used within PaletteProvider');
  return c;
}

const pages = [{ label: 'Home', href: '/' }, ...primaryNav];

/**
 * Phase 1 shell: cmdk palette opened with Cmd/Ctrl+K that navigates between pages.
 * Search across models, providers, benchmarks, releases and news is wired in Phase 7,
 * so this shell does not render category chips or a "see all results" row yet.
 */
export function PaletteProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  const value = useMemo(() => ({ open, setOpen }), [open]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <AnimatePresence>
          {open && (
            <Dialog.Portal forceMount>
              <Dialog.Overlay asChild>
                <motion.div
                  className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: duration.fast, ease: ease.out }}
                />
              </Dialog.Overlay>
              <Dialog.Content asChild aria-describedby={undefined}>
                <motion.div
                  className="border-line-strong bg-elevated fixed top-[14vh] left-1/2 z-[90] w-[min(640px,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-2xl border shadow-[var(--shadow-pop)]"
                  initial={{ opacity: 0, scale: 0.97, y: -8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98, y: -4 }}
                  transition={spring.soft}
                >
                  <Dialog.Title className="sr-only">Command palette</Dialog.Title>
                  <Command label="Command palette" loop>
                    <div className="border-line flex items-center gap-3 border-b px-4">
                      <Search size={18} className="text-muted" aria-hidden />
                      <Command.Input
                        autoFocus
                        placeholder="Jump to a page..."
                        className="text-fg placeholder:text-muted h-14 flex-1 bg-transparent text-base outline-none"
                      />
                      <kbd className="border-line text-muted rounded border px-1.5 py-0.5 font-mono text-[11px]">
                        ESC
                      </kbd>
                    </div>
                    <Command.List className="max-h-[50vh] overflow-y-auto p-2">
                      <Command.Empty className="text-fg-2 px-3 py-8 text-center text-sm">
                        No matching pages.
                      </Command.Empty>
                      <Command.Group
                        heading="Pages"
                        className="[&_[cmdk-group-heading]]:text-muted [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:uppercase"
                      >
                        {pages.map((p) => (
                          <Command.Item
                            key={p.href}
                            value={p.label}
                            onSelect={() => go(p.href)}
                            className="text-fg-2 data-[selected=true]:bg-card data-[selected=true]:text-fg flex cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 text-sm"
                          >
                            {p.label}
                            <CornerDownLeft
                              size={14}
                              className="opacity-0 data-[selected=true]:opacity-100 [[data-selected=true]_&]:opacity-60"
                              aria-hidden
                            />
                          </Command.Item>
                        ))}
                      </Command.Group>
                    </Command.List>
                  </Command>
                </motion.div>
              </Dialog.Content>
            </Dialog.Portal>
          )}
        </AnimatePresence>
      </Dialog.Root>
    </Ctx.Provider>
  );
}
