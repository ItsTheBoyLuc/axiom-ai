/** Shared display formatters. */

/** Compact number for token counts, e.g. 128000 -> "128K", 1000000 -> "1M". */
export function formatTokens(n: number | null | undefined): string {
  if (n === null || n === undefined) return 'Not publicly disclosed';
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${+(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
