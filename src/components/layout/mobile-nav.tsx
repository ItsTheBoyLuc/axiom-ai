'use client';

import Link from 'next/link';
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Menu, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { MobileAccount } from '@/components/account/mobile-account';
import { Logo } from '@/components/ui/logo';
import { primaryNav } from '@/lib/routes';
import { duration, ease, spring, staggerDelay } from '@/lib/motion';

/** Mobile navigation drawer (Radix Dialog: focus trap, Esc to close, scroll lock). */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        aria-label="Open menu"
        className="text-fg-2 hover:bg-elevated hover:text-fg inline-flex size-10 items-center justify-center rounded-lg lg:hidden"
      >
        <Menu size={20} aria-hidden />
      </Dialog.Trigger>
      <AnimatePresence>
        {open && (
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
                className="border-line-strong bg-bg-2 fixed inset-y-0 right-0 z-[65] flex w-[min(340px,86vw)] flex-col border-l p-5"
                style={{ background: 'var(--bg-secondary)' }}
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={spring.soft}
              >
                <div className="mb-8 flex items-center justify-between">
                  <Dialog.Title asChild>
                    <span>
                      <Logo variant="full" size={24} />
                    </span>
                  </Dialog.Title>
                  <Dialog.Close
                    aria-label="Close menu"
                    className="text-fg-2 hover:bg-elevated hover:text-fg inline-flex size-10 items-center justify-center rounded-lg"
                  >
                    <X size={20} aria-hidden />
                  </Dialog.Close>
                </div>
                <nav aria-label="Mobile">
                  <ul className="flex flex-col gap-1">
                    {primaryNav.map((item, i) => (
                      <motion.li
                        key={item.href}
                        initial={{ opacity: 0, x: 16 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          delay: 0.08 + i * staggerDelay,
                          duration: duration.base,
                          ease: ease.out,
                        }}
                      >
                        <Link
                          href={item.href}
                          onClick={() => setOpen(false)}
                          className="text-fg-2 hover:bg-elevated hover:text-fg block rounded-lg px-3 py-3 text-lg"
                        >
                          {item.label}
                        </Link>
                      </motion.li>
                    ))}
                  </ul>
                </nav>
                <MobileAccount onNavigate={() => setOpen(false)} />
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
