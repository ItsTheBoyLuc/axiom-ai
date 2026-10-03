/** Small text helpers shared by the adapters. Pure. */

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
};

/** Plain text from an HTML or markdown-ish fragment: no tags, decoded basic entities, one line. */
export function plainText(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(?:amp|lt|gt|quot|#39|apos|nbsp);/g, (m) => ENTITIES[m] ?? m)
    .replace(/[#*_`>]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** An excerpt of at most `max` characters, cut at a word boundary, with an ellipsis if cut. */
export function excerpt(text: string, max = 200): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:–-]+$/, '')}…`;
}

/** ISO date-time from any parsable date, or null (never a guess for garbage input). */
export function toIso(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** http(s) URL resolved against a base, or null. */
export function absoluteHttpUrl(value: unknown, base?: string): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const u = new URL(value.trim(), base);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}
