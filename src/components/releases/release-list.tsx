import { ConfirmationBadge, DemoBadge } from '@/components/ui/badges';
import { formatDate } from '@/lib/format';
import type { ReleaseItem } from '@/types/catalog';
import { releaseKindLabel } from '@/types/model';
import { ReleaseLinks, ReleaseSubject } from './release-entry';

const th = 'px-4 py-3 text-left text-xs font-medium tracking-wide text-muted uppercase';

/** The same releases as a compact table (date, who, kind, what changed, links, status). */
export function ReleaseList({ items }: { items: ReleaseItem[] }) {
  return (
    <div
      tabIndex={0}
      role="region"
      aria-label="Releases table"
      className="border-line bg-card overflow-x-auto rounded-2xl border"
    >
      <table className="w-full min-w-[880px] border-collapse text-sm">
        <caption className="sr-only">Releases, newest first</caption>
        <thead>
          <tr className="border-line border-b">
            {['Date', 'Release', 'Kind', 'Links', 'Status'].map((h) => (
              <th key={h} scope="col" className={th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr key={r.id} className="border-line/60 border-b align-top last:border-0">
              <td className="text-fg-2 px-4 py-3 font-mono text-xs whitespace-nowrap">
                <time dateTime={r.date}>{formatDate(r.date)}</time>
              </td>
              <th scope="row" className="max-w-md px-4 py-3 text-left font-normal">
                <span className="text-fg block">{r.title}</span>
                <span className="text-fg-2 mt-0.5 block text-xs">
                  <ReleaseSubject item={r} />
                </span>
                <span className="text-fg-2 mt-1 block text-xs">{r.description}</span>
              </th>
              <td className="text-fg-2 px-4 py-3 text-xs whitespace-nowrap">
                {releaseKindLabel[r.kind]}
              </td>
              <td className="px-4 py-3">
                <ReleaseLinks item={r} />
              </td>
              <td className="px-4 py-3">
                <span className="flex flex-wrap gap-2">
                  <ConfirmationBadge confirmed={r.confirmed} status={r.verificationStatus} />
                  {r.isDemo && <DemoBadge />}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
