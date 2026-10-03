/** CSV text for a chart's data: quoted cells, header row first. */
export function chartCsv(rows: (string | number)[][]): string {
  const esc = (v: string | number) =>
    typeof v === 'number' ? String(v) : `"${v.replaceAll('"', '""')}"`;
  return rows.map((r) => r.map(esc).join(',')).join('\n');
}

/** Saves text as a CSV file in the browser. */
export function downloadCsv(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** "Context window (tokens)" -> "context-window-tokens.csv". */
export const csvFilename = (title: string) => `${title.toLowerCase().replace(/\W+/g, '-')}.csv`;
