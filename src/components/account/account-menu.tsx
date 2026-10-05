'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Bookmark, LogOut, Settings, Shield, User } from 'lucide-react';
import { motion } from 'motion/react';
import { spring } from '@/lib/motion';
import { announceSessionChange, useSession } from './session-provider';

const item =
  'text-fg-2 data-[highlighted]:bg-card data-[highlighted]:text-fg flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none';

/** First letters of the name (or the email), for the avatar button. */
const initials = (name: string | null, email: string) =>
  (name?.trim() || email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');

/** Pages that only make sense signed in: leaving them on sign-out avoids a dead end. */
const PRIVATE = /^\/(account|settings|admin)(\/|$)/;

/**
 * Navbar account control. Anonymous visitors see "Sign in" (and the rest of the site is
 * unchanged); signed-in people get a menu. While the session is still loading a same-size
 * placeholder holds the space, so the navbar does not jump.
 */
export function AccountMenu() {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();

  if (session.status === 'loading') {
    return <span aria-hidden className="hidden h-10 w-[5.5rem] sm:inline-block" />;
  }
  if (session.status === 'anonymous') {
    return (
      <Link
        href={`/sign-in${pathname && pathname !== '/' && !pathname.startsWith('/sign-') ? `?next=${encodeURIComponent(pathname)}` : ''}`}
        className="text-fg-2 hover:bg-elevated hover:text-fg hidden h-10 items-center gap-2 rounded-lg px-3 text-sm transition-colors sm:inline-flex"
      >
        <User size={16} aria-hidden /> Sign in
      </Link>
    );
  }

  const { user } = session;
  async function signOut() {
    try {
      await fetch('/api/v1/auth/sign-out', { method: 'POST', credentials: 'same-origin' });
    } finally {
      announceSessionChange();
      if (PRIVATE.test(pathname)) router.replace('/');
      else router.refresh();
    }
  }

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        aria-label="Account menu"
        className="bg-elevated text-fg border-line hover:border-line-strong hidden size-10 items-center justify-center rounded-full border font-mono text-xs transition-colors sm:inline-flex"
      >
        {initials(user.name, user.email)}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} asChild>
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={spring.snappy}
            className="border-line-strong bg-elevated z-[70] min-w-56 origin-top-right rounded-xl border p-1.5 shadow-[var(--shadow-pop)]"
          >
            <DropdownMenu.Label className="px-2.5 py-2">
              <span className="text-fg block truncate text-sm font-medium">
                {user.name || 'Signed in'}
              </span>
              <span className="text-muted block truncate font-mono text-xs">{user.email}</span>
            </DropdownMenu.Label>
            <DropdownMenu.Separator className="bg-line my-1 h-px" />
            <DropdownMenu.Item asChild className={item}>
              <Link href="/account">
                <Bookmark size={16} aria-hidden /> Saved and recent
              </Link>
            </DropdownMenu.Item>
            <DropdownMenu.Item asChild className={item}>
              <Link href="/settings">
                <Settings size={16} aria-hidden /> Settings
              </Link>
            </DropdownMenu.Item>
            {user.role === 'ADMIN' && (
              <DropdownMenu.Item asChild className={item}>
                <Link href="/admin">
                  <Shield size={16} aria-hidden /> Admin
                </Link>
              </DropdownMenu.Item>
            )}
            <DropdownMenu.Separator className="bg-line my-1 h-px" />
            <DropdownMenu.Item className={item} onSelect={() => void signOut()}>
              <LogOut size={16} aria-hidden /> Sign out
            </DropdownMenu.Item>
          </motion.div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
