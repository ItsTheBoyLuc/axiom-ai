'use client';

import { useId, useState } from 'react';
import { BarChart3, Download, Table2 } from 'lucide-react';
import { chartButton } from './series-style';

/**
 * The shared frame of a chart (docs/PROMPT.md 8): title with units, a chart/table switch, a CSV
 * download, a text summary for screen readers, an optional legend and the source/method note.
 * The chart itself is `children`; `table` is the accessible alternative with the same numbers.
 */
export function ChartFrame({
  title,
  unit,
  summary,
  onDownload,
  table,
  legend,
  footnote,
  children,
}: {
  title: string;
  unit: string;
  /** Spoken description of the chart (values included). */
  summary: string;
  onDownload: () => void;
  table: React.ReactNode;
  legend?: React.ReactNode;
  footnote: React.ReactNode;
  children: React.ReactNode;
}) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const id = useId();
  return (
    <figure aria-labelledby={`${id}-t`} className="border-line bg-card rounded-2xl border p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <figcaption id={`${id}-t`} className="text-fg text-sm font-medium">
          {title} <span className="text-muted font-normal">({unit})</span>
        </figcaption>
        <div className="flex gap-2">
          <button
            type="button"
            className={chartButton}
            onClick={() => setView(view === 'chart' ? 'table' : 'chart')}
          >
            {view === 'chart' ? (
              <Table2 size={14} aria-hidden />
            ) : (
              <BarChart3 size={14} aria-hidden />
            )}
            {view === 'chart' ? 'Table view' : 'Chart view'}
          </button>
          <button type="button" className={chartButton} onClick={onDownload}>
            <Download size={14} aria-hidden />
            CSV
          </button>
        </div>
      </div>
      {view === 'chart' ? (
        <>
          <div role="img" aria-label={summary} className="w-full">
            {children}
          </div>
          {legend}
        </>
      ) : (
        <div className="overflow-x-auto">{table}</div>
      )}
      <p className="text-muted mt-3 text-xs">{footnote}</p>
    </figure>
  );
}
