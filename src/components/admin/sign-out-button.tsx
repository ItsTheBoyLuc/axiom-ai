'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';

/** Revokes the session on the server (the cookie alone proves nothing), then leaves the admin. */
export function SignOutButton({ email }: { email: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await fetch('/api/v1/auth/sign-out', { method: 'POST', credentials: 'same-origin' });
    } finally {
      router.replace('/sign-in');
      router.refresh();
    }
  }

  return (
    <div className="lg:border-line lg:rounded-xl lg:border lg:p-3">
      <p className="text-muted hidden text-xs lg:block">Signed in as</p>
      <p className="text-fg-2 hidden truncate font-mono text-xs lg:block" title={email}>
        {email}
      </p>
      <button
        type="button"
        onClick={signOut}
        disabled={busy}
        className="border-line-strong bg-elevated text-fg-2 hover:text-fg inline-flex h-10 w-auto items-center justify-center gap-2 rounded-lg border px-4 text-sm transition-colors disabled:opacity-60 lg:mt-2 lg:w-full"
      >
        <LogOut size={16} aria-hidden /> {busy ? 'Signing out…' : 'Sign out'}
      </button>
    </div>
  );
}
