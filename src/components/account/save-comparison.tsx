'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { BookmarkPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MAX_COMPARISON_NAME } from '@/lib/account/schemas';
import { useSession } from './session-provider';

const base =
  'inline-flex h-10 items-center gap-1.5 rounded-lg border px-4 text-sm font-medium transition-colors border-line-strong bg-elevated text-fg hover:border-fg-2/50';

/**
 * "Save comparison" on the compare page. Needs two to four models. Anonymous visitors get a link
 * to sign in and come back to this exact comparison (the models are in the URL).
 */
export function SaveComparison({ slugs, names }: { slugs: string[]; names: string[] }) {
  const session = useSession();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ text: string; error: boolean } | null>(null);

  if (slugs.length < 2 || session.status === 'loading') return null;

  if (session.status === 'anonymous') {
    const back = `/compare?models=${slugs.join(',')}`;
    return (
      <Link
        href={`/sign-in?next=${encodeURIComponent(back)}`}
        className={base}
        title="Sign in to save this comparison"
      >
        <BookmarkPlus size={15} aria-hidden /> Sign in to save
      </Link>
    );
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/v1/me/comparisons', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, models: slugs }),
      });
      if (res.ok) {
        setResult({ text: 'Comparison saved.', error: false });
        setOpen(false);
        setName('');
      } else {
        const body = (await res.json().catch(() => null)) as {
          error?: { message: string; details?: { issues?: { message: string }[] } };
        } | null;
        setResult({
          text:
            body?.error?.details?.issues?.map((i) => i.message).join(' ') ||
            body?.error?.message ||
            'The comparison could not be saved.',
          error: true,
        });
      }
    } catch {
      setResult({ text: 'Could not reach the server. Try again.', error: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!open && (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => {
            setName(names.join(' vs ').slice(0, MAX_COMPARISON_NAME));
            setResult(null);
            setOpen(true);
          }}
          className={base}
        >
          <BookmarkPlus size={15} aria-hidden /> Save comparison
        </button>
      )}
      {open && (
        <form onSubmit={save} className="flex flex-wrap items-center gap-2">
          <label htmlFor={`${id}-name`} className="sr-only">
            Name of the comparison
          </label>
          <input
            id={`${id}-name`}
            autoFocus
            value={name}
            maxLength={MAX_COMPARISON_NAME}
            onChange={(e) => setName(e.target.value)}
            className="border-line-strong bg-elevated text-fg h-10 w-64 max-w-full rounded-lg border px-3 text-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
          />
          <Button type="submit" disabled={busy || !name.trim()}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-fg-2 hover:text-fg h-10 px-2 text-sm"
          >
            Cancel
          </button>
        </form>
      )}
      <p
        role={result?.error ? 'alert' : 'status'}
        className={`text-sm ${result?.error ? 'text-danger' : 'text-fg-2'}`}
      >
        {result?.text}
        {result && !result.error && (
          <>
            {' '}
            <Link href="/account" className="text-accent underline underline-offset-2">
              View saved comparisons
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
