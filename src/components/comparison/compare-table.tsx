import { Fragment } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowUpRight } from 'lucide-react';
import type { CompareCell, CompareGroup } from '@/lib/compare/table';
import type { ModelDetail } from '@/types/model';

/** Groups whose values are numbers or scores read better in the monospace face. */
const MONO_GROUPS = new Set(['technical', 'performance', 'pricing']);

const FIRST_COL = 'w-44 min-w-44 sm:w-56 sm:min-w-56';

function Cell({ cell, mono, tint }: { cell: CompareCell; mono: boolean; tint: string }) {
  return (
    <td className={`px-4 py-3 align-top ${tint}`}>
      {cell.lines.map((l) => (
        <span
          key={l}
          className={`block leading-5 ${cell.disclosed ? 'text-fg' : 'text-fg-2'} ${
            mono && cell.disclosed ? 'font-mono text-[13px]' : 'text-sm'
          }`}
        >
          {l}
        </span>
      ))}
      {cell.sub.map((s) => (
        <span key={s} className="text-muted mt-0.5 block text-xs">
          {s}
        </span>
      ))}
      {cell.href && (
        <a
          href={cell.href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent mt-1 inline-flex items-center gap-1 text-xs font-medium hover:underline"
        >
          {cell.hrefLabel} <ArrowUpRight size={12} aria-hidden />
        </a>
      )}
    </td>
  );
}

/**
 * The comparison table: one column per model, rows in groups (General, Technical, Performance,
 * Pricing, Availability). With "highlight differences" on, rows whose values differ get a tint
 * AND a visible "Differs" label (never colour alone). The wrapper scrolls horizontally on
 * narrow screens and the attribute column stays in view.
 */
export function CompareTable({
  groups,
  models,
  highlight,
  sharedOnly = false,
}: {
  groups: CompareGroup[];
  models: ModelDetail[];
  highlight: boolean;
  /** Performance: keep only benchmarks that at least two selected models have a result for. */
  sharedOnly?: boolean;
}) {
  const colSpan = models.length + 1;
  const base = 'bg-card';
  const tinted = 'bg-[color-mix(in_srgb,var(--accent)_8%,var(--bg-card))]';

  return (
    <div
      tabIndex={0}
      role="region"
      aria-label="Comparison table"
      className="border-line bg-card overflow-x-auto rounded-2xl border"
    >
      <table
        className="w-full border-collapse text-sm"
        style={{ minWidth: `${14 + models.length * 12}rem` }}
      >
        <caption className="sr-only">
          Comparison of {models.map((m) => m.name).join(', ')}
          {highlight ? '. Rows where the values differ are marked.' : ''}
        </caption>
        <thead>
          <tr className="border-line border-b">
            <th
              scope="col"
              className={`text-muted sticky left-0 z-10 px-4 py-3 text-left text-xs font-medium tracking-wide uppercase ${FIRST_COL} ${base}`}
            >
              Attribute
            </th>
            {models.map((m) => (
              <th key={m.slug} scope="col" className="text-fg px-4 py-3 text-left font-medium">
                <Link href={`/models/${m.slug}`} className="hover:underline">
                  {m.name}
                </Link>
                <span className="text-muted block text-xs font-normal">{m.providerName}</span>
              </th>
            ))}
          </tr>
        </thead>
        {groups.map((g) => {
          const rows =
            sharedOnly && g.id === 'performance'
              ? g.rows.filter((r) => r.cells.filter((c) => c.disclosed).length >= 2)
              : g.rows;
          if (g.rows.length === 0) return null;
          let section: string | null = null;
          return (
            <tbody key={g.id} id={`compare-${g.id}`}>
              <tr className="border-line bg-elevated border-y">
                <th
                  scope="colgroup"
                  colSpan={colSpan}
                  className="text-fg px-4 py-2 text-left text-xs font-semibold tracking-wide uppercase"
                >
                  {g.title}
                </th>
              </tr>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={colSpan} className="text-fg-2 px-4 py-3 text-sm">
                    No benchmark has a result for two or more of the selected models.
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const heading = r.section && r.section !== section ? r.section : null;
                section = r.section;
                const marked = highlight && r.differs;
                const tint = marked ? tinted : base;
                return (
                  <Fragment key={r.id}>
                    {heading && (
                      <tr key={`${r.id}-section`} className="border-line/60 border-b">
                        <th
                          scope="colgroup"
                          colSpan={colSpan}
                          className="text-fg-2 px-4 pt-3 pb-1 text-left text-xs font-medium"
                        >
                          {heading}
                        </th>
                      </tr>
                    )}
                    <tr className="border-line/60 border-b last:border-0">
                      <th
                        scope="row"
                        className={`sticky left-0 z-10 px-4 py-3 text-left align-top font-normal ${FIRST_COL} ${tint}`}
                      >
                        <span className="text-fg-2 text-sm">{r.label}</span>
                        {r.hint && <span className="text-muted block text-xs">{r.hint}</span>}
                        {marked && (
                          <span className="border-accent text-fg mt-1 inline-block rounded border px-1.5 py-0.5 text-[11px] font-medium">
                            Differs
                          </span>
                        )}
                        {r.caveat && (
                          <span className="text-fg-2 mt-1.5 flex items-start gap-1 text-xs">
                            <AlertTriangle
                              size={12}
                              aria-hidden
                              className="text-warn mt-0.5 shrink-0"
                            />
                            {r.caveat}
                          </span>
                        )}
                      </th>
                      {r.cells.map((c, i) => (
                        <Cell
                          key={models[i]!.slug}
                          cell={c}
                          mono={MONO_GROUPS.has(g.id)}
                          tint={tint}
                        />
                      ))}
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}
