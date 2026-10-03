/** Pure helpers for the comparison selection (max 4) and the recently viewed list. */

export const MAX_COMPARE = 4;
export const MAX_RECENT = 12;

export type ModelRef = { slug: string; name: string; providerName: string };

const isRef = (v: unknown): v is ModelRef =>
  typeof v === 'object' &&
  v !== null &&
  typeof (v as ModelRef).slug === 'string' &&
  typeof (v as ModelRef).name === 'string' &&
  typeof (v as ModelRef).providerName === 'string';

/** Parses stored JSON defensively: anything malformed yields an empty list. */
export function parseRefs(raw: string | null, max: number): ModelRef[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    const seen = new Set<string>();
    const out: ModelRef[] = [];
    for (const item of data) {
      if (isRef(item) && !seen.has(item.slug)) {
        seen.add(item.slug);
        out.push({ slug: item.slug, name: item.name, providerName: item.providerName });
      }
      if (out.length >= max) break;
    }
    return out;
  } catch {
    return [];
  }
}

/** Adds or removes a model. Adding a fifth is refused (`ok: false`), never silently dropped. */
export function toggleSelection(
  list: ModelRef[],
  ref: ModelRef,
  max = MAX_COMPARE,
): { list: ModelRef[]; ok: boolean } {
  if (list.some((m) => m.slug === ref.slug)) {
    return { list: list.filter((m) => m.slug !== ref.slug), ok: true };
  }
  if (list.length >= max) return { list, ok: false };
  return { list: [...list, ref], ok: true };
}

/** Most recent first, de-duplicated, capped. */
export function pushRecent(list: ModelRef[], ref: ModelRef, max = MAX_RECENT): ModelRef[] {
  return [ref, ...list.filter((m) => m.slug !== ref.slug)].slice(0, max);
}

export function compareHref(list: ModelRef[]): string {
  return `/compare?models=${list.map((m) => encodeURIComponent(m.slug)).join(',')}`;
}

/** `/compare` URL for plain slugs (e.g. restored from history). */
export const compareHrefForSlugs = (slugs: string[]): string =>
  slugs.length ? `/compare?models=${slugs.map(encodeURIComponent).join(',')}` : '/compare';

const SLUG = /^[a-z0-9][a-z0-9-]{0,99}$/;

/**
 * Parses the `models` query value into at most MAX_COMPARE unique, well-formed slugs. Anything
 * malformed or beyond the limit is dropped (reported in `ignored`) so a hand-edited URL never
 * breaks the page.
 */
export function parseModelsParam(raw: string | string[] | undefined): {
  slugs: string[];
  ignored: string[];
} {
  const text = Array.isArray(raw) ? raw.join(',') : (raw ?? '');
  const slugs: string[] = [];
  const ignored: string[] = [];
  for (const part of text.split(',')) {
    const s = part.trim().toLowerCase();
    if (!s || slugs.includes(s) || ignored.includes(s)) continue;
    if (!SLUG.test(s) || slugs.length >= MAX_COMPARE) ignored.push(s.slice(0, 60));
    else slugs.push(s);
  }
  return { slugs, ignored };
}
