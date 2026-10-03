'use client';

import { useState } from 'react';

/**
 * Two-step destructive action without a browser dialog: the first click asks, the second one
 * does it. The question is announced politely and Cancel is always one key away.
 */
export function ConfirmButton({
  label,
  question,
  onConfirm,
  busy = false,
  className = '',
}: {
  label: string;
  question: string;
  onConfirm: () => void | Promise<void>;
  busy?: boolean;
  className?: string;
}) {
  const [asking, setAsking] = useState(false);
  const base =
    'inline-flex h-10 items-center rounded-lg border px-3 text-sm font-medium transition-colors disabled:opacity-60';

  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        disabled={busy}
        className={`${base} border-danger/50 text-danger hover:bg-danger/10 ${className}`}
      >
        {label}
      </button>
    );
  }
  return (
    <span role="group" aria-label={label} className="inline-flex flex-wrap items-center gap-2">
      <span role="status" className="text-fg text-sm">
        {question}
      </span>
      <button
        type="button"
        autoFocus
        disabled={busy}
        onClick={async () => {
          await onConfirm();
          setAsking(false);
        }}
        className={`${base} border-danger bg-danger/15 text-danger hover:bg-danger/25`}
      >
        {busy ? 'Working…' : 'Yes, ' + label.toLowerCase()}
      </button>
      <button
        type="button"
        onClick={() => setAsking(false)}
        className={`${base} border-line-strong text-fg-2 hover:text-fg`}
      >
        Cancel
      </button>
    </span>
  );
}
