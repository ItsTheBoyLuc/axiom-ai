'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Search } from 'lucide-react';
import { motion } from 'motion/react';
import { Logo } from '@/components/ui/logo';
import { primaryNav } from '@/lib/routes';
import { spring } from '@/lib/motion';
import { usePalette } from './command-palette';
import { MobileNav } from './mobile-nav';
import { ThemeToggle } from './theme-toggle';

export function Navbar() {
  const pathname = usePathname();
  const { setOpen } = usePalette();
  const [scrolled, setScrolled] = useState(false);
  // Client-only platform check without a setState-in-effect (server snapshot: not a Mac).
  const mac = useSyncExternalStore(
    () => () => {},
    () => /Mac|iPhone|iPad/.test(navigator.platform),
    () => false,
  );

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-colors duration-200 ${
        scrolled ? 'border-line bg-bg/80 backdrop-blur-xl' : 'border-transparent bg-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="AXIOM AI home" className="mr-2 shrink-0">
          <Logo variant="full" size={28} />
        </Link>

        <nav aria-label="Primary" className="hidden flex-1 items-center gap-1 lg:flex">
          {primaryNav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`relative rounded-lg px-3 py-2 text-sm transition-colors ${
                  active ? 'text-fg' : 'text-fg-2 hover:text-fg'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    transition={spring.snappy}
                    className="bg-elevated absolute inset-0 -z-10 rounded-lg"
                  />
                )}
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1 lg:ml-0">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open search"
            className="border-line bg-elevated/60 text-fg-2 hover:border-line-strong hover:text-fg hidden h-10 items-center gap-2 rounded-lg border pr-2 pl-3 text-sm transition-colors sm:inline-flex"
          >
            <Search size={16} aria-hidden />
            <span className="mr-6">Search</span>
            <kbd className="border-line text-muted rounded border px-1.5 py-0.5 font-mono text-[11px]">
              {mac ? '⌘K' : 'Ctrl K'}
            </kbd>
          </button>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open search"
            className="text-fg-2 hover:bg-elevated hover:text-fg inline-flex size-10 items-center justify-center rounded-lg sm:hidden"
          >
            <Search size={18} aria-hidden />
          </button>
          <ThemeToggle />
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
