'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  buildPayload,
  fieldOfPath,
  initialValues,
  type Field,
  type FormValue,
  type FormValues,
  type Option,
  type RefKind,
} from '@/lib/admin/fields';
import { ConfirmButton } from './confirm-button';
import { FieldInput } from './field-input';

type Issue = { path: string; message: string };

type Props = {
  entity: string;
  singular: string;
  fields: Field[];
  refs: Record<RefKind, Option[]>;
  /** null = creating a new record. */
  id: string | null;
  record: Record<string, unknown> | null;
  /** Shown after a redirect from a successful create. */
  justCreated?: boolean;
};

/**
 * Create / edit form for one admin record. The browser only does cheap checks (required, number
 * syntax); the server validates with the same schema as the seed pipeline and its answer, field
 * by field, is shown next to the controls. Nothing is saved on the page until the server says so.
 */
export function RecordForm({ entity, singular, fields, refs, id, record, justCreated }: Props) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(() => initialValues(fields, record));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(justCreated ? 'Created.' : null);
  const summaryRef = useRef<HTMLDivElement>(null);

  const set = (name: string, v: FormValue) => {
    setValues((cur) => ({ ...cur, [name]: v }));
    setStatus(null);
    setErrors((cur) => {
      if (!(name in cur)) return cur;
      const next = { ...cur };
      delete next[name];
      return next;
    });
  };

  function fail(fieldErrors: Record<string, string>, general: string[]) {
    setErrors(fieldErrors);
    setSummary(general.length ? general : Object.values(fieldErrors));
    // Move focus to the summary so screen-reader users hear what went wrong.
    requestAnimationFrame(() => summaryRef.current?.focus());
  }

  async function request(method: string, url: string, body?: unknown) {
    const res = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = (await res.json().catch(() => null)) as {
      data?: { id?: string; record?: Record<string, unknown> };
      error?: { code: string; message: string; details?: { issues?: Issue[] } };
    } | null;
    return { res, json };
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const built = buildPayload(fields, values);
    if (!built.ok) return fail(built.errors, []);

    setBusy(true);
    setSummary([]);
    setErrors({});
    setStatus(null);
    try {
      const url = `/api/v1/admin/records/${entity}${id ? `/${id}` : ''}`;
      const { res, json } = await request(id ? 'PUT' : 'POST', url, built.record);
      if (res.ok && json?.data) {
        if (!id && json.data.id) {
          router.replace(`/admin/${entity}/${json.data.id}?created=1`);
          router.refresh();
          return;
        }
        if (json.data.record) setValues(initialValues(fields, json.data.record));
        setStatus('Saved.');
        router.refresh();
        return;
      }
      if (res.status === 400 && json?.error?.details?.issues) {
        const byField: Record<string, string> = {};
        const general: string[] = [];
        for (const issue of json.error.details.issues) {
          const name = fieldOfPath(issue.path);
          if (name && fields.some((f) => f.name === name)) byField[name] ??= issue.message;
          else general.push(issue.message);
        }
        return fail(byField, [...general, ...Object.values(byField)]);
      }
      if (res.status === 401 || res.status === 403) {
        return fail({}, ['Your session has ended or you no longer have access. Sign in again.']);
      }
      fail({}, [json?.error?.message ?? 'The record could not be saved. Try again.']);
    } catch {
      fail({}, ['Could not reach the server. Check your connection and try again.']);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!id) return;
    setBusy(true);
    try {
      const { res, json } = await request('DELETE', `/api/v1/admin/records/${entity}/${id}`);
      if (res.ok) {
        router.replace(`/admin/${entity}?deleted=1`);
        router.refresh();
        return;
      }
      fail({}, [json?.error?.message ?? 'The record could not be deleted.']);
    } catch {
      fail({}, ['Could not reach the server. Check your connection and try again.']);
    } finally {
      setBusy(false);
    }
  }

  const main = fields.filter((f) => f.group !== 'source');
  const source = fields.filter((f) => f.group === 'source');
  const renderField = (f: Field) => (
    <div
      key={f.name}
      className={
        ['textarea', 'lines', 'checks', 'refs', 'capabilities'].includes(f.kind)
          ? 'sm:col-span-2'
          : undefined
      }
    >
      <FieldInput
        field={f}
        value={values[f.name] ?? ''}
        onChange={(v) => set(f.name, v)}
        refOptions={f.ref ? refs[f.ref] : []}
        locked={id !== null}
        error={errors[f.name]}
      />
    </div>
  );

  return (
    <form onSubmit={save} noValidate aria-busy={busy} className="space-y-8">
      {summary.length > 0 && (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          className="border-danger/40 bg-danger/5 rounded-lg border p-4 text-sm outline-none focus-visible:outline-2"
        >
          <p className="text-fg font-medium">The {singular} was not saved.</p>
          <ul className="text-fg-2 mt-1 list-disc space-y-0.5 pl-5">
            {[...new Set(summary)].map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      <section aria-labelledby="grp-main" className="space-y-4">
        <h2 id="grp-main" className="t-h3">
          Details
        </h2>
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
          {main.map(renderField)}
        </div>
      </section>

      <section aria-labelledby="grp-source" className="border-line space-y-4 rounded-xl border p-4">
        <h2 id="grp-source" className="t-h3">
          Source and verification
        </h2>
        <p className="text-fg-2 text-sm">
          Every fact needs a source you have read. If you cannot verify a value, leave it empty so
          it shows as &ldquo;Not publicly disclosed&rdquo;; do not guess.
        </p>
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
          {source.map(renderField)}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : id ? 'Save changes' : `Create ${singular}`}
        </Button>
        {status && (
          <p role="status" className="text-fg inline-flex items-center gap-1.5 text-sm">
            <Check size={16} aria-hidden className="text-accent" />
            {status}
          </p>
        )}
        {id && (
          <span className="sm:ml-auto">
            <ConfirmButton
              label={`Delete ${singular}`}
              question={`Delete this ${singular}? This cannot be undone.`}
              onConfirm={remove}
              busy={busy}
            />
          </span>
        )}
      </div>
    </form>
  );
}
