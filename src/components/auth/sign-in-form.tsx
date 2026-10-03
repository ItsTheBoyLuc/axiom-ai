'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

const field =
  'h-11 w-full rounded-lg border border-line-strong bg-elevated px-3 text-sm text-fg outline-none focus-visible:outline-2 focus-visible:outline-offset-2';

/**
 * Email and password sign-in. The credentials are sent in a JSON POST body to our own API (never
 * in a URL), the server answers with one uniform message for every kind of wrong credential, and
 * on success the session cookie is already set (httpOnly), so the page only has to navigate.
 */
export function SignInForm({ next }: { next: string }) {
  const router = useRouter();
  const id = useId();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/auth/sign-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password, next }),
      });
      if (res.ok) {
        const body = (await res.json()) as { data: { next: string } };
        router.replace(body.data.next);
        router.refresh();
        return;
      }
      if (res.status === 429) {
        const wait = Number(res.headers.get('retry-after') ?? '0');
        setError(
          wait > 0
            ? `Too many attempts. Try again in about ${Math.ceil(wait / 60)} minute${wait > 90 ? 's' : ''}.`
            : 'Too many attempts. Try again later.',
        );
      } else if (res.status === 400) {
        setError('Enter a valid email address and your password.');
      } else if (res.status === 401) {
        setError('The email or password is incorrect.');
      } else {
        setError('Sign-in is unavailable right now. Try again in a moment.');
      }
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
      setPassword(''); // never keep a password in memory longer than needed
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5" aria-busy={busy}>
      <div>
        <label htmlFor={`${id}-email`} className="text-fg text-sm font-medium">
          Email
        </label>
        <input
          id={`${id}-email`}
          name="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`${field} mt-1.5`}
        />
      </div>
      <div>
        <label htmlFor={`${id}-password`} className="text-fg text-sm font-medium">
          Password
        </label>
        <input
          id={`${id}-password`}
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`${field} mt-1.5`}
        />
      </div>
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="border-danger/40 bg-danger/5 text-fg rounded-lg border px-3 py-2 text-sm"
        >
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy || !email || !password} className="w-full">
        {busy ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
