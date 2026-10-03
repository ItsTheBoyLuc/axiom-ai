'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import {
  CAPABILITY_AVAILABILITY,
  CAPABILITY_OPTIONS,
  type CapabilityRow,
  type Field,
  type FormValue,
  type Option,
} from '@/lib/admin/fields';

export const controlClass =
  'h-10 w-full rounded-lg border border-line-strong bg-elevated px-3 text-sm text-fg outline-none focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60';
const smallButton =
  'inline-flex h-10 items-center gap-1.5 rounded-lg border border-line-strong bg-elevated px-3 text-sm text-fg-2 transition-colors hover:text-fg';

type Props = {
  field: Field;
  value: FormValue;
  onChange: (value: FormValue) => void;
  /** Options for `ref` / `refs` fields (providers, models, benchmarks). */
  refOptions: Option[];
  /** The slug / article URL cannot change once saved. */
  locked: boolean;
  error: string | undefined;
};

/** One labelled control, wired for screen readers: label, help text and error are associated. */
export function FieldInput({ field, value, onChange, refOptions, locked, error }: Props) {
  const id = `f-${field.name}`;
  const describedBy = [field.help ? `${id}-help` : '', error ? `${id}-err` : '']
    .filter(Boolean)
    .join(' ');
  const common = {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy || undefined,
  } as const;

  const label = (
    <>
      {field.label}
      {field.required && (
        <span aria-hidden className="text-accent ml-0.5">
          *
        </span>
      )}
    </>
  );
  const help = field.help && (
    <p id={`${id}-help`} className="text-muted mt-1 text-xs">
      {field.help}
    </p>
  );
  const err = error && (
    <p id={`${id}-err`} role="alert" className="text-danger mt-1 text-xs">
      {error}
    </p>
  );

  switch (field.kind) {
    case 'boolean':
      return (
        <div>
          <label htmlFor={id} className="text-fg flex items-center gap-2.5 text-sm font-medium">
            <input
              {...common}
              type="checkbox"
              checked={value === true}
              onChange={(e) => onChange(e.target.checked)}
              className="accent-accent size-4"
            />
            {field.label}
          </label>
          {help}
          {err}
        </div>
      );

    case 'checks':
      return (
        <fieldset aria-describedby={describedBy || undefined}>
          <legend className="text-fg text-sm font-medium">{label}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {field.options!.map((o) => {
              const on = Array.isArray(value) && (value as string[]).includes(o.value);
              return (
                <label
                  key={o.value}
                  className={`inline-flex min-h-8 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm ${on ? 'border-accent bg-accent/10 text-fg' : 'border-line text-fg-2'}`}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) => {
                      const cur = (Array.isArray(value) ? value : []) as string[];
                      onChange(
                        e.target.checked ? [...cur, o.value] : cur.filter((x) => x !== o.value),
                      );
                    }}
                    className="accent-accent size-4"
                  />
                  {o.label}
                </label>
              );
            })}
          </div>
          {help}
          {err}
        </fieldset>
      );

    case 'refs':
      return (
        <RefChecklist
          id={id}
          label={label}
          options={refOptions}
          value={Array.isArray(value) ? (value as string[]) : []}
          onChange={onChange}
          help={help}
          err={err}
        />
      );

    case 'capabilities':
      return (
        <CapabilityEditor
          id={id}
          label={label}
          rows={Array.isArray(value) ? (value as CapabilityRow[]) : []}
          onChange={onChange}
          err={err}
        />
      );

    case 'lines':
      return (
        <div>
          <label htmlFor={id} className="text-fg text-sm font-medium">
            {label}
          </label>
          <textarea
            {...common}
            rows={4}
            value={Array.isArray(value) ? (value as string[]).join('\n') : ''}
            onChange={(e) => onChange(e.target.value.split('\n'))}
            className={`${controlClass} mt-1.5 h-auto py-2`}
          />
          {help}
          {err}
        </div>
      );

    case 'textarea':
      return (
        <div>
          <label htmlFor={id} className="text-fg text-sm font-medium">
            {label}
          </label>
          <textarea
            {...common}
            rows={4}
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
            className={`${controlClass} mt-1.5 h-auto py-2`}
          />
          {help}
          {err}
        </div>
      );

    case 'select':
    case 'tristate':
    case 'ref': {
      const options =
        field.kind === 'ref'
          ? [
              ...(field.nullable
                ? [{ value: '', label: 'None' }]
                : [{ value: '', label: 'Choose…' }]),
              ...refOptions,
            ]
          : field.options!;
      return (
        <div>
          <label htmlFor={id} className="text-fg text-sm font-medium">
            {label}
          </label>
          <select
            {...common}
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
            className={`${controlClass} mt-1.5`}
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {help}
          {err}
        </div>
      );
    }

    default: {
      const type =
        field.kind === 'date'
          ? 'date'
          : field.kind === 'datetime'
            ? 'datetime-local'
            : field.kind === 'url'
              ? 'url'
              : 'text';
      const numeric = field.kind === 'number' || field.kind === 'integer';
      const isIdentity = locked && (field.name === 'slug' || field.name === 'articleUrl');
      return (
        <div>
          <label htmlFor={id} className="text-fg text-sm font-medium">
            {label}
          </label>
          <input
            {...common}
            type={type}
            inputMode={numeric ? (field.kind === 'integer' ? 'numeric' : 'decimal') : undefined}
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
            readOnly={isIdentity}
            aria-readonly={isIdentity || undefined}
            autoComplete="off"
            spellCheck={false}
            className={`${controlClass} mt-1.5 ${numeric ? 'font-mono' : ''} ${isIdentity ? 'text-muted' : ''}`}
          />
          {help}
          {err}
        </div>
      );
    }
  }
}

