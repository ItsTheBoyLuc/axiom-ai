import { AlertTriangle, CheckCircle2, Loader2, XCircle } from 'lucide-react';

/** "2026-10-03 18:30 UTC": absolute and timezone-explicit, so server and browser render alike. */
export const utc = (iso: string | null | undefined): string =>
  iso ? `${iso.slice(0, 16).replace('T', ' ')} UTC` : '—';

const RUN: Record<string, { label: string; Icon: typeof CheckCircle2; className: string }> = {
  SUCCEEDED: { label: 'Succeeded', Icon: CheckCircle2, className: 'border-line text-fg-2' },
  PARTIAL: { label: 'Partial', Icon: AlertTriangle, className: 'border-warn/60 text-fg' },
  FAILED: { label: 'Failed', Icon: XCircle, className: 'border-danger/60 text-danger' },
  RUNNING: { label: 'Running', Icon: Loader2, className: 'border-accent/60 text-fg' },
};

/** Outcome of a sync run: icon + word + colour, never colour alone. */
export function RunStatus({ status }: { status: string }) {
  const s = RUN[status] ?? RUN.FAILED!;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs ${s.className}`}
    >
      <s.Icon size={13} aria-hidden />
      {s.label}
    </span>
  );
}

const TRUST: Record<string, string> = {
  ok: 'border-line text-fg-2',
  downgrade: 'border-warn/60 text-fg',
};

/** Whether staging an import lowers trust (needs an explicit override to publish). */
export function TrustPill({ trust }: { trust: 'ok' | 'downgrade' }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs ${TRUST[trust]}`}
    >
      {trust === 'downgrade' && <AlertTriangle size={13} aria-hidden />}
      {trust === 'downgrade' ? 'Lowers trust' : 'No trust change'}
    </span>
  );
}
