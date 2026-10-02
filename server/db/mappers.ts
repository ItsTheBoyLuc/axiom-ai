import type { NewsCategoryKey } from '../../src/types/catalog';

/**
 * Prisma enums are UPPER_SNAKE_CASE, the domain/URL vocabulary is kebab-case ("image-generation").
 * Both directions are trivial and total for our enums, so a generic mapper is enough.
 */
export const toDbEnum = (s: string): string => s.toUpperCase().replaceAll('-', '_');
export const fromDbEnum = <T extends string>(s: string): T =>
  s.toLowerCase().replaceAll('_', '-') as T;
export const toDbEnums = (xs: readonly string[]): string[] => xs.map(toDbEnum);
export const fromDbEnums = <T extends string>(xs: readonly string[]): T[] =>
  xs.map((x) => fromDbEnum<T>(x));

/** `@db.Date` columns come back as UTC-midnight Dates: YYYY-MM-DD. */
export const isoDate = (d: Date): string => d.toISOString().slice(0, 10);
export const isoDateTime = (d: Date): string => d.toISOString();
export const isoDateTimeOrNull = (d: Date | null): string | null => (d ? d.toISOString() : null);

/** Query strings use kebab-case news categories; the database enum is UPPER_SNAKE. */
export const newsCategoryFromKebab = (s: string): NewsCategoryKey => toDbEnum(s) as NewsCategoryKey;

/** Provider monogram: explicit value, else the first letter or digit of the name. */
export function monogramOf(name: string, explicit: string | null): string {
  if (explicit) return explicit;
  const m = name.match(/[\p{L}\p{N}]/u);
  return (m ? m[0] : '?').toUpperCase();
}
