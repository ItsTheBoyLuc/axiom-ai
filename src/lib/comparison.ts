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
