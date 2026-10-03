'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

/**
 * Approve / reject one staged import. If the import would lower the trust of stored data the
 * server refuses a plain approval; the override checkbox then appears and must be ticked on
 * purpose ("Approve and override"). Nothing is decided on the client.
 */
export function ImportReview({
  id,
  downgrade,
}: {
  id: string;
  /** Known up front from the staged diff, so the explicit choice is visible before clicking. */
  downgrade: boolean;
}) {
  const router = useRouter();
  const [override, setOverride] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(kind: 'approve' | 'reject') {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/sync/imports/${id}/${kind}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(kind === 'approve' ? { override } : {}),
      });
      const json = (await res.json().catch(() => null)) as {
        error?: { message: string; details?: { issues?: { message: string }[] } };
      } | null;
      if (res.ok) {
        router.replace('/admin/sync/imports?decided=' + kind);
        router.refresh();
        return;
      }
      const issues = json?.error?.details?.issues?.map((i) => i.message).join(' ');
      setError([json?.error?.message, issues].filter(Boolean).join(' ') || 'The decision failed.');
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {downgrade && (
        <label className="border-warn/50 bg-warn/5 text-fg flex items-start gap-3 rounded-lg border p-3 text-sm">
          <input
            type="checkbox"
            checked={override}
            onChange={(e) => setOverride(e.target.checked)}
            className="accent-accent mt-0.5 size-4"
          />
          <span>
            <span className="font-medium">Override the trust guard.</span> Publishing this will
            replace stored data with data of lower trust. Only tick this if you have checked the
            source yourself; the override is recorded in the audit log.
          </span>
        </label>
      )}
      {error && (
        <p
          role="alert"
          className="border-danger/40 bg-danger/5 text-fg rounded-lg border px-3 py-2 text-sm"
        >
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          disabled={busy || (downgrade && !override)}
          onClick={() => decide('approve')}
        >
          {busy ? 'Working…' : downgrade ? 'Approve and override' : 'Approve and publish'}
        </Button>
        <button
          type="button"
          disabled={busy}
          onClick={() => decide('reject')}
          className="border-line-strong bg-elevated text-fg-2 hover:text-fg inline-flex h-10 items-center rounded-lg border px-4 text-sm transition-colors disabled:opacity-50"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
