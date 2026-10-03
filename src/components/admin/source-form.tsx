'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { SCHEDULE_HELP } from '@/lib/sync/schedule';
import { ConfirmButton } from './confirm-button';
import { controlClass } from './field-input';

type Adapter = {
  kind: string;
  label: string;
  help: string;
  exampleConfig: Record<string, unknown>;
};
type Issue = { path: string; message: string };

/**
 * Create / edit a sync source. The configuration is JSON because every adapter has a different
 * shape; the server validates it with the adapter's own schema and the answer is shown here
 * verbatim, per field path. The example for the chosen type is one click away.
 */
export function SourceForm({
  adapters,
  id,
  initial,
}: {
  adapters: Adapter[];
  id: string | null;
  initial: {
    name: string;
    kind: string;
    schedule: string;
    enabled: boolean;
    config: unknown;
  } | null;
}) {
  const router = useRouter();
  const first = adapters[0]!;
  const [name, setName] = useState(initial?.name ?? '');
  const [kind, setKind] = useState(initial?.kind ?? first.kind);
  const [schedule, setSchedule] = useState(initial?.schedule ?? 'every 6h');
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [configText, setConfigText] = useState(
    JSON.stringify(initial?.config ?? first.exampleConfig, null, 2),
  );
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  const adapter = adapters.find((a) => a.kind === kind) ?? first;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setStatus(null);
    let config: unknown;
    try {
      config = JSON.parse(configText);
    } catch {
      setProblems(['The configuration is not valid JSON.']);
      return;
    }
    setBusy(true);
    setProblems([]);
    try {
      const res = await fetch(`/api/v1/admin/sync/sources${id ? `/${id}` : ''}`, {
        method: id ? 'PUT' : 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, kind, schedule, enabled, config }),
      });
      const json = (await res.json().catch(() => null)) as {
        data?: { id?: string };
        error?: { message: string; details?: { issues?: Issue[] } };
      } | null;
      if (res.ok) {
        if (!id && json?.data?.id) {
          router.replace('/admin/sync');
          router.refresh();
          return;
        }
        setStatus('Saved.');
        router.refresh();
        return;
      }
      const issues = json?.error?.details?.issues;
      setProblems(
        issues?.length
          ? issues.map((i) => (i.path ? `${i.path}: ${i.message}` : i.message))
          : [json?.error?.message ?? 'The source could not be saved.'],
      );
    } catch {
      setProblems(['Could not reach the server. Check your connection and try again.']);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!id) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/admin/sync/sources/${id}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (res.ok) {
        router.replace('/admin/sync');
        router.refresh();
        return;
      }
      setProblems(['The source could not be deleted.']);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} noValidate aria-busy={busy} className="max-w-3xl space-y-5">
      {problems.length > 0 && (
        <div role="alert" className="border-danger/40 bg-danger/5 rounded-lg border p-4 text-sm">
          <p className="text-fg font-medium">The source was not saved.</p>
          <ul className="text-fg-2 mt-1 list-disc space-y-0.5 pl-5">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <label htmlFor="src-name" className="text-fg text-sm font-medium">
          Name
        </label>
        <input
          id="src-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          autoComplete="off"
          className={`${controlClass} mt-1.5`}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="src-kind" className="text-fg text-sm font-medium">
            Source type
          </label>
          <select
            id="src-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className={`${controlClass} mt-1.5`}
          >
            {adapters.map((a) => (
              <option key={a.kind} value={a.kind}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="src-schedule" className="text-fg text-sm font-medium">
            Schedule
          </label>
          <input
            id="src-schedule"
            value={schedule}
            onChange={(e) => setSchedule(e.target.value)}
            aria-describedby="src-schedule-help"
            autoComplete="off"
            spellCheck={false}
            className={`${controlClass} mt-1.5 font-mono`}
          />
          <p id="src-schedule-help" className="text-muted mt-1 text-xs">
            {SCHEDULE_HELP}
          </p>
        </div>
      </div>

      <p className="text-fg-2 text-sm">{adapter.help}</p>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="src-config" className="text-fg text-sm font-medium">
            Configuration (JSON)
          </label>
          <button
            type="button"
            onClick={() => setConfigText(JSON.stringify(adapter.exampleConfig, null, 2))}
            className="text-accent text-xs hover:underline"
          >
            Insert the example for this type
          </button>
        </div>
        <textarea
          id="src-config"
          value={configText}
          onChange={(e) => setConfigText(e.target.value)}
          rows={12}
          spellCheck={false}
          className={`${controlClass} mt-1.5 h-auto py-2 font-mono text-xs leading-relaxed`}
        />
        <p className="text-muted mt-1 text-xs">
          Only official feeds and public APIs. robots.txt and rate limits are always respected, and
          nothing a source returns is published without your approval.
        </p>
      </div>

      <label className="text-fg flex items-center gap-2.5 text-sm font-medium">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="accent-accent size-4"
        />
        Enabled (runs on its schedule)
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : id ? 'Save changes' : 'Create source'}
        </Button>
        {status && (
          <p role="status" className="text-fg text-sm">
            {status}
          </p>
        )}
        {id && (
          <span className="sm:ml-auto">
            <ConfirmButton
              label="Delete source"
              question="Delete this source and its run history?"
              onConfirm={remove}
              busy={busy}
            />
          </span>
        )}
      </div>
    </form>
  );
}
