'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Play } from 'lucide-react';

const btn =
  'inline-flex h-10 items-center gap-1.5 rounded-lg border border-line-strong bg-elevated px-3 text-sm text-fg-2 transition-colors hover:text-fg disabled:opacity-50';

/** Row actions for a sync source: run now, enable/disable, edit. The server decides what is allowed. */
export function SourceActions({
  id,
  name,
  enabled,
  workerOnline,
}: {
  id: string;
  name: string;
  enabled: boolean;
  workerOnline: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  async function call(method: string, url: string, body: unknown, ok: string) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(url, {
        method,
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => null)) as { error?: { message: string } } | null;
      if (res.ok) {
        setMessage({ text: ok, error: false });
        router.refresh();
      } else {
        setMessage({ text: json?.error?.message ?? 'The action failed.', error: true });
      }
    } catch {
      setMessage({ text: 'Could not reach the server.', error: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || !enabled}
          onClick={() =>
            call(
              'POST',
              `/api/v1/admin/sync/sources/${id}/run`,
              {},
              workerOnline
                ? 'Run queued. Refresh in a moment to see the result.'
                : 'Run queued, but no worker has reported in: it will start when the worker is up.',
            )
          }
          className={btn}
          title={enabled ? undefined : 'Enable the source first.'}
        >
          <Play size={14} aria-hidden /> Run now<span className="sr-only"> for {name}</span>
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            call(
              'PUT',
              `/api/v1/admin/sync/sources/${id}/enabled`,
              { enabled: !enabled },
              enabled ? 'Source disabled.' : 'Source enabled.',
            )
          }
          className={btn}
        >
          {enabled ? 'Disable' : 'Enable'}
          <span className="sr-only"> {name}</span>
        </button>
        <Link href={`/admin/sync/sources/${id}`} className={btn}>
          Edit<span className="sr-only"> {name}</span>
        </Link>
      </div>
      {message && (
        <p
          role={message.error ? 'alert' : 'status'}
          className={`text-sm ${message.error ? 'text-danger' : 'text-fg-2'}`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
