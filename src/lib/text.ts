/**
 * Text normalisation shared by the in-memory logic, the search document builder and the
 * Prisma repositories, so all of them agree byte for byte.
 */

/** Lowercase, accent-stripped form used for search and sorting. */
export function normalizeText(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '');
}

/** Whitespace-separated, normalised search tokens. */
export function searchTokens(q: string): string[] {
  return normalizeText(q).split(/\s+/).filter(Boolean);
}

/**
 * Escapes the LIKE/ILIKE metacharacters (`\`, `%`, `_`) so user input is matched literally.
 * Prisma's `contains` does NOT do this itself, so a search for "%" would match every row.
 */
export const escapeLike = (s: string): string => s.replace(/[\\%_]/g, '\\$&');

/**
 * Sort key for names: normalised and compared by UTF-16 code units, which matches a
 * PostgreSQL column with COLLATE "C" (used for `sortName`). Never use localeCompare for
 * anything that must match the database.
 */
export const sortKey = normalizeText;

export function compareKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
