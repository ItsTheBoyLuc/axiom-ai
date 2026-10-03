'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'motion/react';
import { PaletteBody } from '@/components/search/palette-body';
import { duration, ease, spring } from '@/lib/motion';

type PaletteCtx = { open: boolean; setOpen: (o: boolean) => void };
const Ctx = createContext<PaletteCtx | null>(null);

export function usePalette(): PaletteCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('usePalette must be used within PaletteProvider');
  return c;
}

/**
 * Global search palette, opened with Cmd/Ctrl+K or the navbar search button. The dialog (Radix)
 * traps focus and closes on Escape; its content (PaletteBody) searches models, providers,
 * benchmarks, releases, news and research through the real API.
 */
export function PaletteProvider({ children }: { children: React.ReactNode }) {
  // `session` changes on every open, so a palette reopened while the previous one is still
  // animating out starts fresh (empty field, focused) instead of reviving the old content.
  const [state, setState] = useState({ open: false, session: 0 });
  const { open, session } = state;
  const setOpen = useCallback((next: boolean | ((o: boolean) => boolean)) => {
    setState((s) => {
      const o = typeof next === 'function' ? next(s.open) : next;
      return o === s.open ? s : { open: o, session: o ? s.session + 1 : s.session };
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);

  const value = useMemo(() => ({ open, setOpen }), [open, setOpen]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <AnimatePresence>
          {open && (
            <Dialog.Portal forceMount key={session}>
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
                  <PaletteBody close={() => setOpen(false)} />
                </motion.div>
              </Dialog.Content>
            </Dialog.Portal>
          )}
        </AnimatePresence>
      </Dialog.Root>
    </Ctx.Provider>
  );
}
