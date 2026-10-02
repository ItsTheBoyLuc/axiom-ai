/**
 * CSV building for exports. Beyond RFC 4180 quoting this neutralises "CSV injection": a cell
 * that starts with = + - @ (or tab / CR) would be executed as a formula by spreadsheet
 * software, so it is prefixed with an apostrophe.
 */
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  // Plain negative numbers are data, not formulas.
  const isNumber = typeof value === 'number';
  if (!isNumber && FORMULA_START.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export function toCsv(rows: (string | number | boolean | null | undefined)[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
