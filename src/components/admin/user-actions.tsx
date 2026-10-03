'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmButton } from './confirm-button';

const btn =
  'inline-flex h-10 items-center rounded-lg border border-line-strong bg-elevated px-3 text-sm text-fg-2 transition-colors hover:text-fg disabled:opacity-50';

/**
 * Row actions for one user: change role, sign out everywhere, delete. The server enforces the
 * rules (no self-service, last admin protected); this component shows its answer verbatim.
 */
export function UserActions({
  id,
  email,
  role,
  isSelf,
}: {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN';
  isSelf: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  async function call(method: string, url: string, body: unknown, ok: (data: unknown) => string) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(url, {
        method,
        credentials: 'same-origin',
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const json = (await res.json().catch(() => null)) as {
        data?: unknown;
        error?: { message: string };
      } | null;
      if (res.ok) {
        setMessage({ text: ok(json?.data), error: false });
        router.refresh();
      } else {
        setMessage({ text: json?.error?.message ?? 'The change was not applied.', error: true });
      }
    } catch {
      setMessage({ text: 'Could not reach the server.', error: true });
    } finally {
      setBusy(false);
    }
  }

  const other = role === 'ADMIN' ? 'USER' : 'ADMIN';
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || isSelf}
          onClick={() =>
            call('PUT', `/api/v1/admin/users/${id}/role`, { role: other }, () =>
              other === 'ADMIN' ? 'Made administrator.' : 'Made regular user.',
            )
          }
          className={btn}
          title={isSelf ? 'You cannot change your own role.' : undefined}
        >
          {other === 'ADMIN' ? 'Make admin' : 'Make regular user'}
          <span className="sr-only"> for {email}</span>
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            call('DELETE', `/api/v1/admin/users/${id}/sessions`, undefined, (d) => {
              const n = (d as { revoked?: number } | undefined)?.revoked ?? 0;
              return `Signed out of ${n} session${n === 1 ? '' : 's'}.`;
            })
          }
          className={btn}
        >
          Sign out everywhere<span className="sr-only"> for {email}</span>
        </button>
        {!isSelf && (
          <ConfirmButton
            label="Delete user"
            question={`Delete ${email}?`}
            busy={busy}
            onConfirm={() =>
              call('DELETE', `/api/v1/admin/users/${id}`, undefined, () => 'User deleted.')
            }
          />
        )}
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
