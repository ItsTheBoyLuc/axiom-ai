/**
 * Sync schedules. A source runs on a plain interval ("every 6h") or only when triggered by hand
 * ("manual"). Intervals are bounded: not more often than every 15 minutes (politeness towards
 * the sources, docs/PROMPT.md 11) and not less often than every 30 days. Pure and React-free so
 * the worker, the API and the dashboard share one definition of "when is the next run".
 */

export const MIN_INTERVAL_MINUTES = 15;
export const MAX_INTERVAL_MINUTES = 30 * 24 * 60;

export type Schedule = { kind: 'manual' } | { kind: 'interval'; minutes: number };

const UNIT_MINUTES = { m: 1, h: 60, d: 24 * 60 } as const;

/** `every 15m`, `every 6h`, `every 1d` (case and spacing tolerant) or `manual`. */
export function parseSchedule(raw: string): Schedule | null {
  const text = raw.trim().toLowerCase();
  if (text === 'manual') return { kind: 'manual' };
  const m = /^every\s+(\d{1,5})\s*([mhd])$/.exec(text);
  if (!m) return null;
  const minutes = Number(m[1]) * UNIT_MINUTES[m[2] as keyof typeof UNIT_MINUTES];
  if (minutes < MIN_INTERVAL_MINUTES || minutes > MAX_INTERVAL_MINUTES) return null;
  return { kind: 'interval', minutes };
}

export const SCHEDULE_HELP = `"manual", or "every 15m" / "every 6h" / "every 1d" (between 15 minutes and 30 days)`;

/** Canonical text for a valid schedule ("every 6h"), or null if the input is not valid. */
export function normalizeSchedule(raw: string): string | null {
  const s = parseSchedule(raw);
  if (!s) return null;
  if (s.kind === 'manual') return 'manual';
  const { minutes } = s;
  if (minutes % (24 * 60) === 0) return `every ${minutes / (24 * 60)}d`;
  if (minutes % 60 === 0) return `every ${minutes / 60}h`;
  return `every ${minutes}m`;
}

/**
 * When the source is next due. `null` = never automatically (manual, or invalid). A source that
 * has never run is due immediately.
 */
export function nextRunAt(schedule: string, lastStartedAt: Date | null, now: Date): Date | null {
  const s = parseSchedule(schedule);
  if (!s || s.kind === 'manual') return null;
  if (!lastStartedAt) return now;
  return new Date(lastStartedAt.getTime() + s.minutes * 60_000);
}

export function isDue(schedule: string, lastStartedAt: Date | null, now: Date): boolean {
  const next = nextRunAt(schedule, lastStartedAt, now);
  return next !== null && next.getTime() <= now.getTime();
}
