import { groupByMonth } from '@/lib/releases/query';
import type { ReleaseItem } from '@/types/catalog';
import { ReleaseEntry } from './release-entry';
import { TimelineScroll } from './timeline-scroll';

/**
 * Chronological timeline (newest first), grouped under month headings. A line runs down the
 * left; the accent part draws as you scroll (GSAP, see TimelineScroll) and entries rise in.
 * The markup is plain, ordered and fully visible without JavaScript.
 */
export function ReleaseTimeline({ items }: { items: ReleaseItem[] }) {
  const groups = groupByMonth(items);
  return (
    <TimelineScroll>
      <div className="relative">
        <div aria-hidden className="bg-line-strong absolute top-2 bottom-2 left-[9px] w-px" />
        <div
          aria-hidden
          data-timeline-progress
          className="bg-accent absolute top-2 bottom-2 left-[9px] w-px origin-top"
        />
        {groups.map((g) => (
          <section key={g.key} aria-labelledby={`month-${g.key}`} className="relative pb-6">
            <h2
              id={`month-${g.key}`}
              className="text-fg bg-bg relative z-10 mb-4 ml-8 inline-block pr-3 text-sm font-medium tracking-wide uppercase"
            >
              {g.label}
            </h2>
            <ol className="space-y-5">
              {g.items.map((r) => (
                <li key={r.id} data-release-entry className="relative pl-8">
                  <span
                    aria-hidden
                    className="border-accent bg-bg absolute top-6 left-1 size-[18px] rounded-full border-2"
                  />
                  <ReleaseEntry item={r} />
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </TimelineScroll>
  );
}
