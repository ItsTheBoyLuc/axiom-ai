import {
  BadgeCheck,
  CircleHelp,
  EyeOff,
  FlaskConical,
  Newspaper,
  ShieldCheck,
  Sparkles,
  Users,
  Building2,
  type LucideIcon,
} from 'lucide-react';
import type { EvaluationType } from '@/types/model';
import { verificationLabel, type VerificationStatus } from '@/lib/verification';

const base =
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium leading-5 whitespace-nowrap';

/** Verification status: icon + label + color, never color alone. */
const statusStyle: Record<VerificationStatus, { icon: LucideIcon; cls: string }> = {
  OFFICIALLY_VERIFIED: { icon: BadgeCheck, cls: 'border-ok/40 text-ok bg-ok/10' },
  INDEPENDENTLY_EVALUATED: { icon: ShieldCheck, cls: 'border-accent/40 text-accent bg-accent/10' },
  PROVIDER_REPORTED: { icon: Building2, cls: 'border-accent-3/40 text-accent-3 bg-accent-3/10' },
  COMMUNITY_REPORTED: { icon: Users, cls: 'border-warn/40 text-warn bg-warn/10' },
  UNVERIFIED: { icon: CircleHelp, cls: 'border-line-strong text-fg-2 bg-elevated' },
  NOT_PUBLICLY_DISCLOSED: { icon: EyeOff, cls: 'border-line-strong text-fg-2 bg-elevated' },
};

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  const { icon: Icon, cls } = statusStyle[status];
  return (
    <span className={`${base} ${cls}`}>
      <Icon size={13} aria-hidden />
      {verificationLabel[status]}
    </span>
  );
}

/** Visible flag for placeholder data (docs/PROMPT.md section 2). */
export function DemoBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`${base} border-warn/50 bg-warn/10 text-warn font-mono tracking-wider uppercase ${className}`}
      title="Placeholder data for layout only. Not a real record."
    >
      <FlaskConical size={13} aria-hidden />
      Demo data
    </span>
  );
}

export function OfficialBadge() {
  return (
    <span className={`${base} border-ok/40 bg-ok/10 text-ok`}>
      <BadgeCheck size={13} aria-hidden />
      Official
    </span>
  );
}

export function IndependentBadge() {
  return (
    <span className={`${base} border-accent-2/40 bg-accent-2/10 text-accent-2`}>
      <Newspaper size={13} aria-hidden />
      Independent
    </span>
  );
}

export function AiSummaryBadge() {
  return (
    <span className={`${base} border-accent-3/40 bg-accent-3/10 text-accent-3`}>
      <Sparkles size={13} aria-hidden />
      AI summary
    </span>
  );
}

export function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="border-line bg-elevated text-fg-2 inline-flex items-center rounded-md border px-2 py-0.5 text-xs">
      {children}
    </span>
  );
}

/** Independent vs provider-reported vs community: icon + label + color (docs/PROMPT.md 2, 7.6). */
export function EvaluationBadge({ type }: { type: EvaluationType }) {
  const status = {
    INDEPENDENT: 'INDEPENDENTLY_EVALUATED',
    PROVIDER_REPORTED: 'PROVIDER_REPORTED',
    COMMUNITY: 'COMMUNITY_REPORTED',
  } as const;
  return <VerificationBadge status={status[type]} />;
}