function RefChecklist({
  id,
  label,
  options,
  value,
  onChange,
  help,
  err,
}: {
  id: string;
  label: React.ReactNode;
  options: Option[];
  value: string[];
  onChange: (v: string[]) => void;
  help: React.ReactNode;
  err: React.ReactNode;
}) {
  const [filter, setFilter] = useState('');
  const shown = options.filter(
    (o) => !filter || `${o.label} ${o.value}`.toLowerCase().includes(filter.toLowerCase()),
  );
  return (
    <fieldset>
      <legend className="text-fg text-sm font-medium">{label}</legend>
      <input
        type="search"
        aria-label="Filter the list"
        placeholder="Filter…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className={`${controlClass} mt-1.5`}
      />
      <ul
        id={id}
        className="border-line mt-2 max-h-48 space-y-0.5 overflow-y-auto rounded-lg border p-1"
      >
        {shown.map((o) => (
          <li key={o.value}>
            <label className="hover:bg-elevated flex min-h-8 cursor-pointer items-center gap-2 rounded px-2 text-sm">
              <input
                type="checkbox"
                checked={value.includes(o.value)}
                onChange={(e) =>
                  onChange(
                    e.target.checked ? [...value, o.value] : value.filter((x) => x !== o.value),
                  )
                }
                className="accent-accent size-4"
              />
              <span className="text-fg">{o.label}</span>
            </label>
          </li>
        ))}
        {shown.length === 0 && <li className="text-muted px-2 py-1.5 text-sm">No matches.</li>}
      </ul>
      <p className="text-muted mt-1 text-xs" aria-live="polite">
        {value.length} selected
      </p>
      {help}
      {err}
    </fieldset>
  );
}

function CapabilityEditor({
  id,
  label,
  rows,
  onChange,
  err,
}: {
  id: string;
  label: React.ReactNode;
  rows: CapabilityRow[];
  onChange: (rows: CapabilityRow[]) => void;
  err: React.ReactNode;
}) {
  const set = (i: number, patch: Partial<CapabilityRow>) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const used = new Set(rows.map((r) => r.name));
  return (
    <fieldset id={id}>
      <legend className="text-fg text-sm font-medium">{label}</legend>
      <ul className="mt-2 space-y-2">
        {rows.map((r, i) => (
          <li
            key={i}
            className="border-line grid grid-cols-1 items-end gap-2 rounded-lg border p-2 sm:grid-cols-[1fr_9rem_1fr_auto]"
          >
            <label className="text-fg-2 text-xs">
              Capability
              <select
                value={r.name}
                onChange={(e) => set(i, { name: e.target.value })}
                className={`${controlClass} mt-1`}
              >
                {CAPABILITY_OPTIONS.filter((o) => o.value === r.name || !used.has(o.value)).map(
                  (o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label className="text-fg-2 text-xs">
              Availability
              <select
                value={r.availability}
                onChange={(e) => set(i, { availability: e.target.value })}
                className={`${controlClass} mt-1`}
              >
                {CAPABILITY_AVAILABILITY.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-fg-2 text-xs">
              Documentation URL
              <input
                type="url"
                value={r.documentationUrl}
                onChange={(e) => set(i, { documentationUrl: e.target.value })}
                className={`${controlClass} mt-1`}
              />
            </label>
            <button
              type="button"
              onClick={() => onChange(rows.filter((_, j) => j !== i))}
              aria-label={`Remove capability ${r.name}`}
              className={smallButton}
            >
              <X size={16} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={used.size >= CAPABILITY_OPTIONS.length}
        onClick={() => {
          const next = CAPABILITY_OPTIONS.find((o) => !used.has(o.value));
          if (next)
            onChange([
              ...rows,
              { name: next.value, availability: 'AVAILABLE', documentationUrl: '' },
            ]);
        }}
        className={`${smallButton} mt-2 disabled:opacity-50`}
      >
        <Plus size={16} aria-hidden /> Add capability
      </button>
      {err}
    </fieldset>
  );
}
