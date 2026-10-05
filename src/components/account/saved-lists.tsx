'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { ConfirmButton } from '@/components/admin/confirm-button';

type Model = { slug: string; name: string; providerName: string };
type Comparison = { id: string; name: string; models: Model[]; href: string; createdAt: string };

const iconButton =
  'text-fg-2 hover:bg-elevated hover:text-fg inline-flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-50';

/** Saved models with a remove button each. Removal is optimistic and rolled back on failure. */
export function SavedModelsList({ initial }: { initial: (Model & { savedAt: string })[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  async function remove(slug: string) {
    const before = items;
    setItems(items.filter((m) => m.slug !== slug));
    setError(null);
    try {
      const res = await fetch(`/api/v1/me/saved-models/${slug}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setItems(before);
      setError('Could not remove the model. Try again.');
    }
  }

  if (items.length === 0) {
    return (
      <p className="border-line text-fg-2 rounded-xl border p-6 text-sm">
        You have not saved any models yet. Use <strong className="text-fg">Save</strong> on a
        model&rsquo;s page to keep it here.{' '}
        <Link href="/models" className="text-accent underline underline-offset-2">
          Browse models
        </Link>
      </p>
    );
  }
  return (
    <div>
      {error && (
        <p role="alert" className="text-danger mb-2 text-sm">
          {error}
        </p>
      )}
      <ul className="border-line divide-line divide-y rounded-xl border">
        {items.map((m) => (
          <li key={m.slug} className="flex items-center gap-2 px-4 py-2">
            <Link href={`/models/${m.slug}`} className="min-w-0 flex-1 py-1">
              <span className="text-fg block truncate text-sm font-medium">{m.name}</span>
              <span className="text-fg-2 block truncate text-xs">{m.providerName}</span>
            </Link>
            <button
              type="button"
              onClick={() => void remove(m.slug)}
              aria-label={`Remove ${m.name} from saved models`}
              className={iconButton}
            >
              <Trash2 size={16} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Saved comparisons: reopen (a plain link to /compare) or delete (asks first). */
export function SavedComparisonsList({ initial }: { initial: Comparison[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  async function remove(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/v1/me/comparisons/${id}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error();
      setItems((cur) => cur.filter((c) => c.id !== id));
      router.refresh();
    } catch {
      setError('Could not delete the comparison. Try again.');
    }
  }

  if (items.length === 0) {
    return (
      <p className="border-line text-fg-2 rounded-xl border p-6 text-sm">
        No saved comparisons yet. Pick two to four models on the compare page and choose{' '}
        <strong className="text-fg">Save comparison</strong>.{' '}
        <Link href="/compare" className="text-accent underline underline-offset-2">
          Open the compare page
        </Link>
      </p>
    );
  }
  return (
    <div>
      {error && (
        <p role="alert" className="text-danger mb-2 text-sm">
          {error}
        </p>
      )}
      <ul className="border-line divide-line divide-y rounded-xl border">
        {items.map((c) => (
          <li key={c.id} className="space-y-2 px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <Link
                href={c.href}
                className="text-fg text-sm font-medium hover:underline"
                aria-label={`Open comparison ${c.name}`}
              >
                {c.name}
              </Link>
              <time dateTime={c.createdAt} className="text-muted font-mono text-xs">
                {c.createdAt.slice(0, 10)}
              </time>
            </div>
            <p className="text-fg-2 text-xs">{c.models.map((m) => m.name).join(' · ')}</p>
            <ConfirmButton
              label="Delete"
              question={`Delete "${c.name}"?`}
              onConfirm={() => remove(c.id)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
