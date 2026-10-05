'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { announceSessionChange, useSession } from './session-provider';

const link = 'text-fg-2 hover:bg-elevated hover:text-fg block rounded-lg px-3 py-3 text-base';
const PRIVATE = /^\/(account|settings|admin)(\/|$)/;

/** The account part of the mobile drawer (the navbar's account menu is hidden on phones). */
export function MobileAccount({ onNavigate }: { onNavigate: () => void }) {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  if (session.status === 'loading') return null;

  async function signOut() {
    onNavigate();
    try {
      await fetch('/api/v1/auth/sign-out', { method: 'POST', credentials: 'same-origin' });
    } finally {
      announceSessionChange();
      if (PRIVATE.test(pathname)) router.replace('/');
      else router.refresh();
    }
  }

  return (
    <nav aria-label="Account" className="border-line mt-6 border-t pt-4">
      {session.status === 'anonymous' ? (
        <ul>
          <li>
            <Link href="/sign-in" onClick={onNavigate} className={link}>
              Sign in
            </Link>
          </li>
          <li>
            <Link href="/sign-up" onClick={onNavigate} className={link}>
              Create an account
            </Link>
          </li>
        </ul>
      ) : (
        <>
          <p className="text-muted truncate px-3 pb-2 font-mono text-xs">{session.user.email}</p>
          <ul>
            <li>
              <Link href="/account" onClick={onNavigate} className={link}>
                Saved and recent
              </Link>
            </li>
            <li>
              <Link href="/settings" onClick={onNavigate} className={link}>
                Settings
              </Link>
            </li>
            {session.user.role === 'ADMIN' && (
              <li>
                <Link href="/admin" onClick={onNavigate} className={link}>
                  Admin
                </Link>
              </li>
            )}
            <li>
              <button
                type="button"
                onClick={() => void signOut()}
                className={`${link} w-full text-left`}
              >
                Sign out
              </button>
            </li>
          </ul>
        </>
      )}
    </nav>
  );
}
