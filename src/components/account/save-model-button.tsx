'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { setLocalSaved } from './session-store';
import { useSession } from './session-provider';

const base =
  'inline-flex h-10 items-center gap-1.5 rounded-lg border px-4 text-sm font-medium transition-colors';
const idle = 'border-line-strong bg-elevated text-fg hover:border-fg-2/50';

/**
 * Save / unsave a model to the account. Anonymous visitors get a plain link to sign in (and come
 * back to this page): there is no dead button. Toggling is optimistic and rolls back on failure.
 */
export function SaveModelButton({ slug, name }: { slug: string; name: string }) {
  const session = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  if (session.status === 'loading') {
    return (
      <span aria-hidden className={`${base} ${idle} opacity-60`}>
        <Bookmark size={15} /> Save
      </span>
    );
  }
  if (session.status === 'anonymous') {
    return (
      <Link
        href={`/sign-in?next=${encodeURIComponent(`/models/${slug}`)}`}
        className={`${base} ${idle}`}
        title="Sign in to save this model"
      >
        <Bookmark size={15} aria-hidden /> Sign in to save
      </Link>
    );
  }

  const saved = session.saved.includes(slug);
  async function toggle() {
    if (busy) return;
    setBusy(true);
    setError(false);
    const next = !saved;
    setLocalSaved(slug, next); // optimistic
    try {
      const res = await fetch(
        next ? '/api/v1/me/saved-models' : `/api/v1/me/saved-models/${slug}`,
        {
          method: next ? 'POST' : 'DELETE',
          credentials: 'same-origin',
          headers: next ? { 'Content-Type': 'application/json' } : undefined,
          body: next ? JSON.stringify({ slug }) : undefined,
        },
      );
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setLocalSaved(slug, !next);
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        onClick={() => void toggle()}
        aria-pressed={saved}
        className={`${base} ${saved ? 'border-accent bg-accent/10 text-fg' : idle}`}
      >
        {saved ? <BookmarkCheck size={15} aria-hidden /> : <Bookmark size={15} aria-hidden />}
        {saved ? 'Saved' : 'Save'}
        <span className="sr-only"> {name}</span>
      </button>
      <span role={error ? 'alert' : 'status'} className="text-danger mt-1 text-xs">
        {error ? 'Could not update your saved models.' : ''}
      </span>
    </span>
  );
}
